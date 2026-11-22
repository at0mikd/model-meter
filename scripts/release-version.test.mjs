import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { MANIFESTS, main, releaseNotes, tagProblems, versionsOf } from './release-version.mjs'

/** The three manifests as they are read, each declaring `version`. */
const manifests = (plugin = '0.1.0', market = '0.1.0', pkg = '0.1.0') => ({
  plugin: { name: 'model-meter', version: plugin },
  marketplace: { name: 'model-meter', plugins: [{ name: 'model-meter', version: market }] },
  pkg: { name: 'model-meter', version: pkg },
})

const CHANGELOG = `# Changelog

## [Unreleased]

## [0.1.0] - 2026-11-21

### Added

- The badge.

## [0.0.1] - 2026-11-01

- An older one.
`

describe('versionsOf (T-012 AC2)', () => {
  test('the version each manifest declares, by file', () => {
    assert.deepEqual(versionsOf(manifests('0.1.0', '0.2.0', '0.3.0')), [
      { file: MANIFESTS.plugin, version: '0.1.0' },
      { file: MANIFESTS.marketplace, version: '0.2.0' },
      { file: MANIFESTS.pkg, version: '0.3.0' },
    ])
  })

  test('what is missing or not text reads as no version', () => {
    const versions = versionsOf({
      plugin: { version: 1 },
      marketplace: { plugins: [{ name: 'other', version: '0.1.0' }] },
      pkg: null,
    })
    assert.deepEqual(
      versions.map((entry) => entry.version),
      [undefined, undefined, undefined],
    )
    assert.deepEqual(
      versionsOf({ plugin: {}, marketplace: { plugins: 'x' }, pkg: {} }).map((e) => e.version),
      [undefined, undefined, undefined],
    )
    assert.deepEqual(
      versionsOf({ plugin: 'x', marketplace: null, pkg: [] }).map((e) => e.version),
      [undefined, undefined, undefined],
    )
  })
})

describe('tagProblems (T-012 AC2)', () => {
  test('a tag that is v plus the version of all three manifests passes', () => {
    assert.deepEqual(tagProblems('v0.1.0', versionsOf(manifests())), [])
  })

  test('any manifest that differs fails, naming the file', () => {
    /** @type {[ReturnType<typeof manifests>, string][]} */
    const cases = [
      [manifests('0.1.1'), MANIFESTS.plugin],
      [manifests('0.1.0', '0.0.0'), MANIFESTS.marketplace],
      [manifests('0.1.0', '0.1.0', '0.2.0'), MANIFESTS.pkg],
    ]
    for (const [read, file] of cases) {
      const problems = tagProblems('v0.1.0', versionsOf(read))
      assert.equal(problems.length, 1, file)
      assert.ok(problems[0]?.startsWith(`${file} declares `), problems[0])
    }
  })

  test('a manifest with no version fails', () => {
    const problems = tagProblems('v0.1.0', versionsOf({ ...manifests(), pkg: {} }))
    assert.deepEqual(problems, [`${MANIFESTS.pkg} declares no version`])
  })

  test('a tag that is not v plus a semantic version fails before anything is compared', () => {
    for (const tag of [
      '0.1.0',
      'v0.1',
      'v0.1.0.0',
      'v0.1.0-rc.1',
      'release-0.1.0',
      'v0.1.0 ',
      '',
      'V0.1.0',
    ]) {
      const problems = tagProblems(tag, versionsOf(manifests()))
      assert.equal(problems.length, 1, JSON.stringify(tag))
      assert.match(problems[0] ?? '', /is not v plus a version/)
    }
  })
})

describe('releaseNotes (T-012 AC2)', () => {
  test("one version's section, without its heading", () => {
    assert.equal(releaseNotes(CHANGELOG, '0.1.0'), '### Added\n\n- The badge.')
  })

  test('the last section runs to the end', () => {
    assert.equal(releaseNotes(CHANGELOG, '0.0.1'), '- An older one.')
  })

  test('no section, an empty one, or a look-alike heading: no notes', () => {
    assert.equal(releaseNotes(CHANGELOG, '0.2.0'), undefined)
    assert.equal(releaseNotes(CHANGELOG, '0.1'), undefined)
    assert.equal(releaseNotes('## [0.1.0] - 2026-11-21\n\n## [0.0.1]\n- x\n', '0.1.0'), undefined)
    assert.equal(
      releaseNotes(CHANGELOG.replaceAll('\n', '\r\n'), '0.1.0'),
      '### Added\n\n- The badge.',
    )
  })
})

describe('main (T-012 AC2)', () => {
  /** Files as the script reads them. */
  const files = (read = manifests(), changelog = CHANGELOG) => {
    const byPath = new Map([
      [MANIFESTS.plugin, JSON.stringify(read.plugin)],
      [MANIFESTS.marketplace, JSON.stringify(read.marketplace)],
      [MANIFESTS.pkg, JSON.stringify(read.pkg)],
      ['CHANGELOG.md', changelog],
    ])
    /** @param {string} path */
    return (path) => {
      const text = byPath.get(path)
      if (text === undefined) throw new Error(`ENOENT: ${path}`)
      return text
    }
  }
  /** @param {string[]} argv @param {(path: string) => string} [readText] */
  const run = (argv, readText = files()) => {
    let out = ''
    const code = main({ argv, readText, write: (text) => (out += text) })
    return { code, out }
  }

  test('check: the tag matches the three manifests', () => {
    assert.deepEqual(run(['check', 'v0.1.0']), {
      code: 0,
      out: 'release-version: v0.1.0 matches plugin.json, marketplace.json and package.json\n',
    })
  })

  test('check: a mismatch fails and lists every problem', () => {
    const { code, out } = run(['check', 'v0.1.0'], files(manifests('0.0.0', '0.1.0', '0.0.0')))
    assert.equal(code, 1)
    assert.match(out, /2 problem\(s\)/)
    assert.match(out, /plugin\.json declares 0\.0\.0, not 0\.1\.0/)
    assert.match(out, /package\.json declares 0\.0\.0, not 0\.1\.0/)
  })

  test('check: a manifest that cannot be read or parsed fails closed', () => {
    const broken = (/** @type {string} */ path) => {
      if (path === MANIFESTS.marketplace) return '{ not json'
      return files()(path)
    }
    const { code, out } = run(['check', 'v0.1.0'], broken)
    assert.equal(code, 1)
    assert.match(out, /could not read .*marketplace\.json/)
  })

  test('notes: the section of the tag, for the release body', () => {
    assert.deepEqual(run(['notes', 'v0.1.0']), { code: 0, out: '### Added\n\n- The badge.\n' })
  })

  test('notes: a version with no section fails', () => {
    const { code, out } = run(['notes', 'v0.9.0'])
    assert.equal(code, 1)
    assert.match(out, /no notes for 0\.9\.0 in CHANGELOG\.md/)
  })

  test('notes: a changelog that cannot be read fails', () => {
    const { code, out } = run(['notes', 'v0.1.0'], () => {
      throw new Error('ENOENT')
    })
    assert.equal(code, 1)
    assert.match(out, /could not read CHANGELOG\.md/)
  })

  test('anything else prints the usage and fails', () => {
    for (const argv of [[], ['check'], ['publish', 'v0.1.0'], ['notes', '0.1.0']]) {
      const { code, out } = run(argv)
      assert.equal(code, 1, JSON.stringify(argv))
      assert.match(out, /usage: node scripts\/release-version\.mjs (check|notes) <vX\.Y\.Z>/)
    }
  })
})
