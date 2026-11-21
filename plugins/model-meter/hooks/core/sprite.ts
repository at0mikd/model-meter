// The band's sprites (docs/PLAN.md §3.2): one per family and one for an
// unknown model, original designs, each an 8×8 grid of pixels drawn as 4 rows
// of half blocks (▀ ▄ █). Constants of the code: nothing in them comes from
// the engine or the person.

import type { BadgeView, Paint } from './badge.ts'
import type { Family } from './model.ts'

/** The size of every sprite, in rows and columns of the terminal. */
export const SPRITE_SIZE = Object.freeze({ rows: 4, columns: 8 })

// Pixels, '#' on and '.' off; two pixel rows make one row of the terminal.
/** Opus: a crown. */
const CROWN = [
  '#..##..#',
  '#..##..#',
  '##.##.##',
  '########',
  '########',
  '#.#..#.#',
  '########',
  '........',
]
/** Sonnet: a quill. */
const QUILL = [
  '....####',
  '...#####',
  '..#####.',
  '..####..',
  '.####...',
  '.##.....',
  '#.......',
  '#.......',
]
/** Haiku: a mountain under the sun. */
const MOUNTAIN = [
  '.....##.',
  '.....##.',
  '...#....',
  '..###...',
  '.#####..',
  '.######.',
  '########',
  '########',
]
/** Fable: a book. */
const BOOK = [
  '........',
  '###..###',
  '#..##..#',
  '########',
  '#..##..#',
  '########',
  '########',
  '........',
]
/** Unknown: an empty cartridge, like the off look of the badge (§3.1.1). */
const CARTRIDGE = [
  '.######.',
  '.#....#.',
  '.#....#.',
  '.#....#.',
  '.######.',
  '.#.##.#.',
  '.######.',
  '........',
]

/** One terminal cell for a pixel above and a pixel below it. */
function cell(top: string, bottom: string): string {
  if (top === '#') return bottom === '#' ? '█' : '▀'
  return bottom === '#' ? '▄' : ' '
}

/** Two rows of pixels as one row of the terminal. */
const rowOf = (top: string, bottom: string): string =>
  Array.from({ length: top.length }, (_, column) =>
    cell(top.charAt(column), bottom.charAt(column)),
  ).join('')

/** An 8×8 grid of pixels as 4 rows of half blocks: each even row over the one after it. */
const halfBlocks = (pixels: readonly string[]): readonly string[] =>
  Object.freeze(
    pixels.flatMap((top, row) =>
      row % 2 === 1 ? [] : [rowOf(top, pixels.slice(row + 1, row + 2).join(''))],
    ),
  )

// Mythos has no sprite of its own yet: it draws as unknown until T-010's sprites land.
export const SPRITES: Readonly<Record<Exclude<Family, 'mythos'>, readonly string[]>> =
  Object.freeze({
    opus: halfBlocks(CROWN),
    sonnet: halfBlocks(QUILL),
    haiku: halfBlocks(MOUNTAIN),
    fable: halfBlocks(BOOK),
    unknown: halfBlocks(CARTRIDGE),
  })

/**
 * How a sprite's three color slots are drawn: three theme keys (never raw
 * colors, so they follow the person's theme), or the off look, every pixel dim.
 */
export type Palette =
  | { readonly kind: 'theme'; readonly slots: readonly [string, string, string] }
  | { readonly kind: 'dim' }

/** One cell of the terminal: its character and the Text props it is drawn with. */
export interface Cell {
  char: ' ' | '▀' | '▄' | '█'
  color?: string
  backgroundColor?: string
  dimColor?: true
}

/** A run of cells of one look, as one Text draws them. */
export interface SpriteRun {
  text: string
  color?: string
  backgroundColor?: string
  dimColor?: true
}

/** A pixel's slot: 1, 2 or 3; 0 for anything else, which is transparent. */
const slotOf = (pixel: string): 0 | 1 | 2 | 3 => {
  if (pixel === '1') return 1
  if (pixel === '2') return 2
  return pixel === '3' ? 3 : 0
}

/** A slot's theme key. */
const colorOf = (slot: 1 | 2 | 3, [one, two, three]: readonly [string, string, string]): string =>
  slot === 1 ? one : slot === 2 ? two : three

/** How one pixel alone is drawn: in its slot's theme key, or dim. */
const inkOf = (slot: 1 | 2 | 3, palette: Palette): { color: string } | { dimColor: true } =>
  palette.kind === 'dim' ? { dimColor: true } : { color: colorOf(slot, palette.slots) }

/**
 * The cell for a pixel above and a pixel below it. Two pixels: the upper
 * half block in the top one's color over the bottom one's as background, or
 * a full block when both are one color. One pixel: its half block, with no
 * background. None: a space. The off look dims every pixel alike, so its
 * cells never need a background.
 */
export function cellOf(top: string, bottom: string, palette: Palette): Cell {
  const up = slotOf(top)
  const down = slotOf(bottom)
  if (up === 0) return down === 0 ? { char: ' ' } : { char: '▄', ...inkOf(down, palette) }
  if (down === 0) return { char: '▀', ...inkOf(up, palette) }
  if (palette.kind === 'dim') return { char: '█', dimColor: true }
  const above = colorOf(up, palette.slots)
  const below = colorOf(down, palette.slots)
  return above === below
    ? { char: '█', color: above }
    : { char: '▀', color: above, backgroundColor: below }
}

/** A cell's look without its character: what two cells must share to join a run. */
const lookOf = ({ color, backgroundColor, dimColor }: Cell): string =>
  [color ?? '', backgroundColor ?? '', dimColor === true ? 'dim' : ''].join('|')

/** A row of cells as runs, the cells of one look joined. */
function runsOf(cells: readonly Cell[]): SpriteRun[] {
  const runs: SpriteRun[] = []
  let last = ''
  for (const cell of cells) {
    const look = lookOf(cell)
    const previous = runs.at(-1)
    if (previous !== undefined && look === last) {
      previous.text += cell.char
    } else {
      const { char, ...props } = cell
      runs.push({ text: char, ...props })
    }
    last = look
  }
  return runs
}

/** A grid of pixels as rows of runs: each even row over the one after it. */
export const spriteRuns = (grid: readonly string[], palette: Palette): SpriteRun[][] =>
  grid.flatMap((top, row) => {
    if (row % 2 === 1) return []
    const bottom = grid.slice(row + 1, row + 2).join('')
    const cells = Array.from({ length: top.length }, (_, column) =>
      cellOf(top.charAt(column), bottom.charAt(column), palette),
    )
    return [runsOf(cells)]
  })

export interface Sprite {
  rows: readonly string[]
  paint: Paint
}

/** A known family's sprite; the unknown one for anything else. */
function spriteOf(family: Family | null): readonly string[] {
  switch (family) {
    case 'opus':
      return SPRITES.opus
    case 'sonnet':
      return SPRITES.sonnet
    case 'haiku':
      return SPRITES.haiku
    case 'fable':
      return SPRITES.fable
    default:
      return SPRITES.unknown
  }
}

/**
 * The sprite for what the badge knows: a known model's family, in its color;
 * the unknown sprite, dimmed, for a model of no known family and for the off
 * state, as the badge dims its name.
 */
export function spriteFor(view: BadgeView): Sprite {
  const { enabled, family } = view.model
  return { rows: spriteOf(enabled ? family : null), paint: enabled ? 'family' : 'dim' }
}
