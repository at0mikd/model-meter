import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { badgeState } from '../../plugins/model-meter/hooks/core/badge.ts'
import { widthOf } from '../../plugins/model-meter/hooks/core/layout.ts'
import { FAMILIES } from '../../plugins/model-meter/hooks/core/model.ts'
import {
  GRIDS,
  PALETTES,
  SPRITE_CELLS,
  cellOf,
  spriteRuns,
  spriteRunsFor,
} from '../../plugins/model-meter/hooks/core/sprite.ts'
import type { Palette } from '../../plugins/model-meter/hooks/core/sprite.ts'

// T-010 CA3: two rows of pixels make one row of cells. A cell is the upper
// half block in the top pixel's color over the bottom pixel's as background;
// one pixel alone, a half block with no background; none, a space.
describe('cellOf', () => {
  const opus: Palette = { kind: 'theme', slots: ['claude', 'warning', 'error'] }
  const off: Palette = { kind: 'dim' }

  test('the four pairs of two pixels, in theme keys', () => {
    assert.deepEqual(cellOf('.', '.', opus), { char: ' ' })
    assert.deepEqual(cellOf('1', '.', opus), { char: '▀', color: 'claude' })
    assert.deepEqual(cellOf('.', '2', opus), { char: '▄', color: 'warning' })
    assert.deepEqual(cellOf('2', '3', opus), {
      char: '▀',
      color: 'warning',
      backgroundColor: 'error',
    })
  })

  test('two pixels of one color are a full block, with no background', () => {
    assert.deepEqual(cellOf('3', '3', opus), { char: '█', color: 'error' })
    const twoSlotsOneKey: Palette = { kind: 'theme', slots: ['claude', 'claude', 'text'] }
    assert.deepEqual(cellOf('1', '2', twoSlotsOneKey), { char: '█', color: 'claude' })
  })

  test('the off look dims every pixel alike, so it never needs a background', () => {
    assert.deepEqual(cellOf('.', '.', off), { char: ' ' })
    assert.deepEqual(cellOf('1', '.', off), { char: '▀', dimColor: true })
    assert.deepEqual(cellOf('.', '3', off), { char: '▄', dimColor: true })
    assert.deepEqual(cellOf('1', '3', off), { char: '█', dimColor: true })
  })

  test('anything that is not a slot is transparent', () => {
    for (const pixel of ['', ' ', '0', '4', 'x', '#']) {
      assert.deepEqual(cellOf(pixel, pixel, opus), { char: ' ' }, JSON.stringify(pixel))
    }
  })
})

describe('spriteRuns', () => {
  const palette: Palette = { kind: 'theme', slots: ['claude', 'warning', 'error'] }

  test('each two rows of pixels make one row, with the cells of one look joined', () => {
    const grid = ['.11.22', '.11.23', '1....3', '1....3']
    assert.deepEqual(spriteRuns(grid, palette), [
      [
        { text: ' ' },
        { text: '██', color: 'claude' },
        { text: ' ' },
        { text: '█', color: 'warning' },
        { text: '▀', color: 'warning', backgroundColor: 'error' },
      ],
      [{ text: '█', color: 'claude' }, { text: '    ' }, { text: '█', color: 'error' }],
    ])
  })

  test('the off look joins its dim cells, and keeps spaces apart', () => {
    assert.deepEqual(spriteRuns(['11.1', '1..1'], { kind: 'dim' }), [
      [{ text: '█▀', dimColor: true }, { text: ' ' }, { text: '█', dimColor: true }],
    ])
  })

  test('an odd last row is read over nothing', () => {
    assert.deepEqual(spriteRuns(['1.', '.1', '22'], palette), [
      // Cells of one look join whatever their character.
      [{ text: '▀▄', color: 'claude' }],
      [{ text: '▀▀', color: 'warning' }],
    ])
  })
})

