// The badge's parts and how each looks, lit or off (docs/PLAN.md §3.1, §3.1.1).
// When something is missing the badge is not hidden and invents nothing: it
// looks switched off, like an empty cartridge slot, part by part.

import { effortCells, effortLabel } from './effort.js'
import { widthOf } from './layout.js'
import type { Variant } from './layout.ts'
import type { Family, ModelView } from './model.ts'
import type { EffortView } from './state.ts'

export type BadgeStateName = 'active' | 'partial' | 'disabled'

export interface ModelPart {
  /** Lit in the family's color when true; dimmed when false. */
  enabled: boolean
  /** ◆ a known family, ? an unknown one, ◇ no model read yet. */
  glyph: '◆' | '?' | '◇'
  /** The label from parseModel (rebuilt or sanitized), or a placeholder. */
  text: string
  family: Family | null
}

export interface EffortPart {
  /** Lit when the last turn.step set it; dimmed when stored, pending or unknown. */
  enabled: boolean
  /** Five cells: ▮ filled, ▯ empty, ░ off; empty for a custom effort, which has no meter. */
  cells: string
  /** How many cells are filled. */
  filled: number
  /** LOW … MAX, CUSTOM or ---, with … while an /effort is pending. */
  text: string
}

export interface BadgeView {
  state: BadgeStateName
  model: ModelPart
  effort: EffortPart
}

/** The theme key each known family is drawn in: never raw ANSI. */
export const FAMILY_COLOR: Readonly<Record<Exclude<Family, 'unknown'>, string>> = Object.freeze({
  opus: 'claude',
  sonnet: 'suggestion',
  haiku: 'success',
  fable: 'merged',
})

const CELLS = 5
const PENDING = '…'

/** Columns each variant always takes, so lighting a part never moves the badge (§3.1.1). */
const MODEL_FIELD = 10 // `SONNET 5.5`, the longest current label
const EFFORT_FIELD = 5 // `HIGH…`
export const SLOT = Object.freeze({
  modelOnly: 2 + MODEL_FIELD,
  noMeter: 2 + MODEL_FIELD + 1 + EFFORT_FIELD,
  full: 2 + MODEL_FIELD + 1 + CELLS + 1 + EFFORT_FIELD,
} satisfies Record<Variant, number>)

/** The columns a variant always takes (its SLOT). */
export function slotWidth(variant: Variant): number {
  switch (variant) {
    case 'full':
      return SLOT.full
    case 'noMeter':
      return SLOT.noMeter
    case 'modelOnly':
      return SLOT.modelOnly
  }
}

function modelPart(model: ModelView | null, effortKnown: boolean): ModelPart {
  if (model === null) {
    return { enabled: false, glyph: '◇', text: effortKnown ? '?' : '-----', family: null }
  }
  if (model.family === 'unknown') {
    return { enabled: false, glyph: '?', text: model.label, family: 'unknown' }
  }
  return { enabled: true, glyph: '◆', text: model.label, family: model.family }
}

function effortPart(effort: EffortView): EffortPart {
  const mark = effort.source === 'pending' ? PENDING : ''
  const lit = effort.source === 'step'
  if (effort.level !== undefined) {
    const filled = effortCells(effort.level)
    return {
      enabled: lit,
      cells: '▮'.repeat(filled) + '▯'.repeat(CELLS - filled),
      filled,
      text: effortLabel(effort.level) + mark,
    }
  }
  if (effort.custom === true) return { enabled: lit, cells: '', filled: 0, text: `CUSTOM${mark}` }
  return { enabled: false, cells: '░'.repeat(CELLS), filled: 0, text: `---${mark}` }
}

/**
 * The badge for what is known: active when a known model and a live effort
 * (the last turn.step, or a pending /effort) are both there, disabled when
 * neither is, partial otherwise.
 */
export function badgeState({
  model,
  effort,
}: {
  model: ModelView | null
  effort: EffortView
}): BadgeView {
  const effortKnown = effort.level !== undefined || effort.custom === true
  const effortLive = effortKnown && (effort.source === 'step' || effort.source === 'pending')
  const modelKnown = model !== null && model.family !== 'unknown'
  let state: BadgeStateName = 'partial'
  if (modelKnown && effortLive) state = 'active'
  else if (!modelKnown && !effortKnown) state = 'disabled'
  return { state, model: modelPart(model, effortKnown), effort: effortPart(effort) }
}

/** How a run is painted: in the family's color, as plain text, or dimmed. */
export type Paint = 'family' | 'lit' | 'dim'

export interface Run {
  text: string
  paint: Paint
}

/**
 * The badge in one size as painted runs, padded on the left to its SLOT: on
 * the right-aligned footer the padding is blank room before the badge.
 */
export function badgeRuns(view: BadgeView, variant: Variant): Run[] {
  const { model, effort } = view
  const runs: Run[] = [
    { text: `${model.glyph} ${model.text}`, paint: model.enabled ? 'family' : 'dim' },
  ]
  if (variant !== 'modelOnly') {
    runs.push({ text: ' ', paint: 'dim' })
    if (variant === 'full' && effort.cells !== '') {
      if (effort.enabled) {
        runs.push({ text: effort.cells.slice(0, effort.filled), paint: 'family' })
        runs.push({ text: effort.cells.slice(effort.filled), paint: 'dim' })
      } else {
        runs.push({ text: effort.cells, paint: 'dim' })
      }
      runs.push({ text: ' ', paint: 'dim' })
    }
    runs.push({ text: effort.text, paint: effort.enabled ? 'lit' : 'dim' })
  }
  const kept = runs.filter((run) => run.text !== '')
  const room = slotWidth(variant) - widthOf(kept.map((run) => run.text).join(''))
  return room > 0 ? [{ text: ' '.repeat(room), paint: 'dim' }, ...kept] : kept
}

/** Every size of the badge as plain text, for fitBadge to measure. */
export function badgeVariants(view: BadgeView): Record<Variant, string> {
  const text = (variant: Variant) =>
    badgeRuns(view, variant)
      .map((run) => run.text)
      .join('')
  return {
    full: text('full'),
    noMeter: text('noMeter'),
    modelOnly: text('modelOnly'),
  }
}
