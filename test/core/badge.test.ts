import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import {
  FAMILY_COLOR,
  SLOT,
  familyColor,
  slotWidth,
  badgeRuns,
  badgeState,
  badgeVariants,
} from '../../plugins/model-meter/hooks/core/badge.ts'
import type { BadgeView } from '../../plugins/model-meter/hooks/core/badge.ts'
import { VARIANTS, widthOf } from '../../plugins/model-meter/hooks/core/layout.ts'
import { parseModel } from '../../plugins/model-meter/hooks/core/model.ts'
import type { ModelView } from '../../plugins/model-meter/hooks/core/model.ts'
import { effortState } from '../../plugins/model-meter/hooks/core/state.ts'
import type { EffortView } from '../../plugins/model-meter/hooks/core/state.ts'

const MODELS = new Map<string, ModelView | null>([
  ['known', parseModel('claude-opus-5-5')], // OPUS 5.5
  ['unknown', parseModel('gpt-x')], // family unknown, label GPT-X
  ['unread', null], // $.session.model() has not answered yet
])
const EFFORTS = new Map<string, EffortView>([
  ['step', effortState({ step: 'high' })],
  ['pending', effortState({ step: 'high', pending: { args: 'low' } })],
  ['stored', effortState({ stored: 'medium' })],
  ['unknown', effortState({})],
  ['custom', effortState({ step: 42 })],
])

type Expected = Pick<BadgeView, 'state'> & {
  model: [enabled: boolean, glyph: string, text: string]
  effort: [enabled: boolean, cells: string, text: string]
}

// docs/PLAN.md §3.1.1, every model × effort combination (CA1b).
const TABLE: [model: string, effort: string, expected: Expected][] = [
  [
    'known',
    'step',
    { state: 'active', model: [true, '◆', 'OPUS 5.5'], effort: [true, '▮▮▮▯▯', 'HIGH'] },
  ],
  [
    'known',
    'pending',
    { state: 'active', model: [true, '◆', 'OPUS 5.5'], effort: [false, '▮▯▯▯▯', 'LOW…'] },
  ],
  [
    'known',
    'stored',
    { state: 'partial', model: [true, '◆', 'OPUS 5.5'], effort: [false, '▮▮▯▯▯', 'MED'] },
  ],
  [
    'known',
    'unknown',
    { state: 'partial', model: [true, '◆', 'OPUS 5.5'], effort: [false, '░░░░░', '---'] },
  ],
  [
    'known',
    'custom',
    { state: 'active', model: [true, '◆', 'OPUS 5.5'], effort: [true, '', 'CUSTOM'] },
  ],
  [
    'unknown',
    'step',
    { state: 'partial', model: [false, '?', 'GPT-X'], effort: [true, '▮▮▮▯▯', 'HIGH'] },
  ],
  [
    'unknown',
    'pending',
    { state: 'partial', model: [false, '?', 'GPT-X'], effort: [false, '▮▯▯▯▯', 'LOW…'] },
  ],
  [
    'unknown',
    'stored',
    { state: 'partial', model: [false, '?', 'GPT-X'], effort: [false, '▮▮▯▯▯', 'MED'] },
  ],
  [
    'unknown',
    'unknown',
    { state: 'disabled', model: [false, '?', 'GPT-X'], effort: [false, '░░░░░', '---'] },
  ],
  [
    'unknown',
    'custom',
    { state: 'partial', model: [false, '?', 'GPT-X'], effort: [true, '', 'CUSTOM'] },
  ],
  [
    'unread',
    'step',
    { state: 'partial', model: [false, '◇', '?'], effort: [true, '▮▮▮▯▯', 'HIGH'] },
  ],
  [
    'unread',
    'pending',
    { state: 'partial', model: [false, '◇', '?'], effort: [false, '▮▯▯▯▯', 'LOW…'] },
  ],
  [
    'unread',
    'stored',
    { state: 'partial', model: [false, '◇', '?'], effort: [false, '▮▮▯▯▯', 'MED'] },
  ],
  [
    'unread',
    'unknown',
    { state: 'disabled', model: [false, '◇', '-----'], effort: [false, '░░░░░', '---'] },
  ],
  [
    'unread',
    'custom',
    { state: 'partial', model: [false, '◇', '?'], effort: [true, '', 'CUSTOM'] },
  ],
]

const view = (model: string, effort: string): BadgeView => {
  const m = MODELS.get(model)
  const e = EFFORTS.get(effort)
  assert.ok(m !== undefined && e !== undefined)
  return badgeState({ model: m, effort: e })
}