// T-010 CA2: the 12×12 sprites of the task, as they are, and their palettes.
describe('the 12×12 sprites', () => {
  const BY_FAMILY = new Map(Object.entries(GRIDS))
  const PALETTE_OF = new Map(Object.entries(PALETTES))
  const FAMILIES_AND_UNKNOWN = ['opus', 'sonnet', 'haiku', 'fable', 'mythos', 'unknown'] as const

  test('one per family and the unknown one, each 12 rows of 12 pixels: 6 rows of 12 cells', () => {
    assert.deepEqual(Object.keys(GRIDS).sort(), [...FAMILIES_AND_UNKNOWN].sort())
    assert.deepEqual(SPRITE_CELLS, { rows: 6, columns: 12 })
    for (const [family, grid] of Object.entries(GRIDS)) {
      assert.equal(grid.length, 12, family)
      for (const row of grid) assert.equal(row.length, 12, `${family}: "${row}"`)
      const drawn = spriteRuns(grid, { kind: 'dim' })
      assert.equal(drawn.length, SPRITE_CELLS.rows, family)
      for (const row of drawn) {
        assert.equal(widthOf(row.map((run) => run.text).join('')), SPRITE_CELLS.columns, family)
      }
    }
  })

  test('three color slots at most, and transparency', () => {
    for (const [family, grid] of Object.entries(GRIDS)) {
      for (const row of grid) assert.match(row, /^[.123]{12}$/, `${family}: "${row}"`)
    }
  })

  test('the six differ from one another', () => {
    assert.equal(new Set(Object.values(GRIDS).map((grid) => grid.join('\n'))).size, 6)
  })

  test("the grids are the task's, pixel for pixel", () => {
    assert.deepEqual(GRIDS, {
      opus: [
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
      ],
      sonnet: [
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
      ],
      haiku: [
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
      ],
      fable: [
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
      ],
      mythos: [
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
      ],
      unknown: [
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
      ],
    })
  })

  // Review of #27 (Maintainer, 2026-11-21): in themes that follow the terminal's
  // ANSI palette the theme keys collided (claude and error alike, warning lime),
  // so each sprite's identity colors are fixed; the light detail stays `text`.
  test("the palettes are the Maintainer's: fixed colors, the theme's text for detail; the unknown one dim", () => {
    assert.deepEqual(PALETTES, {
      opus: { kind: 'theme', slots: ['#d77757', '#f2c94c', '#e0115f'] },
      sonnet: { kind: 'theme', slots: ['#b1b9f9', '#f2c94c', 'text'] },
      haiku: { kind: 'theme', slots: ['#4eba65', '#f2c94c', 'text'] },
      fable: { kind: 'theme', slots: ['#af87ff', '#d77757', 'text'] },
      mythos: { kind: 'theme', slots: ['#48968c', '#f2c94c', 'text'] },
      unknown: { kind: 'dim' },
    })
  })

  test('every color is a lowercase #rrggbb, or a theme key the CLI knows', () => {
    // RenderPropsOf's ThemeKey in the CLI's types (2.1.327 and later).
    const THEME_KEYS = [
      'text',
      'inverseText',
      'inactive',
      'subtle',
      'suggestion',
      'remember',
      'success',
      'error',
      'warning',
      'merged',
      'claude',
      'permission',
      'planMode',
      'autoAccept',
      'promptBorder',
      'bashBorder',
      'ide',
      'diffAdded',
      'diffRemoved',
      'diffAddedDimmed',
      'diffRemovedDimmed',
      'diffAddedWord',
      'diffRemovedWord',
    ]
    for (const [family, palette] of Object.entries(PALETTES)) {
      if (palette.kind !== 'theme') continue
      for (const slot of palette.slots) {
        assert.ok(/^#[0-9a-f]{6}$/.test(slot) || THEME_KEYS.includes(slot), `${family}: ${slot}`)
      }
    }
  })

  test("Opus's ruby is not its cup's color, and each sprite's three slots differ", () => {
    const opus = PALETTE_OF.get('opus')
    assert.ok(opus?.kind === 'theme')
    assert.notEqual(opus.slots[2], opus.slots[0])
    for (const [family, palette] of Object.entries(PALETTES)) {
      if (palette.kind === 'theme') assert.equal(new Set(palette.slots).size, 3, family)
    }
  })

  test("spriteFor: a known model's sprite in its palette; the unknown one dimmed otherwise", () => {
    const effort = { source: 'step', level: 'high' } as const
    for (const family of FAMILIES) {
      const view = badgeState({ model: { family, label: 'X 1' }, effort })
      const grid = BY_FAMILY.get(family) ?? []
      const palette = PALETTE_OF.get(family) ?? { kind: 'dim' }
      assert.deepEqual(spriteRunsFor(view), spriteRuns(grid, palette), family)
    }
    const dimmed = spriteRuns(GRIDS.unknown, { kind: 'dim' })
    const off = badgeState({ model: null, effort: { source: 'unknown' } })
    assert.equal(off.state, 'disabled')
    assert.deepEqual(spriteRunsFor(off), dimmed)
    const stranger = badgeState({ model: { family: 'unknown', label: 'mystery' }, effort })
    assert.deepEqual(spriteRunsFor(stranger), dimmed)
    assert.ok(
      dimmed.flat().every((run) => run.text.trim() === '' || run.dimColor === true),
      'every pixel of the unknown sprite is dim',
    )
  })
})
