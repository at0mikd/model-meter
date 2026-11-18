import assert from 'node:assert/strict'
import process from 'node:process'
import { describe, test } from 'node:test'

import {
  ALLOWED_CALLS,
  ALLOWED_ENV,
  findViolations,
  isAllowedCall,
  main,
} from './check-capabilities.mjs'
import skeletonReport from './fixtures/validate-skeleton.json' with { type: 'json' }
import spikeReport from './fixtures/validate-spike.json' with { type: 'json' }

/**
 * The part of `claude plugin validate --json` these tests touch.
 *
 * @typedef {{ module: string, pattern: string, hook: string, hasCatch: boolean }} GatingHook
 * @typedef {{ module: string, uses: { calls: string[], env?: { reads: string[], writes: string[] } } }} ModuleEntry
 * @typedef {{ type?: string, file?: string, gatingHooks: GatingHook[], modules: ModuleEntry[] | null }} FileEntry
 * @typedef {{ success: boolean, target?: string, manifest: FileEntry | null, contents: FileEntry[] }} Report
 */

/**
 * A fresh copy of a real validate report (paths redacted), safe to change.
 *
 * @param {unknown} report
 * @returns {Report}
 */
function fixture(report) {
  /** @type {unknown} */
  const copy = structuredClone(report)
  return /** @type {Report} */ (copy)
}

/** @param {Report} report */
function hooksFile(report) {
  const file = report.contents[0]
  assert.ok(file)
  return file
}

/** @param {Report} report */
function firstModule(report) {
  const first = hooksFile(report).modules?.[0]
  assert.ok(first)
  return first
}

/**
 * @param {Report} report
 * @param {string} hook
 */
function gate(report, hook) {
  const found = hooksFile(report).gatingHooks.find((g) => g.hook === hook)
  assert.ok(found)
  return found
}

/**
 * The spike's real report, reshaped into a mod that stays inside the allowlist,
 * so each test below breaks exactly one thing.
 */
function cleanReport() {
  const report = fixture(spikeReport)
  const module = firstModule(report)
  module.uses.calls = ['clock.now', 'session.model', 'store.get', 'store.set', 'ui.resolve']
  module.uses.env = { reads: [], writes: [] }
  for (const g of hooksFile(report).gatingHooks) g.hasCatch = true
  return report
}

describe('isAllowedCall', () => {
  test('accepts exact entries and the ui.* family', () => {
    assert.equal(isAllowedCall('session.model'), true)
    assert.equal(isAllowedCall('ui.resolve'), true)
    assert.equal(isAllowedCall('ui.notify'), true)
  })

  test('rejects lookalikes of a wildcard entry', () => {
    assert.equal(isAllowedCall('ui'), false)
    assert.equal(isAllowedCall('uix.draw'), false)
    assert.equal(isAllowedCall('session.models'), false)
  })

  test('the allowlist is the one in docs/PLAN.md §6, with no environment variables', () => {
    assert.deepEqual(ALLOWED_CALLS, [
      'session.model',
      'store.get',
      'store.set',
      'ui.*',
      'clock.now',
    ])
    assert.deepEqual(ALLOWED_ENV, [])
  })
})

