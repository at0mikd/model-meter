import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { isDependabotBump } from './commitlint-ignores.mjs'
import dependabotCommit from './fixtures/dependabot-bump-3b10c21.json' with { type: 'json' }

const TRAILER = 'Signed-off-by: dependabot[bot] <support@github.com>'
/** @param {string} subject @param {string} [trailer] */
const commit = (subject, trailer = TRAILER) => `${subject}\n\nBumps the thing.\n\n${trailer}\n`

describe('isDependabotBump (T-008)', () => {
  test('a Dependabot bump with its trailer is ignored: npm, grouped, actions and the CLI', () => {
    for (const subject of [
      'chore(deps-dev): Bump @types/node from 22.20.5 to 26.6.6',
      'chore(deps-dev): Bump the dev-dependencies group with 3 updates',
      'chore(deps): Bump picomatch from 4.0.2 to 4.0.3',
      'ci(deps): Bump actions/checkout from 6.0.0 to 7.0.1',
      'ci(deps): Bump @anthropic-ai/claude-code from 2.1.327 to 2.1.328 in /tools/claude-cli',
    ]) {
      assert.equal(isDependabotBump(commit(subject)), true, subject)
    }
  })

  test("Dependabot's subject without its trailer is linted as any other", () => {
    assert.equal(isDependabotBump('chore(deps-dev): Bump @types/node from 1 to 2\n'), false)
  })

  test("the trailer with someone else's subject is linted as any other", () => {
    assert.equal(isDependabotBump(commit('docs: Update readme')), false)
  })

  test('another type or scope, or a Bump of nothing, is linted as any other', () => {
    for (const subject of [
      'feat(deps): Bump x from 1 to 2',
      'chore(deps-prod): Bump x from 1 to 2',
      'chore(deps): Bump',
      'chore(deps): Bump ',
      'chore(deps):  Bump x',
      'chore(deps): bump x from 1 to 2',
      ' chore(deps): Bump x',
    ]) {
      assert.equal(isDependabotBump(commit(subject)), false, JSON.stringify(subject))
    }
  })

  test("a trailer that is not exactly Dependabot's does not count", () => {
    const subject = 'chore(deps): Bump x from 1 to 2'
    for (const trailer of [
      'Signed-off-by: dependabot[bot] <someone@example.com>',
      'Signed-off-by: dependabot <support@github.com>',
      'Signed-off-by: dependabot[bot] <support@github.com> and more',
      `  ${TRAILER}`,
    ]) {
      assert.equal(isDependabotBump(commit(subject, trailer)), false, trailer)
    }
  })

  test('nothing, or anything that is not a message, is not a bump', () => {
    for (const message of ['', '\n', undefined, null, 42]) {
      assert.equal(isDependabotBump(message), false, String(message))
    }
  })

  test('the real message of 3b10c21 (PR #8), which failed subject-case, is ignored', () => {
    const { message } = dependabotCommit
    assert.ok(message.startsWith('chore(deps-dev): Bump @types/node'))
    assert.equal(isDependabotBump(message), true)
  })

  test('a message with Windows line ends reads the same', () => {
    const message = commit('chore(deps): Bump x from 1 to 2').replaceAll('\n', '\r\n')
    assert.equal(isDependabotBump(message), true)
  })
})
