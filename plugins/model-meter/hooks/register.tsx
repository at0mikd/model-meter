// Wiring only (T-003): every decision is in ./core. Each hook observes and
// hands the engine's event on as it came; the badge is drawn on the terminal
// alone, where the app does not already show the model and effort.
//
// No hook holds an event up: its own work starts beside `next(e)`, and the hook
// waits for that work only after the engine has handled the event.

import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, RenderNode } from 'claude-code'

import { badgeRuns, badgeState, badgeVariants, familyColor } from './core/badge.js'
import type { BadgeView, Run } from './core/badge.ts'
import { parseLevel } from './core/effort.js'
import { fitBadge, widthOf, widthOfTree } from './core/layout.js'
import { parseModel } from './core/model.js'
import { sanitize } from './core/sanitize.js'
import { effortState } from './core/state.js'

// The mod's own state (types/index.d.ts); in $.store only the last effort level.
const model = atom({ plugin: 'model-meter', key: 'model' } as const, null)
const step = atom({ plugin: 'model-meter', key: 'step' } as const, null)
const stored = atom({ plugin: 'model-meter', key: 'stored' } as const, null)
const pending = atom({ plugin: 'model-meter', key: 'pending' } as const, null)

// The terminal footer's row: two columns of padding at each end, at least two
// between the hint line and what this site draws, which sits at its right end.
const FOOTER_PADDING = 4
const HINT_GAP = 2
const SEPARATOR = ' · '
// The engine's own node in SessionMode draws the permission modes, joined so.
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
  await Promise.all([
    update($, model, () => id),
    update($, step, () =>
      typeof effort === 'string' || typeof effort === 'number' ? effort : null,
    ),
    update($, pending, () => null),
    // Only a value of the allowlist ever reaches the store.
    level === undefined ? undefined : $.store.set('effort', level),
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

  // The hint line only to measure it (PLAN §3.1): it is drawn as it came.
  on('ui.render', { component: 'PromptHint' }, ($, e, next) => {
    if (e.surface === 'terminal') {
      try {
        const width = widthOf(e.props.hint)
        if (width !== hintColumns) {
          hintColumns = width
          $.ui.invalidate('ui.render')
        }
      } catch {
        // Measuring never touches the line.
      }
    }
    return next(e)
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
        FOOTER_PADDING + HINT_GAP + hintColumns + (below > 0 ? SEPARATOR.length + below : 0)
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
          {badgeRuns(view, variant).map(paint)}
          {below > 0 ? <Text dimColor>{SEPARATOR}</Text> : null}
          {beneath}
        </Box>
      )
    } catch {
      return beneath
    }
  })
}
