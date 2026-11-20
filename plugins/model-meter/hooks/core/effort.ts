// Effort levels: an exact allowlist, so what the engine or the person types
// after /effort never reaches the screen; only one of these constants does.

export type Level = 'low' | 'medium' | 'high' | 'xhigh' | 'max'
export type Cells = 1 | 2 | 3 | 4 | 5
// Lowercase, like the rest of the terminal footer (Maintainer, CA7 of T-003).
export type EffortLabel = 'low' | 'med' | 'high' | 'xhi' | 'max'

export const LEVELS: readonly Level[] = Object.freeze(['low', 'medium', 'high', 'xhigh', 'max'])

/** A level, from any value: exact match after trimming, in any case. */
export function parseLevel(value: unknown): Level | undefined {
  if (typeof value !== 'string') return undefined
  const text = value.trim().toLowerCase()
  return LEVELS.find((level) => level === text)
}

/** The level typed after /effort (`/effort high` → `high`), or undefined. */
export function parseEffortArg(args: string): Level | undefined {
  return parseLevel(args)
}

/** How many of the meter's five cells a level fills: low = 1 … max = 5. */
export function effortCells(level: Level): Cells {
  switch (level) {
    case 'low':
      return 1
    case 'medium':
      return 2
    case 'high':
      return 3
    case 'xhigh':
      return 4
    case 'max':
      return 5
  }
}

/** The short label of a level: low, med, high, xhi or max. */
export function effortLabel(level: Level): EffortLabel {
  switch (level) {
    case 'low':
      return 'low'
    case 'medium':
      return 'med'
    case 'high':
      return 'high'
    case 'xhigh':
      return 'xhi'
    case 'max':
      return 'max'
  }
}

export interface EffortDisplay {
  label: EffortLabel | 'custom'
  cells: Cells | null
}

/**
 * What to draw for the effort `turn.step` reports: a level, or a number
 * (internal builds only), shown as custom with no meter, since there is no
 * scale to put it on. Anything else: undefined.
 */
export function effortDisplay(effort: unknown): EffortDisplay | undefined {
  if (typeof effort === 'number') {
    return Number.isFinite(effort) ? { label: 'custom', cells: null } : undefined
  }
  const level = parseLevel(effort)
  return level === undefined ? undefined : { label: effortLabel(level), cells: effortCells(level) }
}
