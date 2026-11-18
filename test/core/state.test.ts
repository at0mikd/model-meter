import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { effortState } from '../../plugins/model-meter/hooks/core/state.ts'

describe('effortState: the cascade of docs/PLAN.md §2.4', () => {
  describe('1. pending (after /effort) wins', () => {
    test('with a valid level in args, it shows that level', () => {
      assert.deepEqual(effortState({ step: 'low', stored: 'max', pending: { args: 'HIGH' } }), {
        level: 'high',
        source: 'pending',
      })
    })

    test('with empty or invalid args, it keeps the last known level from step', () => {
      for (const args of ['', 'turbo', 'high please']) {
        assert.deepEqual(effortState({ step: 'low', stored: 'max', pending: { args } }), {
          level: 'low',
          source: 'pending',
        })
      }
    })

    test('… or from stored when no step has happened yet', () => {
      assert.deepEqual(effortState({ stored: 'max', pending: { args: '' } }), {
        level: 'max',
        source: 'pending',
      })
    })

    test('… or a custom effort when the last step was numeric', () => {
      assert.deepEqual(effortState({ step: 7, pending: { args: '' } }), {
        custom: true,
        source: 'pending',
      })
    })

    test('… or nothing known yet', () => {
      assert.deepEqual(effortState({ pending: { args: '' } }), { source: 'pending' })
    })
  })

  describe('2. otherwise, the last main-thread turn.step', () => {
    test('a level', () => {
      assert.deepEqual(effortState({ step: 'xhigh', stored: 'low' }), {
        level: 'xhigh',
        source: 'step',
      })
    })

    test('a number (internal builds) is custom', () => {
      assert.deepEqual(effortState({ step: 42, stored: 'low' }), { custom: true, source: 'step' })
    })
  })

  describe('3. otherwise, what $.store kept, validated', () => {
    test('a valid level', () => {
      assert.deepEqual(effortState({ stored: 'medium' }), { level: 'medium', source: 'stored' })
      assert.deepEqual(effortState({ step: 'turbo', stored: 'medium' }), {
        level: 'medium',
        source: 'stored',
      })
    })

    test('a corrupt or unexpected value is unknown', () => {
      for (const stored of ['turbo', 3, null, {}, ['high'], { level: 'high' }]) {
        assert.deepEqual(effortState({ stored }), { source: 'unknown' }, JSON.stringify(stored))
      }
    })
  })

  describe('4. otherwise, unknown', () => {
    test('nothing at all', () => {
      assert.deepEqual(effortState({}), { source: 'unknown' })
    })
  })

  test('never throws on whatever the hooks pass at run time', () => {
    const odd: unknown[] = [undefined, null, 'x', 5, { args: 5 }, { args: null }, []]
    for (const pending of odd) {
      for (const step of [undefined, Number.NaN, Infinity, 'max', {}]) {
        assert.doesNotThrow(() =>
          effortState({ step, stored: Symbol('s'), pending } as unknown as Parameters<
            typeof effortState
          >[0]),
        )
      }
    }
    assert.deepEqual(effortState({ step: Number.NaN }), { source: 'unknown' })
    assert.deepEqual(effortState({ pending: { args: 5 } }), { source: 'pending' })
  })
})
