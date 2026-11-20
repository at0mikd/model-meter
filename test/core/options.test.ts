import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { DEFAULT_OPTIONS, parseOptions } from '../../plugins/model-meter/hooks/core/options.ts'

// T-004 CA1: the options of /config (plugin.json userConfig) are untrusted
// input: what is not on the list or in range takes its default, and nothing throws.
describe('parseOptions', () => {
  test('nothing set: the footer alone, and the band from 140 columns in auto', () => {
    assert.deepEqual(DEFAULT_OPTIONS, { placement: 'footer', autoMinColumns: 140 })
    assert.deepEqual(parseOptions(undefined), DEFAULT_OPTIONS)
    assert.deepEqual(parseOptions({}), DEFAULT_OPTIONS)
  })

  test('valid values stand as they are', () => {
    for (const placement of ['footer', 'auto', 'band']) {
      assert.equal(parseOptions({ placement }).placement, placement)
    }
    for (const autoMinColumns of [80, 120.5, 140, 250, 400]) {
      assert.equal(parseOptions({ autoMinColumns }).autoMinColumns, autoMinColumns)
    }
    assert.deepEqual(parseOptions({ placement: 'auto', autoMinColumns: 160 }), {
      placement: 'auto',
      autoMinColumns: 160,
    })
  })

  test('a placement that is not on the list takes the default', () => {
    for (const placement of ['', 'Auto', ' auto', 'auto ', 'compact', 'footer\u0000', 'BAND']) {
      assert.equal(parseOptions({ placement }).placement, 'footer', JSON.stringify(placement))
    }
  })

  test('a width out of 80–400 takes the default', () => {
    for (const autoMinColumns of [79.9, 401, 0, -140, Number.NaN, Number.POSITIVE_INFINITY]) {
      assert.equal(parseOptions({ autoMinColumns }).autoMinColumns, 140, String(autoMinColumns))
    }
  })

  test('values that are not text or a number take the default', () => {
    for (const value of [1, true, null, ['auto'], { auto: true }, undefined]) {
      assert.equal(parseOptions({ placement: value }).placement, 'footer', JSON.stringify(value))
    }
    for (const value of ['140', '', true, null, [140], { n: 140 }, 140n, undefined]) {
      assert.equal(parseOptions({ autoMinColumns: value }).autoMinColumns, 140, typeof value)
    }
  })

  test('each option stands on its own: a bad one leaves the other as set', () => {
    assert.deepEqual(parseOptions({ placement: 'band', autoMinColumns: 9999 }), {
      placement: 'band',
      autoMinColumns: 140,
    })
    assert.deepEqual(parseOptions({ placement: 'everywhere', autoMinColumns: 100 }), {
      placement: 'footer',
      autoMinColumns: 100,
    })
  })

  test('options that are not a record, or that throw when read, are the defaults', () => {
    for (const raw of [null, 'auto', 42, ['band', 200], () => 'band']) {
      assert.deepEqual(parseOptions(raw), DEFAULT_OPTIONS, String(raw))
    }
    const hostile = {
      get placement(): string {
        throw new Error('injected')
      },
    }
    assert.deepEqual(parseOptions(hostile), DEFAULT_OPTIONS)
  })
})
