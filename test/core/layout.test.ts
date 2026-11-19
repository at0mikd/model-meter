import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import {
  VARIANTS,
  fitBadge,
  widthOf,
  widthOfTree,
} from '../../plugins/model-meter/hooks/core/layout.ts'
import type { Variant } from '../../plugins/model-meter/hooks/core/layout.ts'

describe('widthOf', () => {
  test('one column per sanitized character and per glyph of ours', () => {
    assert.equal(widthOf('Opus 5.5'), 8)
    assert.equal(widthOf('◆ Opus 5.5 ▮▮▯▯▯ med'), 20)
    assert.equal(widthOf('⏵⏵ auto mode on'), 15)
    assert.equal(widthOf('1 shell · ↓ to manage'), 21)
    assert.equal(widthOf('…'), 1)
  })

  test('variation selectors, zero-width and control characters take no columns', () => {
    assert.equal(widthOf('◆\ufe0f'), 1)
    assert.equal(widthOf('a\u200bb\u200d\ufeffc'), 3)
    assert.equal(widthOf('a\u0000\u001b\u007fb'), 2)
    assert.equal(widthOf('e\u0301'), 1)
  })

  test('wide characters take two columns', () => {
    assert.equal(widthOf('模型'), 4)
    assert.equal(widthOf('🎮'), 2)
    assert.equal(widthOf('ｗ'), 2)
  })

  test('nothing to measure is zero', () => {
    assert.equal(widthOf(''), 0)
    assert.equal(widthOf(undefined as unknown as string), 0)
  })
})

describe('fitBadge', () => {
  // The badge in its three sizes (docs/PLAN.md §3.1): 20, 14 and 8 columns.
  const variants: Record<Variant, string> = {
    full: '◆ Opus 5.5 ▮▮▯▯▯ med',
    noMeter: '◆ Opus 5.5 med',
    modelOnly: 'Opus 5.5',
  }
  const MARGINS = 4
  const MODE = '⏵⏵ auto mode on'

  /** What the footer row already holds: margins, the mode label, the hints and what is beneath. */
  const reserved = (hint: string, below: number) => MARGINS + widthOf(MODE) + widthOf(hint) + below

  test('tries the variants from the largest down, in a fixed order', () => {
    assert.deepEqual(VARIANTS, ['full', 'noMeter', 'modelOnly'])
  })

  const table: [columns: number, hint: string, below: number, expected: Variant | 'none'][] = [
    // Half screen (T-000: 95 columns) and full screen (191).
    [95, '', 0, 'full'],
    [95, '1 shell · ↓ to manage', 0, 'full'],
    [95, 'esc to interrupt', 0, 'full'],
    [95, '', 30, 'full'],
    [95, '1 shell · ↓ to manage', 30, 'full'],
    [95, 'esc to interrupt', 30, 'full'],
    [191, '', 0, 'full'],
    [191, '1 shell · ↓ to manage', 30, 'full'],
    [191, 'esc to interrupt', 30, 'full'],
    // Narrower rows, where the dynamic hint decides (95 - 4 - 15 - 21 - 30 = 25 above).
    [84, '1 shell · ↓ to manage', 30, 'noMeter'], // 14 left
    [80, '1 shell · ↓ to manage', 30, 'modelOnly'], // 10 left
    [80, 'esc to interrupt', 30, 'noMeter'], // 15 left
    [74, 'esc to interrupt', 30, 'modelOnly'], // 9 left
    [74, '', 30, 'full'], // 25 left
    [70, '1 shell · ↓ to manage', 30, 'none'], // 0 left
    [70, '1 shell · ↓ to manage', 0, 'full'], // 30 left
  ]
  for (const [columns, hint, below, expected] of table) {
    test(`${String(columns)} columns, hint "${hint}", ${String(below)} beneath → ${expected}`, () => {
      assert.equal(fitBadge({ columns, reserved: reserved(hint, below), variants }), expected)
    })
  }

  test('a variant fits when it uses exactly the space left', () => {
    assert.equal(fitBadge({ columns: 28, reserved: 8, variants }), 'full')
    assert.equal(fitBadge({ columns: 27, reserved: 8, variants }), 'noMeter')
  })

  test('room left, but not even for the model name, draws nothing', () => {
    assert.equal(fitBadge({ columns: 10, reserved: 3, variants }), 'none')
  })

  test('no usable width draws nothing', () => {
    for (const [columns, reserved] of [
      [0, 0],
      [10, 20],
      [Number.NaN, 0],
      [80, Number.POSITIVE_INFINITY],
      [-5, -100],
    ] as const) {
      assert.equal(
        fitBadge({ columns, reserved, variants }),
        'none',
        `${String(columns)}/${String(reserved)}`,
      )
    }
  })
})

describe('widthOfTree', () => {
  test('a string measures as widthOf does', () => {
    assert.equal(widthOfTree('5h ━━━━ 58%'), 11)
  })

  test('an element adds up its children, nested', () => {
    const tree = {
      type: 'Box',
      props: { flexDirection: 'row' },
      children: [
        { type: 'Text', props: { dimColor: true }, children: ['5h'] },
        { type: 'Text', children: [' ━━━━━━', { type: 'Text', children: ['────'] }] },
        ' 58%',
      ],
    }
    assert.equal(widthOfTree(tree), 2 + 7 + 4 + 4)
  })

  test("the engine's own node counts as the width the caller gives (it draws the mode labels)", () => {
    const beneath = {
      type: 'Box',
      children: [{ type: 'Text', children: ['meter'] }, ' · ', { type: 'engine', ref: 1 }],
    }
    assert.equal(widthOfTree(beneath), 5 + 3)
    assert.equal(widthOfTree(beneath, 15), 5 + 3 + 15)
  })

  test('a button draws its label between "[ " and " ]"', () => {
    assert.equal(widthOfTree({ type: 'Button', props: { key: 'go', label: 'go' } }), 6)

    assert.equal(widthOfTree({ type: 'Button' }), 0)
    assert.equal(widthOfTree({ type: 'Button', props: { label: 5 } }), 0)
  })

  test('nothing, or anything that is not a drawing, measures 0', () => {
    for (const node of [
      undefined,
      null,
      false,
      42,
      {},
      { type: 'Box', children: 'x' },
      { children: [] },
    ]) {
      assert.equal(widthOfTree(node), 0, JSON.stringify(node))
    }
    assert.equal(
      widthOfTree({ type: 'Box', children: [null, undefined, { type: 'Text', children: ['ab'] }] }),
      2,
    )
  })

  test('a tree nested deeper than any drawing stops counting instead of recursing forever', () => {
    let node: unknown = 'x'
    for (let i = 0; i < 200; i += 1) node = { type: 'Box', children: [node] }
    assert.equal(widthOfTree(node), 0)
  })
})
