import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { badgeState } from '../../plugins/model-meter/hooks/core/badge.ts'
import { widthOf } from '../../plugins/model-meter/hooks/core/layout.ts'
import { SPRITES, SPRITE_SIZE, spriteFor } from '../../plugins/model-meter/hooks/core/sprite.ts'

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
