import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { describe, test } from 'node:test'

import {
  PACKAGE_PATHS,
  PUBLISHED,
  archiveName,
  fileListProblems,
  main,
  sha256sums,
} from './package.mjs'

describe('the published file list (T-012)', () => {
  test('is exactly what git tracks under the plugin folder, and the marketplace', () => {
    const tracked = execFileSync('git', ['ls-files', '--', ...PACKAGE_PATHS], { encoding: 'utf8' })
      .split('\n')
      .filter((line) => line !== '')
    assert.deepEqual([...tracked].sort(), [...PUBLISHED].sort())
  })

  test('holds nothing from spikes/, test/, scripts/ or tools/', () => {
    for (const file of PUBLISHED) {
      assert.ok(!/^(spikes|test|scripts|tools)\//.test(file), file)
      assert.ok(
        file.startsWith('plugins/model-meter/') || file === '.claude-plugin/marketplace.json',
      )
    }
  })
})

describe('fileListProblems', () => {
  test('the same files, in any order: no problem', () => {
    assert.deepEqual(fileListProblems([...PUBLISHED].reverse()), [])
  })

  test('a published file that is gone, or a tracked file not on the list, is a problem', () => {
    const tracked = [
      ...PUBLISHED.filter((file) => !file.endsWith('README.md')),
      'plugins/model-meter/.env',
    ]
    assert.deepEqual(fileListProblems(tracked), [
      'missing from the package: plugins/model-meter/README.md',
      'not on the published list: plugins/model-meter/.env',
    ])
  })
})

describe('archiveName and sha256sums', () => {
  test('the archive is named for the plugin and the version', () => {
    assert.equal(archiveName('0.1.0'), 'model-meter-0.1.0.tar.gz')
  })

  test('SHA256SUMS in the format sha256sum --check reads', () => {
    assert.equal(
      sha256sums([{ name: 'model-meter-0.1.0.tar.gz', digest: 'ab'.repeat(32) }]),
      `${'ab'.repeat(32)}  model-meter-0.1.0.tar.gz\n`,
    )
  })
})

describe('main (T-012 AC3)', () => {
  const DIGEST = 'cd'.repeat(32)
  /** A fake world: git, the files it reads and writes, what it prints. */
  function world({
    tracked = [...PUBLISHED],
    pluginJson = JSON.stringify({ name: 'model-meter', version: '0.1.0' }),
    gitFails = false,
  } = {}) {
    /** @type {string[][]} */
    const calls = []
    /** @type {Map<string, string>} */
    const written = new Map()
    /** @type {string[]} */
    const dirs = []
    let out = ''
    const io = {
      /** @param {string[]} args */
      git: (args) => {
        calls.push(args)
        if (gitFails) throw new Error('git: not a repository')
        return args[0] === 'ls-tree' ? `${tracked.join('\n')}\n` : ''
      },
      readText: () => pluginJson,
      /** @param {string} path */
      sha256: (path) => (path === 'dist/model-meter-0.1.0.tar.gz' ? DIGEST : 'unexpected'),
      /** @param {string} path @param {string} text */
      writeText: (path, text) => void written.set(path, text),
      /** @param {string} path */
      makeDir: (path) => void dirs.push(path),
      /** @param {string} text */
      write: (text) => void (out += text),
    }
    return { io, calls, written, dirs, output: () => out }
  }

  test('checks the list, archives HEAD with git, and writes SHA256SUMS', () => {
    const w = world()
    assert.equal(main({ argv: [], ...w.io }), 0)
    assert.deepEqual(w.calls, [
      ['ls-tree', '-r', '--name-only', 'HEAD', '--', ...PACKAGE_PATHS],
      [
        'archive',
        '--format=tar.gz',
        '--prefix=model-meter-0.1.0/',
        '--output=dist/model-meter-0.1.0.tar.gz',
        'HEAD',
        '--',
        ...PACKAGE_PATHS,
      ],
    ])
    assert.deepEqual(w.dirs, ['dist'])
    assert.deepEqual([...w.written], [['dist/SHA256SUMS', `${DIGEST}  model-meter-0.1.0.tar.gz\n`]])
    const out = w.output()
    for (const file of PUBLISHED) assert.ok(out.includes(`  ${file}\n`), file)
    assert.ok(out.includes(`${DIGEST}  model-meter-0.1.0.tar.gz\n`))
    assert.ok(
      out.includes(`package: ${String(PUBLISHED.length)} files in model-meter-0.1.0.tar.gz\n`),
    )
  })

  test('another output folder', () => {
    const w = world()
    w.io.sha256 = () => DIGEST
    assert.equal(main({ argv: ['--out', 'build/pkg'], ...w.io }), 0)
    assert.deepEqual(w.dirs, ['build/pkg'])
    assert.ok(w.calls[1]?.includes('--output=build/pkg/model-meter-0.1.0.tar.gz'))
    assert.ok(w.written.has('build/pkg/SHA256SUMS'))
  })

  test('a file list that differs fails before anything is archived', () => {
    const w = world({ tracked: [...PUBLISHED, 'plugins/model-meter/secret.txt'] })
    assert.equal(main({ argv: [], ...w.io }), 1)
    assert.equal(w.calls.length, 1)
    assert.equal(w.written.size, 0)
    assert.match(w.output(), /not on the published list: plugins\/model-meter\/secret\.txt/)
  })

  test('no version to name the archive after: it fails', () => {
    for (const pluginJson of ['{ broken', JSON.stringify({ name: 'model-meter' }), 'null']) {
      const w = world({ pluginJson })
      assert.equal(main({ argv: [], ...w.io }), 1)
      assert.equal(w.calls.length, 0)
      assert.match(w.output(), /could not read the version/)
    }
    const w = world()
    w.io.readText = () => {
      throw new Error('ENOENT')
    }
    assert.equal(main({ argv: [], ...w.io }), 1)
    assert.match(w.output(), /could not read the version/)
  })

  test('git failing fails the package', () => {
    const w = world({ gitFails: true })
    assert.equal(main({ argv: [], ...w.io }), 1)
    assert.match(w.output(), /package: git failed: git: not a repository/)
  })

  test('an unknown argument prints the usage and fails', () => {
    for (const argv of [['--out'], ['--publish'], ['--out', '']]) {
      const w = world()
      assert.equal(main({ argv, ...w.io }), 1, JSON.stringify(argv))
      assert.match(w.output(), /usage: node scripts\/package\.mjs \[--out <dir>\]/)
    }
  })
})
