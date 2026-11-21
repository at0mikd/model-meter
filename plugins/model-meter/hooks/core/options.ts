// The options a person sets in /config (plugin.json `userConfig`), read as
// untrusted input (docs/PLAN.md §3.3): a value that is not on the list or in
// range takes its default, nothing throws, and none of it is ever drawn.

/** Where the mod shows: the footer alone, plus the band when wide, or plus the band always. */
export type Placement = 'footer' | 'auto' | 'band'

export const PLACEMENTS: readonly Placement[] = Object.freeze(['footer', 'auto', 'band'])

/** The range `autoMinColumns` must fall in, both ends included. */
export const AUTO_MIN_COLUMNS = Object.freeze({ min: 80, max: 400 })

export interface Options {
  readonly placement: Placement
  /** In `auto`, the terminal width from which the band shows. */
  readonly autoMinColumns: number
}

export const DEFAULT_OPTIONS: Options = Object.freeze({ placement: 'footer', autoMinColumns: 140 })

const isPlacement = (value: unknown): value is Placement =>
  typeof value === 'string' && (PLACEMENTS as readonly string[]).includes(value)

const isMinColumns = (value: unknown): value is number =>
  typeof value === 'number' && value >= AUTO_MIN_COLUMNS.min && value <= AUTO_MIN_COLUMNS.max

/** The two fields, read once; nothing at all from what is not an object or throws when read. */
function fieldsOf(raw: unknown): { placement?: unknown; autoMinColumns?: unknown } {
  if (typeof raw !== 'object' || raw === null) return {}
  try {
    const { placement, autoMinColumns } = raw as Record<string, unknown>
    return { placement, autoMinColumns }
  } catch {
    return {}
  }
}

/** The options as the mod uses them: each one as set when valid, its default otherwise. */
export function parseOptions(raw: unknown): Options {
  const { placement, autoMinColumns } = fieldsOf(raw)
  return {
    placement: isPlacement(placement) ? placement : DEFAULT_OPTIONS.placement,
    autoMinColumns: isMinColumns(autoMinColumns) ? autoMinColumns : DEFAULT_OPTIONS.autoMinColumns,
  }
}
