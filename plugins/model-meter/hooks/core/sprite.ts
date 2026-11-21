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
