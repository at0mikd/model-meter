import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { badgeState } from '../../plugins/model-meter/hooks/core/badge.ts'
import {
  BAND_VARIANTS,
  bandRows,
  bandVisibility,
  bandWidth,
  fitBand,
} from '../../plugins/model-meter/hooks/core/band.ts'
import type { BandRoom, BandRow } from '../../plugins/model-meter/hooks/core/band.ts'
import type { Placement } from '../../plugins/model-meter/hooks/core/options.ts'
import { spriteRunsFor } from '../../plugins/model-meter/hooks/core/sprite.ts'

// T-004 CA2: when the band shows. In auto it comes in at autoMinColumns (140)
// and goes at under autoMinColumns − 20 (120); in between it keeps what it had.
describe('bandVisibility', () => {
  const room = (over: Partial<BandRoom>): BandRoom => ({
    placement: 'auto',
    autoMinColumns: 140,
    columns: 191,
    maxRows: 18,
    hasSurvey: false,
    wide: false,
    ...over,
  })

  const COLUMNS = [95, 119, 120, 139, 140, 191] as const
  // Coming from the band shown (`wide`) or hidden: the widths of COLUMNS at which it shows.
  const table: [placement: Placement, from: 'shown' | 'hidden', shownAt: readonly number[]][] = [
    ['footer', 'hidden', []],
    ['footer', 'shown', []],
    ['band', 'hidden', COLUMNS],
    ['band', 'shown', COLUMNS],
    ['auto', 'hidden', [140, 191]],
    ['auto', 'shown', [120, 139, 140, 191]],
  ]
  for (const [placement, from, shownAt] of table) {
    for (const columns of COLUMNS) {
      const show = shownAt.includes(columns)
      test(`${placement}, ${String(columns)} columns, coming from the band ${from} → ${show ? 'shown' : 'hidden'}`, () => {
        const next = bandVisibility(room({ placement, columns, wide: from === 'shown' }))
        assert.equal(next.show, show)
      })
    }
  }

  test('auto carries its width state from call to call: in at 140, out under 120', () => {
    let wide = false
    const seen: boolean[] = []
    for (const columns of [191, 130, 120, 119, 130, 139, 140, 95]) {
      const next = bandVisibility(room({ columns, wide }))
      wide = next.wide
      seen.push(next.show)
    }
    assert.deepEqual(seen, [true, true, true, false, false, false, true, false])
  })

  test('another autoMinColumns moves both thresholds', () => {
    assert.equal(bandVisibility(room({ autoMinColumns: 100, columns: 100 })).show, true)
    assert.equal(bandVisibility(room({ autoMinColumns: 100, columns: 99 })).show, false)
    assert.equal(bandVisibility(room({ autoMinColumns: 100, columns: 80, wide: true })).show, true)
    assert.equal(bandVisibility(room({ autoMinColumns: 100, columns: 79, wide: true })).show, false)
  })

  test('the sprite needs 6 rows: 5 hides the band, 6 shows it', () => {
    for (const placement of ['auto', 'band'] as const) {
      assert.equal(bandVisibility(room({ placement, maxRows: 5 })).show, false, placement)
      assert.equal(bandVisibility(room({ placement, maxRows: 6 })).show, true, placement)
    }
  })

  test('a survey takes the band: it yields, in every placement', () => {
    for (const placement of ['auto', 'band', 'footer'] as const) {
      assert.equal(bandVisibility(room({ placement, hasSurvey: true })).show, false, placement)
    }
  })

  test('what hides the band for a while does not reset the width state', () => {
    // A survey, or too few rows, at 191: auto still counts the terminal as wide,
    // so at 130 the band is back once they are gone.
    const survey = bandVisibility(room({ columns: 191, hasSurvey: true }))
    assert.deepEqual(survey, { show: false, wide: true })
    assert.equal(bandVisibility(room({ columns: 130, wide: survey.wide })).show, true)
    const short = bandVisibility(room({ columns: 191, maxRows: 5 }))
    assert.deepEqual(short, { show: false, wide: true })
  })

  test('no usable width or rows: auto keeps the band out', () => {
    for (const columns of [0, -1, Number.NaN]) {
      assert.deepEqual(bandVisibility(room({ columns, wide: true })), { show: false, wide: false })
    }
    assert.equal(bandVisibility(room({ maxRows: Number.NaN })).show, false)
  })
})

