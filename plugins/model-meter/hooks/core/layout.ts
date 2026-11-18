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
