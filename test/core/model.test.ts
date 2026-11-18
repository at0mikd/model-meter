import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import fc from 'fast-check'

import { FAMILIES, parseModel } from '../../plugins/model-meter/hooks/core/model.ts'

describe('parseModel', () => {
  const cases: [string, string, string][] = [
    // [what the engine reports, family, label]
    ['claude-opus-5-5', 'opus', 'OPUS 5.5'],
    ['claude-fable-5-2', 'fable', 'FABLE 5.2'],
    ['claude-sonnet-5-5', 'sonnet', 'SONNET 5.5'],
    ['claude-haiku-5-5', 'haiku', 'HAIKU 5.5'],
    ['claude-sonnet-5-5[1m]', 'sonnet', 'SONNET 5.5 1M'],
    ['claude-opus-4-1-20250805', 'opus', 'OPUS 4.1'],
    ['claude-sonnet-4-20250514', 'sonnet', 'SONNET 4'],
    ['claude-3-5-sonnet-20241022', 'sonnet', 'SONNET 3.5'],
    ['claude-3-haiku-20240307', 'haiku', 'HAIKU 3'],
    ['us.anthropic.claude-opus-4-1-20250805-v1:0', 'opus', 'OPUS 4.1'],
    ['anthropic.claude-3-5-sonnet-20241022-v2:0', 'sonnet', 'SONNET 3.5'],
    ['global.anthropic.claude-sonnet-4-5-20250929-v1:0', 'sonnet', 'SONNET 4.5'],
    ['claude-opus-4-1@20250805', 'opus', 'OPUS 4.1'],
    ['claude-3-5-sonnet-v2@20241022', 'sonnet', 'SONNET 3.5'],
    ['opus', 'opus', 'OPUS'],
    ['sonnet', 'sonnet', 'SONNET'],
    ['haiku', 'haiku', 'HAIKU'],
    ['fable', 'fable', 'FABLE'],
    ['sonnet[1m]', 'sonnet', 'SONNET 1M'],
    ['  Claude-Opus-5-5  ', 'opus', 'OPUS 5.5'],
  ]
  for (const [id, family, label] of cases) {
    test(`${id.trim()} → ${label}`, () => {
      assert.deepEqual(parseModel(id), { family, label })
    })
  }

  test('anything else is unknown, with a sanitized upper-case label of at most 16', () => {
    assert.deepEqual(parseModel('gpt-x'), { family: 'unknown', label: 'GPT-X' })
    assert.deepEqual(parseModel('my-very-long-custom-model-name'), {
      family: 'unknown',
      label: 'MY-VERY-LONG-CUS',
    })
    assert.deepEqual(parseModel('\u001b[31mevil\u001b[0m\u202e'), {
      family: 'unknown',
      label: 'EVIL',
    })
    assert.deepEqual(parseModel('claude-opus'), { family: 'unknown', label: 'CLAUDE-OPUS' })
    assert.deepEqual(parseModel('claude-opus-123-4'), {
      family: 'unknown',
      label: 'CLAUDE-OPUS-123-',
    })
  })

  test('the longest known label fits in 18 columns', () => {
    assert.deepEqual(parseModel('claude-sonnet-12-34[123k]'), {
      family: 'sonnet',
      label: 'SONNET 12.34 123K',
    })
  })

  test('nothing to show gives "?"', () => {
    assert.deepEqual(parseModel(''), { family: 'unknown', label: '?' })
    assert.deepEqual(parseModel('\u0000\u0007'), { family: 'unknown', label: '?' })
    assert.deepEqual(parseModel(undefined as unknown as string), { family: 'unknown', label: '?' })
  })

  test('property: never throws, always a known family and a safe, short label (1 000 cases)', () => {
    const ids = fc.oneof(
      fc.string({ unit: 'binary' }),
      fc
        .tuple(
          fc.constantFrom('', 'us.anthropic.', 'anthropic.'),
          fc.constantFrom('claude-', 'claude-3-', ''),
          fc.constantFrom(...FAMILIES, 'x'),
          fc.constantFrom(
            '',
            '-5-5',
            '-12-34',
            '-4-1-20250805',
            '@20250805',
            '-v1:0',
            '[1m]',
            '[123k]',
          ),
        )
        .map((parts) => parts.join('')),
    )
    fc.assert(
      fc.property(ids, (id) => {
        const { family, label } = parseModel(id)
        assert.ok((FAMILIES as readonly string[]).includes(family) || family === 'unknown')
        assert.match(label, /^(?:[A-Z0-9.\-[\] @/_]{1,18}|\?)$/)
        if (family === 'unknown') assert.ok(label.length <= 16)
      }),
      { numRuns: 1000 },
    )
  })
})
