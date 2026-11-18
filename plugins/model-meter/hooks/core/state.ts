// Which effort to show, and why (docs/PLAN.md §2.4, decisions 1 and 3):
// pending after /effort → the last turn.step → what $.store kept → unknown.

import { parseEffortArg, parseLevel } from './effort.js'
import type { Level } from './effort.ts'

export interface EffortInput {
  /** `e.effort` of the last main-thread `turn.step`: a level, or a number in internal builds. */
  step?: unknown
  /** What `$.store` returned for the last known level: validated here, never trusted. */
  stored?: unknown
  /** Set after a `command.run` for /effort, until the next `turn.step`: what was typed after it. */
  pending?: { args: unknown } | null | undefined
}

export interface EffortView {
  level?: Level
  custom?: boolean
  source: 'step' | 'stored' | 'pending' | 'unknown'
}

type Known = Pick<EffortView, 'level' | 'custom'>

const isCustom = (step: unknown): boolean => typeof step === 'number' && Number.isFinite(step)

/** The effort to show; never throws, whatever the hooks pass at run time. */
export function effortState({ step, stored, pending }: EffortInput): EffortView {
  const stepLevel = parseLevel(step)
  const storedLevel = parseLevel(stored)
  let known: Known = {}
  if (stepLevel !== undefined) known = { level: stepLevel }
  else if (isCustom(step)) known = { custom: true }
  else if (storedLevel !== undefined) known = { level: storedLevel }

  if (pending !== undefined && pending !== null) {
    const typed = parseEffortArg(typeof pending.args === 'string' ? pending.args : '')
    return typed === undefined
      ? { ...known, source: 'pending' }
      : { level: typed, source: 'pending' }
  }
  if (stepLevel !== undefined || isCustom(step)) return { ...known, source: 'step' }
  if (storedLevel !== undefined) return { level: storedLevel, source: 'stored' }
  return { source: 'unknown' }
}
