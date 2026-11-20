// The 8-bit band above the prompt (docs/PLAN.md §3.2, §3.4): when it shows,
// and how much of it fits. The footer's badge is unaffected by any of it.

import { effortRuns } from './badge.js'
import type { BadgeView, Run } from './badge.ts'
import { widthOf } from './layout.js'
import type { Variant } from './layout.ts'
import type { Placement } from './options.ts'
import { spriteFor } from './sprite.js'

/** Rows the band needs: below that it does not show (PLAN §3.4). */
export const BAND_MIN_ROWS = 6
/** In auto, how far under autoMinColumns the terminal may narrow before the band goes. */
export const AUTO_HYSTERESIS = 20

export interface BandRoom {
  placement: Placement
  autoMinColumns: number
  /** `viewport.columns`: the terminal's width, not the band's. */
  columns: number
  /** `AbovePrompt.props.maxRows`. */
  maxRows: number
  /** `AbovePrompt.props.hasSurvey`: a survey holds the band. */
  hasSurvey: boolean
  /** Auto's width state from the last call: whether the terminal counted as wide. */
  wide: boolean
}

export interface BandShow {
  show: boolean
  /** The width state to carry to the next call. */
  wide: boolean
}

/**
 * Whether the band shows. `footer` never, `band` always, `auto` while the
 * terminal is wide: from `autoMinColumns` on, and until it narrows under
 * `autoMinColumns − 20`, so a resize around one width does not flicker it.
 * Only with `maxRows ≥ 6` and no survey, in every placement. The width state
 * is the terminal's alone: a survey or a short band hides the band for a
 * while without resetting it.
 */
export function bandVisibility(room: BandRoom): BandShow {
  const { placement, autoMinColumns, columns, maxRows, hasSurvey } = room
  const floor = room.wide ? autoMinColumns - AUTO_HYSTERESIS : autoMinColumns
  const wide = columns > 0 && columns >= floor
  const fits = maxRows >= BAND_MIN_ROWS && !hasSurvey
  const wanted = placement === 'band' || (placement === 'auto' && wide)
  return { show: fits && wanted, wide }
}

/** The band's sizes, largest first: the footer's three, then the sprite alone. */
export type BandVariant = Variant | 'sprite'

export const BAND_VARIANTS: readonly BandVariant[] = Object.freeze([
  'full',
  'noMeter',
  'modelOnly',
  'sprite',
])

/** Between the sprite and its label. */
const GAP = '  '
/** The label's names, in lowercase and as wide as each other, as on a game's screen. */
const PLAYER = 'player '
const POWER = 'power  '

/** The label's lines in one size: the model, then the effort; none for the sprite alone. */
function labelLines({ model, effort }: BadgeView, variant: BandVariant): Run[][] {
  if (variant === 'sprite') return []
  const player: Run[] = [
    { text: PLAYER, paint: 'dim' },
    { text: model.text, paint: model.enabled ? 'family' : 'dim' },
  ]
  if (variant === 'modelOnly') return [player]
  const power: Run[] = [{ text: POWER, paint: 'dim' }, ...effortRuns(effort, variant === 'full')]
  return [player, power.filter((run) => run.text !== '')]
}

/**
 * The band in one size, row by row as painted runs: the sprite, and beside
 * its middle rows the label, from the same sanitized parts as the footer's
 * badge (badgeState). Nothing else is drawn.
 */
export function bandRows(view: BadgeView, variant: BandVariant): Run[][] {
  const sprite = spriteFor(view)
  // The sprite's first row has nothing beside it: the label sits on the next two.
  const beside: Run[][] = [[], ...labelLines(view, variant)]
  return sprite.rows.map((row, index) => {
    const line = beside.at(index) ?? []
    const head: Run = { text: row, paint: sprite.paint }
    return line.length === 0 ? [head] : [head, { text: GAP, paint: 'dim' }, ...line]
  })
}

/** The columns the band takes in one size: its widest row. */
export function bandWidth(view: BadgeView, variant: BandVariant): number {
  const widths = bandRows(view, variant).map((row) => widthOf(row.map((run) => run.text).join('')))
  return Math.max(0, ...widths)
}

/**
 * The largest size of the band that fits in `bodyColumns`, or 'none'. A size
 * that frees no room is passed over: where the model's line is the longer
 * one, the effort goes with the label.
 */
export function fitBand(view: BadgeView, bodyColumns: number): BandVariant | 'none' {
  return BAND_VARIANTS.find((variant) => bandWidth(view, variant) <= bodyColumns) ?? 'none'
}