describe('findViolations', () => {
  test('a mod inside the allowlist passes', () => {
    assert.deepEqual(findViolations(cleanReport()), [])
  })

  test('the real skeleton report passes', () => {
    assert.deepEqual(findViolations(fixture(skeletonReport)), [])
  })

  test('CA3: a call outside the allowlist fails, named with its module', () => {
    const report = cleanReport()
    firstModule(report).uses.calls.push('fs.write')
    assert.deepEqual(findViolations(report), ['./register.ts: call not allowed: $.fs.write'])
  })

  test('the spike report fails for every capability the product must not use', () => {
    const problems = findViolations(fixture(spikeReport))
    for (const call of ['env.get', 'settings.read', 'tool.register']) {
      assert.ok(problems.includes(`./register.ts: call not allowed: $.${call}`), call)
    }
    assert.ok(problems.includes('./register.ts: env read not allowed: CLAUDE_CODE_EFFORT_LEVEL'))
    assert.ok(problems.includes('./register.ts: gating hook without .catch: config.set'))
    assert.ok(!problems.some((p) => p.includes('session.model')))
  })

  test('an env read on the allowlist passes', () => {
    const report = cleanReport()
    firstModule(report).uses.env = { reads: ['SOME_VAR'], writes: [] }
    assert.deepEqual(findViolations(report, { env: ['SOME_VAR'] }), [])
    assert.deepEqual(findViolations(report), ['./register.ts: env read not allowed: SOME_VAR'])
  })

  test('any environment write fails', () => {
    const report = cleanReport()
    firstModule(report).uses.env = { reads: [], writes: ['HOME'] }
    assert.deepEqual(findViolations(report), ['./register.ts: env write not allowed: HOME'])
  })

  test('a module that leaves out the env lists has nothing to report', () => {
    const report = cleanReport()
    delete firstModule(report).uses.env
    assert.deepEqual(findViolations(report), [])
  })

  test('a gating hook without .catch fails (PLAN §2.4, decision 6)', () => {
    const report = cleanReport()
    gate(report, 'config.set').hasCatch = false
    assert.deepEqual(findViolations(report), [
      './register.ts: gating hook without .catch: config.set',
    ])
  })

  test('gating hooks reported on the manifest entry count too', () => {
    const report = cleanReport()
    assert.ok(report.manifest)
    report.manifest.gatingHooks = [
      { module: './other.ts', pattern: 'prompt.submit', hook: 'prompt.submit', hasCatch: false },
    ]
    assert.deepEqual(findViolations(report), [
      './other.ts: gating hook without .catch: prompt.submit',
    ])
  })

  test('a report without a manifest entry is read from its contents', () => {
    const report = cleanReport()
    report.manifest = null
    assert.deepEqual(findViolations(report), [])
  })

  test('fails closed when validate could not read a hooks module', () => {
    const report = cleanReport()
    hooksFile(report).modules = null
    assert.deepEqual(findViolations(report), [
      'hooks: validate could not read the hooks module (modules: null)',
    ])
  })

  test('an unread entry with no type is still named', () => {
    const report = cleanReport()
    const file = hooksFile(report)
    delete file.type
    file.modules = null
    assert.deepEqual(findViolations(report), [
      'file: validate could not read the hooks module (modules: null)',
    ])
  })

  test('fails closed when no hooks module was scanned at all', () => {
    const report = cleanReport()
    report.contents = []
    assert.deepEqual(findViolations(report), ['no hooks module was scanned'])
  })

  test('fails when validate itself failed', () => {
    const report = cleanReport()
    report.success = false
    assert.deepEqual(findViolations(report), ['claude plugin validate reported failure'])
  })

  describe('fails on anything that is not a validate report', () => {
    const shape = ['unexpected validate report shape']
    /** @param {unknown} contents */
    const withContents = (contents) => ({ success: true, manifest: null, contents })
    const module = { module: './m.ts', uses: { calls: [] } }
    const gating = { module: './m.ts', pattern: 'x', hook: 'x', hasCatch: true }

    test('not an object, or no contents list', () => {
      assert.deepEqual(findViolations(null), shape)
      assert.deepEqual(findViolations({ success: true }), shape)
    })

    test('a file entry that is not an object or lacks its lists', () => {
      assert.deepEqual(findViolations(withContents([null])), shape)
      assert.deepEqual(findViolations(withContents([{ modules: [] }])), shape)
      assert.deepEqual(findViolations(withContents([{ gatingHooks: [], modules: 'x' }])), shape)
    })

    test('a malformed gating hook', () => {
      assert.deepEqual(findViolations(withContents([{ gatingHooks: [null], modules: [] }])), shape)
      assert.deepEqual(
        findViolations(
          withContents([{ gatingHooks: [{ ...gating, hasCatch: 'no' }], modules: [] }]),
        ),
        shape,
      )
    })

    test('a malformed module entry', () => {
      const file = (/** @type {unknown} */ entry) =>
        withContents([{ gatingHooks: [], modules: [entry] }])
      assert.deepEqual(findViolations(file(null)), shape)
      assert.deepEqual(findViolations(file({})), shape)
      assert.deepEqual(findViolations(file({ module: './m.ts', uses: null })), shape)
      assert.deepEqual(findViolations(file({ ...module, uses: { calls: [1] } })), shape)
      assert.deepEqual(findViolations(file({ ...module, uses: { calls: [], env: 'x' } })), shape)
      assert.deepEqual(
        findViolations(file({ ...module, uses: { calls: [], env: { reads: [], writes: 'x' } } })),
        shape,
      )
    })
  })

  test('never echoes absolute paths from the report', () => {
    const report = cleanReport()
    report.target = '/home/someone/model-meter/plugins/model-meter'
    hooksFile(report).file = '/home/someone/model-meter/plugins/model-meter/hooks/hooks.json'
    firstModule(report).uses.calls.push('process.spawn')
    const problems = findViolations(report)
    assert.equal(problems.length, 1)
    assert.ok(!problems.join('\n').includes('/home/'))
  })
})

describe('main', () => {
  /** @param {() => string} run */
  function capture(run) {
    let out = ''
    const code = main({ run, write: (text) => (out += text) })
    return { code, out }
  }

  test('exits 0 and says so when the mod stays inside the allowlist', () => {
    const { code, out } = capture(() => JSON.stringify(cleanReport()))
    assert.equal(code, 0)
    assert.match(out, /^capabilities: ok/)
  })

  test('CA3: exits 1 and lists each violation when a call is not allowed', () => {
    const report = cleanReport()
    firstModule(report).uses.calls.push('http.fetch')
    const { code, out } = capture(() => JSON.stringify(report))
    assert.equal(code, 1)
    assert.match(out, /call not allowed: \$\.http\.fetch/)
  })

  test('exits 1 when validate prints nothing (an unexpected failure, exit 2)', () => {
    const { code, out } = capture(() => '')
    assert.equal(code, 1)
    assert.match(out, /could not read/)
  })

  test('exits 1 when the CLI cannot be run at all', () => {
    const { code, out } = capture(() => {
      throw new Error('spawn claude ENOENT')
    })
    assert.equal(code, 1)
    assert.match(out, /could not run claude plugin validate: spawn claude ENOENT/)
  })

  test('reports a failure to run that is not an Error', () => {
    const { code, out } = capture(() => {
      // eslint-disable-next-line @typescript-eslint/only-throw-error -- what a child process may throw is not ours to choose
      throw 'killed'
    })
    assert.equal(code, 1)
    assert.match(out, /could not run claude plugin validate: killed/)
  })

  test('writes to stdout by default', (t) => {
    /** @type {string[]} */
    const written = []
    t.mock.method(process.stdout, 'write', (/** @type {string} */ text) => {
      written.push(text)
      return true
    })
    const code = main({ run: () => JSON.stringify(cleanReport()) })
    t.mock.restoreAll()
    assert.equal(code, 0)
    assert.match(written.join(''), /^capabilities: ok/)
  })
})
