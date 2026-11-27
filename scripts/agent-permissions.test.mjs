// The agents' permission rules (T-017, audit N5 and N9), checked against a
// model of Claude Code's documented Bash rule matching
// (https://code.claude.com/docs/en/permissions): deny, then allow, else a
// prompt; a rule with no `*` matches one exact command; `*` matches any text,
// spaces included; a trailing ` *` that is the rule's only wildcard also
// matches the bare command. This is a model, not the engine: the pull request
// carries the real sessions' transcripts. It keeps the lists honest between
// those runs.

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, test } from 'node:test'

/** @type {unknown} */
const PARSED = JSON.parse(readFileSync('.claude/settings.json', 'utf8'))
const SETTINGS = /** @type {{ permissions: { allow: string[], deny: string[] } }} */ (PARSED)
const { allow: ALLOW, deny: DENY } = SETTINGS.permissions

/** @param {string} text */
const escape = (text) => text.replace(/[.+?^${}()|[\]\\]/g, '\\$&')

/**
 * A Bash rule's pattern as a regular expression, as the docs describe it.
 *
 * @param {string} rule
 */
function bashPattern(rule) {
  const match = /^Bash\((.*)\)$/s.exec(rule)
  assert.ok(match?.[1] !== undefined, rule)
  const pattern = match[1]
  const wildcards = pattern.split('*').length - 1
  if (wildcards === 1 && pattern.endsWith(' *')) {
    // eslint-disable-next-line security/detect-non-literal-regexp -- built from the repository's own rules
    return new RegExp(`^${escape(pattern.slice(0, -2))}(?: .*)?$`, 's')
  }
  // eslint-disable-next-line security/detect-non-literal-regexp -- built from the repository's own rules
  return new RegExp(`^${pattern.split('*').map(escape).join('.*')}$`, 's')
}

const DENY_BASH = DENY.filter((r) => r.startsWith('Bash(')).map(bashPattern)
const ALLOW_BASH = ALLOW.map(bashPattern)

/**
 * What the rules decide for one simple command.
 *
 * @param {string} command
 * @returns {'deny' | 'allow' | 'prompt'}
 */
function decide(command) {
  if (DENY_BASH.some((p) => p.test(command))) return 'deny'
  if (ALLOW_BASH.some((p) => p.test(command))) return 'allow'
  return 'prompt'
}

/**
 * @param {readonly string[]} commands
 * @param {'deny' | 'allow' | 'prompt' | 'not deny'} expected
 */
function expectAll(commands, expected) {
  for (const command of commands) {
    const got = decide(command)
    if (expected === 'not deny') assert.notEqual(got, 'deny', command)
    else assert.equal(got, expected, command)
  }
}

describe('the matcher model', () => {
  test('follows the documented examples', () => {
    assert.ok(bashPattern('Bash(npm run check)').test('npm run check'))
    assert.ok(!bashPattern('Bash(npm run check)').test('npm run check --watch'))
    assert.ok(bashPattern('Bash(ls *)').test('ls'))
    assert.ok(bashPattern('Bash(ls *)').test('ls -la'))
    assert.ok(!bashPattern('Bash(ls *)').test('lsof'))
    assert.ok(bashPattern('Bash(git log * main)').test('git log --oneline main'))
    assert.ok(!bashPattern('Bash(git log * main)').test('git log main'))
  })
})

describe('N5: the Builder allow list holds exact commands', () => {
  test('every allow rule is exact, except git commit -m', () => {
    const wild = ALLOW.filter((rule) => rule.includes('*'))
    assert.deepEqual(wild, ['Bash(git commit -m *)'])
  })

  test("the Builder's normal flow runs without a prompt", () => {
    expectAll(
      [
        'npm run check',
        'npm run check:core',
        'npm ci --ignore-scripts',
        'git status',
        'git diff --stat',
        'git fetch origin main',
        'git add -A',
        'git commit -m "fix(x): a subject" -m "A body." -m "Co-Authored-By: x"',
        'git push -u origin HEAD',
        'git push origin HEAD',
      ],
      'allow',
    )
  })

  test('the same commands with other arguments prompt', () => {
    expectAll(
      [
        'git fetch upstream',
        'git fetch origin some/ref',
        'git switch some/branch',
        'npm run anything-else',
        'npm ci',
        'node --test some.test.mjs',
        'npx tsc -p x',
        'git diff --word-diff',
        'git log -1 --format=%H',
        'git add some/file',
        'git push -u origin some/branch',
      ],
      'prompt',
    )
  })

  test('the commit rule takes a message, and options that read a file list are denied', () => {
    expectAll(['git commit -m x -m y'], 'allow')
    expectAll(['git commit -F some/file', 'git commit --amend'], 'prompt')
    expectAll(
      [
        'git commit -m x --pathspec-from-file=some/file',
        'git commit -m x --pathspec-fr some/file',
        'git add --pathspec-from-file=some/file',
      ],
      'deny',
    )
  })
})

