import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import process from 'node:process'
import { describe, test } from 'node:test'

import {
  ALLOWED_CALLS,
  ALLOWED_ENV,
  STATE_PLUGIN,
  declaredStateKeys,
  findViolations,
  isAllowedCall,
  main,
} from './check-capabilities.mjs'
import modReport from './fixtures/validate-mod.json' with { type: 'json' }
import spikeReport from './fixtures/validate-spike.json' with { type: 'json' }

/**
 * The part of `claude plugin validate --json` these tests touch.
 *
 * @typedef {{ module: string, pattern: string, hook: string, hasCatch: boolean }} GatingHook
 * @typedef {{ plugin: unknown, key: unknown, id?: unknown }} StateEntry
 * @typedef {{ module: string, uses: { calls: string[], env?: { reads: string[], writes: string[] }, state?: unknown } }} ModuleEntry
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
  test('accepts each listed call exactly', () => {
    for (const call of ALLOWED_CALLS) assert.equal(isAllowedCall(call), true, call)
  })

  test('rejects the rest of $.ui: an indicator never asks, copies or reads the selection', () => {
    for (const call of ['ui.ask', 'ui.copy', 'ui.selection', 'ui.notify', 'ui.open', 'ui.blit']) {
      assert.equal(isAllowedCall(call), false, call)
    }
  })

  test('rejects nouns and lookalikes: there are no wildcards', () => {
    for (const call of ['ui', 'ui.*', 'ui.resolve.x', 'uix.resolve', 'session.models', 'store']) {
      assert.equal(isAllowedCall(call), false, call)
    }
  })

  test('the allowlist lists single calls, with no wildcard and no environment variables', () => {
    assert.deepEqual(ALLOWED_CALLS, [
      'session.model',
      'store.get',
      'store.set',
      'ui.invalidate',
      'ui.resolve',
      'clock.now',
      'state.get',
      'state.set',
    ])
    assert.ok(ALLOWED_CALLS.every((call) => !call.includes('*')))
    assert.deepEqual(ALLOWED_ENV, [])
  })
})

// The mod's contract, in the shape types/index.d.ts declares it (T-003).
const CONTRACT = `// The mod's $.state contract.
declare module 'claude-code' {
  interface PluginState {
    'model-meter': {
      /** The model id: { not a brace that counts } */
      model: string | null
      step: string | number | null
      readonly stored?: string | null
      pending: { args: string } | null
      'hintWidth': number
    }
  }
}
`
const KEYS = ['hintWidth', 'model', 'pending', 'step', 'stored']

describe('declaredStateKeys', () => {
  test("reads the keys declared under PluginState['model-meter']", () => {
    assert.equal(STATE_PLUGIN, 'model-meter')
    assert.deepEqual(declaredStateKeys(CONTRACT), KEYS)
  })

  test('the real contract of the mod is readable', () => {
    const keys = declaredStateKeys(readFileSync('plugins/model-meter/types/index.d.ts', 'utf8'))
    assert.ok(Array.isArray(keys))
  })

  test('another plugin, or nothing declared for this one, is no contract', () => {
    assert.equal(declaredStateKeys(''), undefined)
    assert.equal(declaredStateKeys('export type X = 1\n'), undefined)
    assert.equal(
      declaredStateKeys(
        "declare module 'claude-code' { interface PluginState { other: { a: number } } }",
      ),
      undefined,
    )
    assert.deepEqual(
      declaredStateKeys(
        'interface PluginState { other: { a: number }; "model-meter": { b: { c: 1 }, d?: 2 } }',
      ),
      ['b', 'd'],
    )
  })

  test('members it cannot name (an index signature) declare nothing', () => {
    assert.deepEqual(
      declaredStateKeys("interface PluginState { 'model-meter': { [k: string]: number, a: 1 } }"),
      ['a'],
    )
  })

  test('an unbalanced contract fails closed', () => {
    assert.equal(
      declaredStateKeys("interface PluginState { 'model-meter': { a: ), b: 1 } }"),
      undefined,
    )
    assert.equal(
      declaredStateKeys("interface PluginState { 'model-meter': { a: (, b: 1 } }"),
      undefined,
    )
    assert.equal(
      declaredStateKeys("interface PluginState { 'model-meter': { a: 1 } | { b: 2 } }"),
      undefined,
    )
    assert.equal(
      declaredStateKeys("interface PluginState { 'model-meter': { a: { b: 1 } }"),
      undefined,
    )
    assert.equal(declaredStateKeys("interface PluginState { 'model-meter': a }"), undefined)
  })
})

describe('findViolations: $.state, only the mod own declared keys (T-003)', () => {
  /**
   * @param {unknown} state what validate reports as uses.state
   */
  function withState(state) {
    const report = cleanReport()
    firstModule(report).uses.state = state
    return report
  }
  const own = (/** @type {string} */ key) => ({ plugin: 'model-meter', key })

  test('its own declared keys pass, read or written', () => {
    const report = withState({
      reads: [own('model'), own('step')],
      writes: [own('hintWidth'), { ...own('pending'), id: 'x' }],
    })
    assert.deepEqual(findViolations(report, { state: KEYS }), [])
  })

  test("another plugin's state is rejected", () => {
    const report = withState({ reads: [{ plugin: 'sub-meter', key: 'limits' }], writes: [] })
    assert.deepEqual(findViolations(report, { state: KEYS }), [
      './register.ts: state of another plugin: sub-meter.limits',
    ])
  })

  test('a key the contract does not declare is rejected', () => {
    const report = withState({ reads: [], writes: [own('secret')] })
    assert.deepEqual(findViolations(report, { state: KEYS }), [
      './register.ts: state key not declared in types/index.d.ts: model-meter.secret',
    ])
  })

  test('state with no readable contract is rejected', () => {
    assert.deepEqual(findViolations(withState({ reads: [own('model')], writes: [] })), [
      './register.ts: uses $.state, but types/index.d.ts declares no model-meter state',
    ])
  })

  test('an odd uses.state shape fails closed', () => {
    for (const state of [
      'x',
      null,
      { reads: 'x', writes: [] },
      { reads: ['x'], writes: [] },
      { reads: [], writes: [{ plugin: 1, key: 'a' }] },
      { reads: [{ plugin: 'model-meter' }], writes: [] },
      { reads: [{ ...own('model'), id: 3 }], writes: [] },
    ]) {
      assert.deepEqual(
        findViolations(withState(state), { state: KEYS }),
        ['unexpected validate report shape'],
        JSON.stringify(state),
      )
    }
  })

  test('a module that uses no $.state needs no contract', () => {
    assert.deepEqual(findViolations(withState(undefined)), [])
  })
})

describe('findViolations', () => {
  test('a mod inside the allowlist passes', () => {
    assert.deepEqual(findViolations(cleanReport()), [])
  })

  test('ui.ask, ui.copy and ui.selection each fail', () => {
    const report = cleanReport()
    firstModule(report).uses.calls.push('ui.ask', 'ui.copy', 'ui.selection')
    assert.deepEqual(findViolations(report), [
      './register.ts: call not allowed: $.ui.ask',
      './register.ts: call not allowed: $.ui.copy',
      './register.ts: call not allowed: $.ui.selection',
    ])
  })

  test('the real report of the mod passes, with the keys its contract declares', () => {
    const declared = declaredStateKeys(readFileSync('plugins/model-meter/types/index.d.ts', 'utf8'))
    assert.deepEqual(declared, ['model', 'pending', 'step', 'stored'])
    assert.deepEqual(findViolations(fixture(modReport), { state: declared }), [])
    assert.notDeepEqual(findViolations(fixture(modReport)), [])
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
  /**
   * @param {() => string} run
   * @param {() => string} [readContract]
   */
  function capture(run, readContract = () => CONTRACT) {
    let out = ''
    const code = main({ run, readContract, write: (text) => (out += text) })
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

  test('reads the contract to check $.state, and fails closed when it cannot', () => {
    const report = cleanReport()
    firstModule(report).uses.state = {
      reads: [{ plugin: 'model-meter', key: 'model' }],
      writes: [],
    }
    assert.equal(capture(() => JSON.stringify(report)).code, 0)
    const missing = capture(
      () => JSON.stringify(report),
      () => {
        throw new Error('ENOENT')
      },
    )
    assert.equal(missing.code, 1)
    assert.match(missing.out, /declares no model-meter state/)
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
