import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { bandVisibility } from '../../plugins/model-meter/hooks/core/band.ts'
import type { BandRoom } from '../../plugins/model-meter/hooks/core/band.ts'
import type { Placement } from '../../plugins/model-meter/hooks/core/options.ts'

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