// T-004 CA4 (core), with T-010's sprites and label: the band beside its
// sprite, and the largest size that fits `bodyColumns`: the meter goes first,
// then the effort, then the label; with no room even for the sprite, no band.
describe('the band in each size', () => {
  const effort = { source: 'step', level: 'high' } as const
  const opus = badgeState({ model: { family: 'opus', label: 'Opus 5.5' }, effort })
  const join = (runs: readonly { text: string }[]) => runs.map((run) => run.text).join('')
  const sprite = (view: typeof opus) => spriteRunsFor(view).map(join)
  const text = (rows: readonly BandRow[]) =>
    rows.map(({ sprite, label }) => join([...sprite, ...label]))

  test('six rows: the sprite, and the label beside its two middle rows, in lowercase but the model', () => {
    const [s0, s1, s2, s3, s4, s5] = sprite(opus)
    assert.deepEqual(text(bandRows(opus, 'full')), [
      s0,
      s1,
      `${String(s2)}  model Opus 5.5`,
      `${String(s3)}  power ▮▮▮▯▯ high`,
      s4,
      s5,
    ])
    assert.deepEqual(text(bandRows(opus, 'noMeter')).slice(2, 4), [
      `${String(s2)}  model Opus 5.5`,
      `${String(s3)}  power high`,
    ])
    assert.deepEqual(text(bandRows(opus, 'modelOnly')).slice(2, 4), [
      `${String(s2)}  model Opus 5.5`,
      s3,
    ])
    assert.deepEqual(text(bandRows(opus, 'sprite')), sprite(opus))
  })

  test("the sprite in its palette; the label painted as the footer's badge", () => {
    const rows = bandRows(opus, 'full')
    assert.deepEqual(
      rows.map((row) => row.sprite),
      spriteRunsFor(opus),
    )
    const [, , model, power] = rows
    assert.deepEqual(model?.label, [
      { text: '  ', paint: 'dim' },
      { text: 'model ', paint: 'dim' },
      { text: 'Opus 5.5', paint: 'family' },
    ])
    assert.deepEqual(power?.label, [
      { text: '  ', paint: 'dim' },
      { text: 'power ', paint: 'dim' },
      { text: '▮▮▮', paint: 'family' },
      { text: '▯▯', paint: 'dim' },
      { text: ' ', paint: 'dim' },
      { text: 'high', paint: 'lit' },
    ])
  })

  test('the off state: the unknown sprite, dimmed, and every part of the label dimmed', () => {
    const off = badgeState({ model: null, effort: { source: 'unknown' } })
    const rows = bandRows(off, 'full')
    assert.deepEqual(text(rows).slice(2, 4), [
      `${String(sprite(off)[2])}  model -----`,
      `${String(sprite(off)[3])}  power ░░░░░ ---`,
    ])
    assert.ok(rows.flatMap((row) => row.label).every((run) => run.paint === 'dim'))
    assert.ok(
      rows.flatMap((row) => row.sprite).every((run) => run.text.trim() === '' || run.dimColor),
    )
  })

  test('a custom effort has no meter: its full size is its size without one', () => {
    const custom = badgeState({
      model: { family: 'opus', label: 'Opus 5.5' },
      effort: { source: 'step', custom: true },
    })
    assert.deepEqual(text(bandRows(custom, 'full')), text(bandRows(custom, 'noMeter')))
  })

  test('each size is the sprite (12), two columns and its longest line', () => {
    assert.deepEqual(BAND_VARIANTS, ['full', 'noMeter', 'modelOnly', 'sprite'])
    assert.equal(bandWidth(opus, 'full'), 12 + 2 + 16) // power ▮▮▮▯▯ high
    assert.equal(bandWidth(opus, 'noMeter'), 12 + 2 + 14) // model Opus 5.5
    assert.equal(bandWidth(opus, 'modelOnly'), 12 + 2 + 14)
    assert.equal(bandWidth(opus, 'sprite'), 12)
  })

  test('narrowing bodyColumns gives up the meter, then the effort and the label, then the band', () => {
    const seen = [186, 90, 30, 29, 28, 27, 12, 11, 0].map((columns) => fitBand(opus, columns))
    assert.deepEqual(seen, [
      'full',
      'full',
      'full',
      'noMeter',
      'noMeter',
      'sprite', // dropping the effort alone frees no room: the label goes with it
      'sprite',
      'none',
      'none',
    ])
  })

  test('where the effort line is the longer one, dropping it shows the model alone', () => {
    const short = badgeState({ model: { family: 'unknown', label: 'x' }, effort })
    // model x (7) under power high (10): 24 without the meter, 21 with the model alone.
    assert.deepEqual(
      [30, 25, 24, 23, 21, 20].map((columns) => fitBand(short, columns)),
      ['full', 'noMeter', 'noMeter', 'modelOnly', 'modelOnly', 'sprite'],
    )
  })

  test('no usable width: no band', () => {
    for (const columns of [Number.NaN, -1, Number.NEGATIVE_INFINITY]) {
      assert.equal(fitBand(opus, columns), 'none', String(columns))
    }
    assert.equal(fitBand(opus, Number.POSITIVE_INFINITY), 'full')
  })
})
