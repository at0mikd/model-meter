import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { badgeState } from '../../plugins/model-meter/hooks/core/badge.ts'
import { widthOf } from '../../plugins/model-meter/hooks/core/layout.ts'
import {
  SPRITES,
  SPRITE_SIZE,
  cellOf,
  spriteFor,
  spriteRuns,
} from '../../plugins/model-meter/hooks/core/sprite.ts'
import type { Palette } from '../../plugins/model-meter/hooks/core/sprite.ts'

const KINDS = ['opus', 'sonnet', 'haiku', 'fable', 'unknown'] as const
const BY_KIND = new Map(Object.entries(SPRITES))
const sprites = KINDS.map((kind) => [kind, BY_KIND.get(kind) ?? []] as const)

// T-004 CA3: one original sprite per family, and the unknown one, all of one size.
describe('the sprites', () => {
  test('one per family and the unknown one, all 4 rows of 8 columns, the most the band takes', () => {
    assert.deepEqual(SPRITE_SIZE, { rows: 4, columns: 8 })
    assert.deepEqual(Object.keys(SPRITES).sort(), [...KINDS].sort())
    for (const [kind, rows] of sprites) {
      assert.equal(rows.length, SPRITE_SIZE.rows, kind)
      for (const row of rows) assert.equal(widthOf(row), SPRITE_SIZE.columns, `${kind}: "${row}"`)
    }
  })

  test('only half blocks, full blocks and spaces', () => {
    for (const [kind, rows] of sprites) {
      for (const row of rows) assert.match(row, /^[ ▀▄█]+$/u, `${kind}: "${row}"`)
      assert.ok(rows.join('').trim() !== '', `${kind} draws something`)
    }
  })

  test('the five differ from one another', () => {
    const drawn = new Set(sprites.map(([, rows]) => rows.join('\n')))
    assert.equal(drawn.size, KINDS.length)
  })

  test('as drawn: a crown, a quill, a mountain with its sun, a book and an empty cartridge', () => {
    assert.deepEqual(SPRITES, {
      opus: ['█  ██  █', '██▄██▄██', '█▀█▀▀█▀█', '▀▀▀▀▀▀▀▀'],
      sonnet: ['   ▄████', '  ████▀ ', ' ██▀▀   ', '█       '],
      haiku: ['     ██ ', '  ▄█▄   ', ' █████▄ ', '████████'],
      fable: ['▄▄▄  ▄▄▄', '█▄▄██▄▄█', '█▄▄██▄▄█', '▀▀▀▀▀▀▀▀'],
      unknown: [' █▀▀▀▀█ ', ' █    █ ', ' █▀██▀█ ', ' ▀▀▀▀▀▀ '],
    })
  })
})

describe('spriteFor', () => {
  const effort = { source: 'step', level: 'high' } as const

  test("a known model: its family's sprite, in the family's color", () => {
    for (const family of ['opus', 'sonnet', 'haiku', 'fable'] as const) {
      const view = badgeState({ model: { family, label: 'X 1' }, effort })
      assert.deepEqual(spriteFor(view), { rows: BY_KIND.get(family), paint: 'family' }, family)
    }
  })

  test('the off state (§3.1.1): the unknown sprite, dimmed', () => {
    const view = badgeState({ model: null, effort: { source: 'unknown' } })
    assert.equal(view.state, 'disabled')
    assert.deepEqual(spriteFor(view), { rows: SPRITES.unknown, paint: 'dim' })
  })

  test('a model of no known family: the unknown sprite, dimmed as its name is', () => {
    const view = badgeState({ model: { family: 'unknown', label: 'mystery' }, effort })
    assert.deepEqual(spriteFor(view), { rows: SPRITES.unknown, paint: 'dim' })
  })
})

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
