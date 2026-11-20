// Wiring only (T-003): every decision is in ./core. Each hook observes and
// hands the engine's event on as it came; the badge is drawn on the terminal
// alone, where the app does not already show the model and effort.
//
// The engine always handles an event first: work that needs the event done (a
// session start, a /clear, a /model) runs after `next(e)`; work that can run
// alongside it (recording a turn, a pending /effort) starts beside `next(e)` and
// is only awaited once the engine has answered.

import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, RenderNode } from 'claude-code'

import { badgeRuns, badgeState, badgeVariants, familyColor } from './core/badge.js'
import type { BadgeView, Run } from './core/badge.ts'
import { parseLevel } from './core/effort.js'
import { drawnHintWidth, fitBadge, widthOf, widthOfTree } from './core/layout.js'
import { parseModel } from './core/model.js'
import { sanitize } from './core/sanitize.js'
import { effortState } from './core/state.js'

// The mod's own state (types/index.d.ts); in $.store only the last effort level.
const model = atom({ plugin: 'model-meter', key: 'model' } as const, null)
const step = atom({ plugin: 'model-meter', key: 'step' } as const, null)
const stored = atom({ plugin: 'model-meter', key: 'stored' } as const, null)
const pending = atom({ plugin: 'model-meter', key: 'pending' } as const, null)

// The terminal footer's row: two columns of padding at each end; at the left,
// the permission mode's label and the hint line after it; at the right, this
// site; at least two columns between them.
const FOOTER_PADDING = 4
const HINT_GAP = 2
const SEPARATOR = ' · '
// No site exposes the permission mode's label: room for the longest one.
// Classic events carry permission_mode, but shift+tab changes it with no event
// at all and its cycle may hold bypassPermissions (T-003b, P3), so a narrower
// label could be wrong until the next prompt and split the row (P4).
const MODE_LABEL = widthOf('⏵⏵ bypass permissions on ·')
// The engine's own node in SessionMode draws its mode labels (`focus`,
// `memory paused`), joined so.
const MODES_JOIN = ' & '
// What was typed after /effort is kept only for parseEffortArg: a level at most.
const ARGS_MAX = 16

/** Reads the model and the stored level afresh: a new session, or a /clear. */
async function begin($: EngineInterface): Promise<void> {
  const [id, kept] = await Promise.all([
    $.session.model().catch(() => null),
    $.store.get('effort').catch(() => undefined),
  ])
  await Promise.all([
    // A model that could not be read keeps whatever a turn.step already said.
    update($, model, (current) => id ?? current),
    update($, step, () => null),
    update($, stored, () => parseLevel(kept) ?? null),
    update($, pending, () => null),
  ])
}

/** A main-thread turn.step: the model and effort really sent; /effort is no longer pending. */
async function observeStep($: EngineInterface, id: string, effort: unknown): Promise<void> {
  const level = parseLevel(effort)
  const kept = level === undefined ? undefined : await read($, stored)
  await Promise.all([
    update($, model, () => id),
    update($, step, () =>
      typeof effort === 'string' || typeof effort === 'number' ? effort : null,
    ),
    update($, pending, () => null),
    // Only a value of the allowlist reaches the store, and only when it changes.
    level === undefined || level === kept
      ? undefined
      : Promise.all([$.store.set('effort', level), update($, stored, () => level)]),
  ])
}

/** The badge as it stands: what is known, read through the core. */
async function currentView($: EngineInterface): Promise<BadgeView> {
  const [id, last, kept, typed] = await Promise.all([
    read($, model),
    read($, step),
    read($, stored),
    read($, pending),
  ])
  return badgeState({
    model: id === null ? null : parseModel(id),
    effort: effortState({ step: last, stored: kept, pending: typed }),
  })
}

