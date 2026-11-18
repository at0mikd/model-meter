import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import fc from 'fast-check'

import { sanitize } from '../../plugins/model-meter/hooks/core/sanitize.ts'

const ALLOWED = /^[A-Za-z0-9.\-[\] @/_]*$/

describe('sanitize', () => {
  test('keeps the allowed characters', () => {
    assert.equal(sanitize('claude-opus-5-5[1m]'), 'claude-opus-5-5[1m]')
    assert.equal(sanitize('us.anthropic/x_y @2'), 'us.anthropic/x_y @2')
  })

  test('drops ANSI CSI and OSC sequences whole, not just their escape byte', () => {
    assert.equal(sanitize('\u001b[31mred\u001b[0m'), 'red')
    assert.equal(sanitize('a\u001b]8;;https://x.test\u0007link\u001b]8;;\u0007b'), 'alinkb')
    assert.equal(sanitize('a\u001b]0;title\u001b\\b'), 'ab')
    assert.equal(sanitize('a\u009b2Jb'), 'ab')
    assert.equal(sanitize('a\u001bcb'), 'ab')
    assert.equal(sanitize('a\u001bPq#0;2b\u001b\\c'), 'ac')
  })

  test('an escape sequence left open swallows the rest', () => {
    assert.equal(sanitize('a\u001b]0;never ends'), 'a')
    assert.equal(sanitize('a\u001b[31'), 'a')
    assert.equal(sanitize('a\u001b'), 'a')
  })

  test('drops controls, bidi overrides, zero-width and other non-printables', () => {
    assert.equal(sanitize('a\u0000b\u0007c\u007f'), 'abc')
    assert.equal(sanitize('\u202eevil\u202c'), 'evil')
    assert.equal(sanitize('x\u200by\u2066z\ufeff'), 'xyz')
    assert.equal(sanitize('opus ◆ 5.5 ✓'), 'opus 5.5')
  })

  test('turns line breaks and tabs into spaces, collapses runs and trims', () => {
    assert.equal(sanitize('  a\t\tb\n\nc  '), 'a b c')
    assert.equal(sanitize('a \u001b[1m b'), 'a b')
  })

  test('cuts to max and never ends on a space', () => {
    assert.equal(sanitize('a'.repeat(40)), 'a'.repeat(32))
    assert.equal(sanitize('abcd efgh', 5), 'abcd')
    assert.equal(sanitize('abc', 0), '')
    assert.equal(sanitize('abc', -3), '')
    assert.equal(sanitize('abcdef', 2.9), 'ab')
    assert.equal(sanitize('abc', Number.NaN), '')
  })

  test('never throws on what the engine might hand over at run time', () => {
    const values: unknown[] = [undefined, null, 42, {}, ['a'], Symbol('s')]
    for (const value of values) {
      assert.equal(sanitize(value as string), '')
    }
  })

  test('property: any input gives allowed characters only, within max (1 000 cases)', () => {
    const noisy = fc
      .array(
        fc.oneof(
          fc.string({ unit: 'binary' }),
          fc.constantFrom('\u001b[31m', '\u001b]8;;x\u0007', '\u202e', '\u0000', '\u009b', '\n'),
        ),
      )
      .map((parts) => parts.join(''))
    fc.assert(
      fc.property(noisy, fc.integer({ min: -5, max: 64 }), (text, max) => {
        const out = sanitize(text, max)
        assert.match(out, ALLOWED)
        assert.ok(out.length <= Math.max(0, max))
        assert.equal(out, out.trim())
        assert.ok(!out.includes('  '))
      }),
      { numRuns: 1000 },
    )
  })
})
