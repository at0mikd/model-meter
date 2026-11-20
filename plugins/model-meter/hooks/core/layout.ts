// How wide things are in the footer, and which badge size fits the room left
// (docs/PLAN.md §3.1): full → noMeter → modelOnly → none.

export type Variant = 'full' | 'noMeter' | 'modelOnly'

/** The badge sizes, largest first: the order fitBadge tries them in. */
export const VARIANTS: readonly Variant[] = Object.freeze(['full', 'noMeter', 'modelOnly'])

type Range = readonly [from: number, to: number]

/** Code points that take no column: joiners and marks, variation selectors, BOM. */
const ZERO_WIDTH: readonly Range[] = [
  [0x200b, 0x200f],
  [0x2060, 0x2064],
  [0xfe00, 0xfe0f],
  [0xfeff, 0xfeff],
  [0xe0100, 0xe01ef],
]
/** Code points that take two columns: CJK, Hangul, fullwidth forms and emoji. */
const WIDE: readonly Range[] = [
  [0x1100, 0x115f],
  [0x2e80, 0x303e],
  [0x3041, 0x33ff],
  [0x3400, 0x4dbf],
  [0x4e00, 0x9fff],
  [0xa000, 0xa4cf],
  [0xac00, 0xd7a3],
  [0xf900, 0xfaff],
  [0xfe30, 0xfe4f],
  [0xff00, 0xff60],
  [0xffe0, 0xffe6],
  [0x1f300, 0x1f64f],
  [0x1f900, 0x1f9ff],
  [0x20000, 0x3fffd],
]
const COMBINING = /\p{M}/u

const within = (code: number, ranges: readonly Range[]): boolean =>
  ranges.some(([from, to]) => code >= from && code <= to)

/** Columns one code point takes: 0, 1 or 2. */
function columnsOf(char: string): 0 | 1 | 2 {
  const code = Number(char.codePointAt(0))
  if (code < 0x20 || (code >= 0x7f && code < 0xa0)) return 0
  if (within(code, ZERO_WIDTH) || COMBINING.test(char)) return 0
  return within(code, WIDE) ? 2 : 1
}

/**
 * How many terminal columns `text` takes: one per character, none for
 * controls and zero-width code points, two for wide ones. Meant for sanitized
 * text, our glyphs (◆ ▮ ▯ · …) and the engine's hints; it errs wide.
 */
export function widthOf(text: string): number {
  if (typeof text !== 'string') return 0
  let width = 0
  for (const char of text) width += columnsOf(char)
  return width
}

/** Deeper than any footer drawing; past it a tree stops counting rather than recursing on. */
const MAX_DEPTH = 64

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

/**
 * How many columns a drawing takes on one row, read structurally (no engine
 * types): a string as widthOf measures it, an element as the sum of its
 * children, a Button as `[ label ]`, and the engine's own node as
 * `engineWidth`, since it draws the mode labels the caller measures apart.
 * Anything that is not a drawing measures 0.
 */
export function widthOfTree(node: unknown, engineWidth = 0, depth = 0): number {
  if (typeof node === 'string') return widthOf(node)
  if (!isRecord(node) || typeof node.type !== 'string' || depth > MAX_DEPTH) return 0
  if (node.type === 'engine') return engineWidth
  if (node.type === 'Button') {
    const label = isRecord(node.props) ? node.props.label : undefined
    return typeof label === 'string' ? widthOf(label) + 4 : 0
  }
  const { children } = node
  if (!Array.isArray(children)) return 0
  return children.reduce<number>(
    (sum, child) => sum + widthOfTree(child, engineWidth, depth + 1),
    0,
  )
}

/**
 * How many columns the hint line takes as drawn, read from `next.trace` (the
 * links beneath the hook, the engine's last): the hint and tail the engine's
 * own link received, or what a link beneath returned when it drew the line
 * itself. Another mod may have trimmed the hint on its way down (`sub-meter`
 * hides `(shift+tab to cycle)`), whether it sits above or beneath this one.
 * When the trace does not say, the hint as `received`, as much as before
 * (docs/spikes/T-003b-results.md, P1).
 */
export function drawnHintWidth(received: string, trace: readonly unknown[]): number {
  const last = trace.at(-1)
  // The engine's link is the pair (plugin "engine", tier "core"): a plugin
  // that happens to be named "engine" sits in another tier.
  if (isRecord(last) && last.plugin === 'engine' && last.tier === 'core') {
    const props = isRecord(last.received) ? last.received.props : undefined
    if (isRecord(props) && typeof props.hint === 'string') {
      const { hint, tail } = props
      // One column before the tail is an assumption, not measured (no tail
      // was seen in T-003b): it can only reserve one column too many.
      return widthOf(hint) + (typeof tail === 'string' && tail !== '' ? 1 + widthOf(tail) : 0)
    }
  } else if (isRecord(last) && last.outcome === 'returned') {
    return widthOfTree(last.returned)
  }
  return widthOf(received)
}

export interface FitInput {
  /** `viewport.columns` of the footer row. */
  columns: number
  /** What the row already holds: margins, mode label, hints and what is beneath. */
  reserved: number
  /** The badge text in each size. */
  variants: Readonly<Record<Variant, string>>
}

/** The largest badge that fits in `columns − reserved`, or 'none'. */
export function fitBadge({ columns, reserved, variants }: FitInput): Variant | 'none' {
  const room = (n: number) => (Number.isFinite(n) ? Math.max(0, n) : Number.NaN)
  const left = room(columns) - room(reserved)
  if (!(left > 0)) return 'none'
  const sizes: readonly [Variant, string][] = [
    ['full', variants.full],
    ['noMeter', variants.noMeter],
    ['modelOnly', variants.modelOnly],
  ]
  return sizes.find(([, text]) => widthOf(text) <= left)?.[0] ?? 'none'
}
