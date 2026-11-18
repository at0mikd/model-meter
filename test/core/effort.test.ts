import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import fc from 'fast-check'

import {
  LEVELS,
  effortCells,
  effortDisplay,
  effortLabel,
  parseEffortArg,
  parseLevel,
} from '../../plugins/model-meter/hooks/core/effort.ts'

describe('LEVELS', () => {
  test('lists the five levels in order and cannot be changed', () => {
    assert.deepEqual(LEVELS, ['low', 'medium', 'high', 'xhigh', 'max'])
    assert.ok(Object.isFrozen(LEVELS))
  })
})

describe('parseLevel', () => {
  test('accepts exactly the levels, any case, after trimming', () => {
    assert.equal(parseLevel('high'), 'high')
    assert.equal(parseLevel(' XHigh \n'), 'xhigh')
    assert.equal(parseLevel('MAX'), 'max')
  })

  test('rejects everything else, of any type', () => {
    for (const value of [
      '',
      'hi',
      'higher',
      'x high',
      'medium-ish',
      3,
      null,
      undefined,
      {},
      ['low'],
    ]) {
      assert.equal(parseLevel(value), undefined, JSON.stringify(value))
    }
  })
})

describe('parseEffortArg', () => {
  test('what follows /effort: a level, or nothing', () => {
    assert.equal(parseEffortArg('high'), 'high')
    assert.equal(parseEffortArg('  Low '), 'low')
    assert.equal(parseEffortArg(''), undefined)
    assert.equal(parseEffortArg('high please'), undefined)
    assert.equal(parseEffortArg('\u001b[31mhigh'), undefined)
  })

  test('property: never returns text of its own, only a level or undefined (1 000 cases)', () => {
    const args = fc.oneof(
      fc.string({ unit: 'binary' }),
      fc.constantFrom(...LEVELS).map((level) => ` ${level.toUpperCase()} `),
    )
    fc.assert(
      fc.property(args, (text) => {
        const level = parseEffortArg(text)
        assert.ok(level === undefined || LEVELS.includes(level))
      }),
      { numRuns: 1000 },
    )
  })
})

describe('effortCells and effortLabel', () => {
  test('low is one cell and max is five; labels fit in three or four columns', () => {
    assert.deepEqual(
      LEVELS.map((level) => [effortCells(level), effortLabel(level)]),
      [
        [1, 'LOW'],
        [2, 'MED'],
        [3, 'HIGH'],
        [4, 'XHI'],
        [5, 'MAX'],
      ],
    )
  })
})

describe('effortDisplay', () => {
  test('a level shows its label and cells', () => {
    assert.deepEqual(effortDisplay('medium'), { label: 'MED', cells: 2 })
  })

  test('a numeric effort (internal builds) is CUSTOM, with no invented scale', () => {
    assert.deepEqual(effortDisplay(42), { label: 'CUSTOM', cells: null })
    assert.deepEqual(effortDisplay(0), { label: 'CUSTOM', cells: null })
  })

  test('anything else has nothing to show', () => {
    for (const value of [undefined, 'turbo', Number.NaN, Infinity, null, {}]) {
      assert.equal(effortDisplay(value), undefined, typeof value)
    }
  })
})
