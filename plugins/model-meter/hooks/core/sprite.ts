// The band's sprites (docs/PLAN.md §3.2; T-010): one per family and one for
// an unknown model, original 8-bit designs of 12×12 pixels in three colors
// and transparency, drawn as 6 rows of 12 half-block cells. Constants of the
// code: nothing in them comes from the engine or the person.

import type { BadgeView } from './badge.ts'
import type { Family } from './model.ts'

/**
 * How a sprite's three color slots are drawn: three colors the engine turns
 * into the terminal's (a fixed `#rrggbb` or a theme key; never an escape
 * sequence of ours), or the off look, every pixel dim.
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
const styleOf = ({ color, backgroundColor, dimColor }: Cell): string =>
  [color ?? '', backgroundColor ?? '', dimColor === true ? 'dim' : ''].join('|')

/** A row of cells as runs, the cells of one look joined. */
function runsOf(cells: readonly Cell[]): SpriteRun[] {
  const runs: SpriteRun[] = []
  let last = ''
  for (const cell of cells) {
    const look = styleOf(cell)
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

// The grids, as the Maintainer chose them (docs/tasks/T-010-sprites-mythos.md):
// `.` is transparent, `1`, `2` and `3` the palette's slots.

/** The size of every sprite in cells of the terminal. */
export const SPRITE_CELLS = Object.freeze({ rows: 6, columns: 12 })

/** Opus: a chalice with a ruby set in gold. */
const CHALICE = [
  '............',
  '.2222222222.',
  '.2112332112.',
  '.2112332112.',
  '..21122112..',
  '...222222...',
  '.....22.....',
  '.....22.....',
  '....2222....',
  '.....22.....',
  '...222222...',
  '..22222222..',
]
/** Sonnet: a quill. */
const QUILL = [
  '........111.',
  '.......11113',
  '......1.113.',
  '.....11113..',
  '....1.113...',
  '...11113....',
  '...1.13.....',
  '...113......',
  '....3.......',
  '...3........',
  '..22........',
  '.2..........',
]
/** Haiku: a mountain under the sun. */
const MOUNTAIN = [
  '......2..2..',
  '.......22...',
  '......2222..',
  '......2222..',
  '.......22...',
  '....3.2..2..',
  '...333......',
  '..33133.....',
  '..1111113.3.',
  '.11111111313',
  '.11111111111',
  '111111111111',
]
/** Fable: a Greek papyrus scroll, as Aesop's fables were. */
const SCROLL = [
  '............',
  '.2........2.',
  '232111111232',
  '231111111132',
  '231313313132',
  '231111111132',
  '231331331132',
  '231111111132',
  '231313133132',
  '232111111232',
  '.2........2.',
  '............',
]
/** Mythos: a winged helmet. */
const HELMET = [
  '....2222....',
  '...222222...',
  '...111111...',
  '..13333331..',
  '2.11111111.2',
  '221......122',
  '2.111..111.2',
  '.2111..1112.',
  '..111..111..',
  '...11..11...',
  '............',
  '............',
]
/** Unknown: an empty cartridge, like the off look of the badge (§3.1.1). */
const CARTRIDGE = [
  '............',
  '.1111111111.',
  '.1333333331.',
  '.13......31.',
  '.13......31.',
  '.1333333331.',
  '.1111111111.',
  '.1.1.11.1.1.',
  '.1111111111.',
  '............',
  '............',
  '............',
]

export const GRIDS: Readonly<Record<Family, readonly string[]>> = Object.freeze({
  opus: CHALICE,
  sonnet: QUILL,
  haiku: MOUNTAIN,
  fable: SCROLL,
  mythos: HELMET,
  unknown: CARTRIDGE,
})

const theme = (one: string, two: string, three: string): Palette =>
  Object.freeze({ kind: 'theme', slots: Object.freeze([one, two, three] as const) })

/**
 * Each sprite's slots. The identity colors are fixed, so a sprite looks as
 * designed whatever the theme: in themes that follow the terminal's ANSI
 * palette the theme keys collided (claude and error alike, warning lime).
 * The light detail, slot 3, stays the theme's `text`, which is light on dark
 * and dark on light; Opus's ruby aside. The unknown one is dim. Maintainer's
 * decision, 2026-11-21 (review of #27).
 */
export const PALETTES: Readonly<Record<Family, Palette>> = Object.freeze({
  opus: theme('#d77757', '#f2c94c', '#e0115f'), // cup, gold, ruby
  sonnet: theme('#b1b9f9', '#f2c94c', 'text'),
  haiku: theme('#4eba65', '#f2c94c', 'text'),
  fable: theme('#af87ff', '#d77757', 'text'), // papyrus, rollers, writing
  mythos: theme('#48968c', '#f2c94c', 'text'),
  unknown: Object.freeze({ kind: 'dim' }),
})

/** A known family's grid and palette; the unknown ones for anything else. */
function spriteOf(family: Family | null): { grid: readonly string[]; palette: Palette } {
  switch (family) {
    case 'opus':
      return { grid: GRIDS.opus, palette: PALETTES.opus }
    case 'sonnet':
      return { grid: GRIDS.sonnet, palette: PALETTES.sonnet }
    case 'haiku':
      return { grid: GRIDS.haiku, palette: PALETTES.haiku }
    case 'fable':
      return { grid: GRIDS.fable, palette: PALETTES.fable }
    case 'mythos':
      return { grid: GRIDS.mythos, palette: PALETTES.mythos }
    default:
      return { grid: GRIDS.unknown, palette: PALETTES.unknown }
  }
}

/**
 * The sprite for what the badge knows, as rows of runs: a known model's in
 * its family's palette; the unknown one, dimmed, for a model of no known
 * family and for the off state, as the badge dims its name.
 */
export function spriteRunsFor(view: BadgeView): SpriteRun[][] {
  const { enabled, family } = view.model
  const { grid, palette } = spriteOf(enabled ? family : null)
  return spriteRuns(grid, palette)
}