export const register: Register = (on) => {
  // Columns of the hint line as last drawn on the terminal. Not $.state: the
  // engine refuses a state write while a ui.render hook draws, and the hint is
  // only seen there. A change redraws the footer through $.ui.invalidate.
  let hintColumns = 0

  on('session.start', async ($, e, next) => {
    const result = await next(e)
    if (e.isInteractive) await begin($).catch(() => undefined)
    return result
  })

  // A /clear starts a new conversation in the same process: the model may stay,
  // the last turn's effort and a pending /effort do not.
  on('classic.SessionStart', async ($, e, next) => {
    const result = await next(e)
    try {
      if (e.source === 'clear') await begin($)
    } catch {
      // The session starts whatever happens here.
    }
    return result
  }).catch(($, e, next) => next(e))

  // Recorded as the turn starts, without holding its stream up.
  on('turn.step', async function* ($, e, next) {
    const observed =
      e.agentId === undefined ? observeStep($, e.model, e.effort).catch(() => undefined) : undefined
    const result = yield* next(e)
    await observed
    return result
  })

  // /model: refresh once the change has gone through (PLAN §2.4, decision 2).
  on('config.set', { key: 'model' }, async ($, e, next) => {
    const result = await next(e)
    try {
      const id = await $.session.model()
      await update($, model, () => id)
    } catch {
      // The change already went through; the badge catches up on the next turn.
    }
    return result
  }).catch(($, e, next) => next(e))

  // /effort: pending until the next turn.step confirms it (decision 3). The
  // typed text is only ever read by parseEffortArg.
  on('command.run', { command: 'effort' }, async ($, e, next) => {
    let marked: Promise<unknown> = Promise.resolve()
    try {
      marked = update($, pending, () => ({ args: sanitize(e.args, ARGS_MAX) })).catch(
        () => undefined,
      )
    } catch {
      // The command goes on whatever happens here.
    }
    const result = await next(e)
    await marked
    return result
  }).catch(($, e, next) => next(e))

  // The hint line only to measure it (PLAN §3.1): it is drawn as it came. It
  // is measured as drawn, from what the engine's own link received, so a mod
  // that trims it on its way down (sub-meter) leaves that room to the badge,
  // above this mod or beneath it (T-003b).
  on('ui.render', { component: 'PromptHint' }, async ($, e, next) => {
    const result = await next(e)
    if (e.surface === 'terminal') {
      try {
        const width = drawnHintWidth(e.props.hint, next.trace)
        if (width !== hintColumns) {
          hintColumns = width
          $.ui.invalidate('ui.render')
        }
      } catch {
        // Measuring never touches the line.
      }
    }
    return result
  })

  // The badge, then what is beneath it (the engine's mode labels, other mods),
  // in the largest size the row has room for; nothing of it otherwise.
  on('ui.render', { component: 'SessionMode' }, async ($, e, next) => {
    if (e.surface !== 'terminal') return next(e)
    const [beneath, view] = await Promise.all([next(e), currentView($).catch(() => undefined)])
    if (view === undefined) return beneath
    try {
      const below = widthOfTree(beneath, widthOf(e.props.modes.join(MODES_JOIN)))
      const reserved =
        FOOTER_PADDING +
        MODE_LABEL +
        (hintColumns > 0 ? 1 + hintColumns : 0) +
        HINT_GAP +
        (below > 0 ? SEPARATOR.length + below : 0)
      const variant = fitBadge({
        columns: e.viewport?.columns ?? 0,
        reserved,
        variants: badgeVariants(view),
      })
      if (variant === 'none') return beneath
      const { Box, Text } = $.ui.resolve(e)
      const color = familyColor(view.model.family)
      const paint = (run: Run): RenderNode => {
        if (run.paint === 'dim' || (run.paint === 'family' && color === undefined)) {
          return <Text dimColor>{run.text}</Text>
        }
        return run.paint === 'family' ? (
          <Text color={color}>{run.text}</Text>
        ) : (
          <Text>{run.text}</Text>
        )
      }
      return (
        <Box flexDirection="row">
          {badgeRuns(view, variant, below > 0 ? 'left' : 'right').map(paint)}
          {below > 0 ? <Text dimColor>{SEPARATOR}</Text> : null}
          {beneath}
        </Box>
      )
    } catch {
      return beneath
    }
  })
}