describe('badgeState: every model × effort (docs/PLAN.md §3.1.1)', () => {
  for (const [model, effort, expected] of TABLE) {
    test(`model ${model} × effort ${effort} → ${expected.state}`, () => {
      const got = view(model, effort)
      assert.equal(got.state, expected.state)
      assert.deepEqual([got.model.enabled, got.model.glyph, got.model.text], expected.model)
      assert.deepEqual([got.effort.enabled, got.effort.cells, got.effort.text], expected.effort)
    })
  }

  test('a pending /effort with nothing known yet is off, marked pending', () => {
    const got = badgeState({
      model: MODELS.get('known') ?? null,
      effort: effortState({ pending: { args: '' } }),
    })
    assert.equal(got.state, 'partial')
    assert.deepEqual(
      [got.effort.enabled, got.effort.cells, got.effort.text],
      [false, '░░░░░', '---…'],
    )
  })

  test('the meter fills one cell per level, from low to max', () => {
    const cells = (['low', 'medium', 'high', 'xhigh', 'max'] as const).map(
      (step) =>
        badgeState({ model: MODELS.get('known') ?? null, effort: effortState({ step }) }).effort,
    )
    assert.deepEqual(
      cells.map(({ cells: c, filled }) => [c, filled]),
      [
        ['▮▯▯▯▯', 1],
        ['▮▮▯▯▯', 2],
        ['▮▮▮▯▯', 3],
        ['▮▮▮▮▯', 4],
        ['▮▮▮▮▮', 5],
      ],
    )
  })

  test('familyColor: the theme key of a known family, none otherwise', () => {
    assert.deepEqual(
      (['opus', 'sonnet', 'haiku', 'fable', 'unknown', null] as const).map(familyColor),
      ['claude', 'suggestion', 'success', 'merged', undefined, undefined],
    )
  })

  test('the family is kept for its color, and only known families have one', () => {
    assert.equal(view('known', 'step').model.family, 'opus')
    assert.equal(view('unknown', 'step').model.family, 'unknown')
    assert.equal(view('unread', 'step').model.family, null)
    assert.deepEqual(FAMILY_COLOR, {
      opus: 'claude',
      sonnet: 'suggestion',
      haiku: 'success',
      fable: 'merged',
    })
  })
})

describe('badgeVariants and badgeRuns', () => {
  test('active, the badge reads as in docs/PLAN.md §3.1, padded on the left to its slot', () => {
    const variants = badgeVariants(view('known', 'step'))
    assert.equal(variants.full.trimStart(), '◆ OPUS 5.5 ▮▮▮▯▯ HIGH')
    assert.equal(variants.noMeter.trimStart(), '◆ OPUS 5.5 HIGH')
    assert.equal(variants.modelOnly.trimStart(), '◆ OPUS 5.5')
  })

  test('all off, it is the empty cartridge slot', () => {
    const variants = badgeVariants(view('unread', 'unknown'))
    assert.equal(variants.full.trimStart(), '◇ ----- ░░░░░ ---')
    assert.equal(variants.modelOnly.trimStart(), '◇ -----')
  })

  test('a custom effort has no meter', () => {
    assert.equal(badgeVariants(view('known', 'custom')).full.trimStart(), '◆ OPUS 5.5 CUSTOM')
  })

  test('CA1b: each variant measures its slot whatever is lit, so the badge never jumps', () => {
    const views = [
      ...TABLE.map(
        ([model, effort]) => [`model ${model} × effort ${effort}`, view(model, effort)] as const,
      ),
      ...['claude-sonnet-5-5', 'claude-haiku-5-5', 'claude-fable-5-2'].map(
        (name) =>
          [
            name,
            badgeState({ model: parseModel(name), effort: effortState({ step: 'high' }) }),
          ] as const,
      ),
    ]
    for (const [name, badge] of views) {
      const variants = badgeVariants(badge)
      assert.deepEqual(
        VARIANTS.map((variant) =>
          widthOf(
            badgeRuns(badge, variant)
              .map((run) => run.text)
              .join(''),
          ),
        ),
        VARIANTS.map((variant) => slotWidth(variant)),
        name,
      )
      assert.deepEqual(
        [widthOf(variants.full), widthOf(variants.noMeter), widthOf(variants.modelOnly)],
        [SLOT.full, SLOT.noMeter, SLOT.modelOnly],
        name,
      )
    }
  })

  test('a label longer than its slot is drawn whole, never cut', () => {
    const long = badgeVariants(
      badgeState({
        model: parseModel('claude-sonnet-12-34[123k]'),
        effort: effortState({ step: 'high' }),
      }),
    )
    assert.equal(long.modelOnly, '◆ SONNET 12.34 123K')
    assert.ok(widthOf(long.full) > SLOT.full)
  })

  test('runs: lit parts take the family color, the rest is dim, and they spell the variant', () => {
    const lit = view('known', 'step')
    const runs = badgeRuns(lit, 'full')
    assert.equal(runs.map((run) => run.text).join(''), badgeVariants(lit).full)
    const paints = runs.filter((run) => run.text.trim() !== '').map((run) => [run.text, run.paint])
    assert.deepEqual(paints, [
      ['◆ OPUS 5.5', 'family'],
      ['▮▮▮', 'family'],
      ['▯▯', 'dim'],
      ['HIGH', 'lit'],
    ])
    const off = badgeRuns(view('unread', 'unknown'), 'full')
    assert.ok(off.every((run) => run.paint === 'dim'))
  })

  test('runs: a stored or pending effort is dim, meter and text', () => {
    for (const effort of ['stored', 'pending']) {
      const runs = badgeRuns(view('known', effort), 'full').filter((run) => run.text.trim() !== '')
      assert.deepEqual(
        runs.slice(1).map((run) => run.paint),
        ['dim', 'dim'],
        effort,
      )
    }
  })
})