describe("N9: the Reviewer's writes", () => {
  const REPO = 'repos/at0mikd/model-meter'
  const SHA = 'c0c15d2a1b6cbc1cdc772ca21e524c87e7fb0de8'

  test('the writes the Reviewer needs are not denied', () => {
    expectAll(
      [
        `gh api ${REPO}/issues/40/comments -F body=@/tmp/review-40.md`,
        `gh api -X PUT ${REPO}/pulls/40/merge -f merge_method=squash -f sha=${SHA} -f commit_title="fix(x): y (#40)"`,
        `gh api ${REPO}/pulls -f title=x -f head=claude/topic -f base=main -F body=@/tmp/pr.md`,
        `gh api -X PATCH ${REPO}/pulls/40 -F body=@/tmp/pr.md`,
        `gh api -X PUT ${REPO}/pulls/40/update-branch -f expected_head_sha=${SHA}`,
        `gh api -X POST ${REPO}/actions/runs/123/rerun-failed-jobs`,
        'git push -u origin claude/topic',
        'git push',
      ],
      'not deny',
    )
  })

  test('the reads the Reviewer needs are not denied', () => {
    expectAll(
      [
        `gh api ${REPO}/pulls/40`,
        `gh api ${REPO}/pulls/40/files`,
        `gh api ${REPO}/compare/${SHA}...${SHA}`,
        `gh api ${REPO}/commits/${SHA}/check-runs`,
        `gh api ${REPO}/git/commits/${SHA}`,
        `gh api "${REPO}/contents/package.json?ref=${SHA}" -H "Accept: application/vnd.github.raw"`,
        `gh api ${REPO}/releases/tags/v0.1.0 --jq .immutable`,
        `gh api ${REPO}/releases/assets/1 -H "Accept: application/octet-stream"`,
        `gh api ${REPO} --jq .permissions`,
        'gh api user --jq .login',
      ],
      'not deny',
    )
  })

  test('a sample of writes no agent needs is denied, in either flag order', () => {
    expectAll(
      [
        'git push origin HEAD:refs/tags/v0.0.0-probe',
        'git push origin HEAD:main',
        'git push origin :claude/old',
        'git push origin --delete claude/old',
        'git push origin +claude/topic',
        'git push --force-with-lease origin claude/topic',
        'git push origin claude/topic --force',
        'git push --tags origin',
        `gh api ${REPO}/releases -f tag_name=v9.9.9`,
        `gh api -X POST ${REPO}/releases -f tag_name=v9.9.9 -F draft=true`,
        `gh api ${REPO}/releases --input release.json`,
        `gh api --method PATCH ${REPO}/releases/1 -f draft=false`,
        `gh api -X PATCH ${REPO} -f visibility=private`,
        `gh api ${REPO} -X PATCH -f allow_auto_merge=true`,
        'gh api -X PATCH repos/{owner}/{repo} -f default_branch=x',
        `gh api ${REPO}/git/refs -f ref=refs/tags/v9.9.9 -f sha=${SHA}`,
        `gh api -X PUT ${REPO}/contents/README.md -f message=x -f content=eA==`,
        `gh api ${REPO}/actions/workflows/ci.yml/dispatches -f ref=main`,
        `gh api ${REPO}/hooks -f name=web`,
        `gh api ${REPO}/keys -f key=ssh-ed25519`,
        `gh api ${REPO}/rulesets`,
        `gh api -X DELETE ${REPO}/git/refs/heads/x`,
        `gh api --method=DELETE ${REPO}/pulls/40`,
        `gh api ${REPO}/statuses/${SHA} -f state=success -f context=ci`,
        "gh api graphql -f query='mutation { x }'",
        'gh workflow run ci.yml',
        'gh repo edit --visibility private',
        'gh auth refresh -s admin:org',
        'gh release create v9.9.9',
        'gh pr merge 40 --squash',
      ],
      'deny',
    )
  })

  test('a known limit: an inline body that names a denied path is denied too', () => {
    // Why WORKFLOW §7 asks for bodies from a file (-F body=@<file>).
    assert.equal(
      decide(`gh api ${REPO}/issues/40/comments -f body="see plugins/model-meter/hooks/x"`),
      'deny',
    )
    assert.notEqual(decide(`gh api ${REPO}/issues/40/comments -F body=@/tmp/review.md`), 'deny')
  })
})
