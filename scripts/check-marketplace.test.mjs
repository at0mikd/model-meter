import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import process from 'node:process'
import { describe, test } from 'node:test'

import {
  ENTRY_KEYS,
  FILES,
  METADATA_KEYS,
  PLUGIN_NAME,
  PLUGIN_SOURCE,
  TOP_KEYS,
  main,
  marketplaceProblems,
} from './check-marketplace.mjs'

const MARKETPLACE_TEXT = readFileSync('.claude-plugin/marketplace.json', 'utf8')
const PLUGIN_TEXT = readFileSync('plugins/model-meter/.claude-plugin/plugin.json', 'utf8')

/** @typedef {Record<string, unknown> & { plugins: Record<string, unknown>[], metadata: Record<string, unknown> }} Marketplace */

/** @returns {Marketplace} a fresh copy of the real marketplace.json, safe to change */
function realMarketplace() {
  /** @type {unknown} */
  const parsed = JSON.parse(MARKETPLACE_TEXT)
  return /** @type {Marketplace} */ (parsed)
}

/** @returns {string} the real plugin.json's version */
function pluginVersion() {
  /** @type {unknown} */
  const parsed = JSON.parse(PLUGIN_TEXT)
  const { version } = /** @type {{ version: string }} */ (parsed)
  return version
}

/** @param {Marketplace} marketplace */
function entry(marketplace) {
  const first = marketplace.plugins[0]
  assert.ok(first)
  return first
}

/** @param {unknown} marketplace */
const problemsOf = (marketplace) => marketplaceProblems(marketplace, pluginVersion())

describe('the allowlists', () => {
  test('name exactly the keys the real file uses today', () => {
    assert.deepEqual(TOP_KEYS, ['name', 'owner', 'metadata', 'plugins'])
    assert.deepEqual(ENTRY_KEYS, ['name', 'source', 'description', 'version', 'category'])
    assert.deepEqual(METADATA_KEYS, ['description'])
    assert.equal(PLUGIN_NAME, 'model-meter')
    assert.equal(PLUGIN_SOURCE, './plugins/model-meter')
  })
})

describe('marketplaceProblems (T-014, N2)', () => {
  test('the real marketplace.json passes', () => {
    assert.deepEqual(problemsOf(realMarketplace()), [])
  })

  test('variant A: the entry pointing at another folder fails', () => {
    const marketplace = realMarketplace()
    entry(marketplace).source = './spikes/wic-spike'
    assert.deepEqual(problemsOf(marketplace), [
      'plugins[0].source: must be "./plugins/model-meter"',
    ])
  })

  test('variant B: inline hooks and MCP servers on the entry fail', () => {
    const marketplace = realMarketplace()
    entry(marketplace).hooks = {
      SessionStart: [{ hooks: [{ type: 'command', command: 'echo mm-placeholder' }] }],
    }
    entry(marketplace).mcpServers = { placeholder: { command: 'echo' } }
    assert.deepEqual(problemsOf(marketplace), [
      'plugins[0]: key not allowed: hooks',
      'plugins[0]: key not allowed: mcpServers',
    ])
  })

  test('variant C: a second entry fails, and so does its strict: false', () => {
    const marketplace = realMarketplace()
    marketplace.plugins.push({ name: 'wic-spike', source: './spikes/wic-spike', strict: false })
    assert.deepEqual(problemsOf(marketplace), [
      'plugins: must hold exactly one entry, found 2',
      'plugins[1]: key not allowed: strict',
      'plugins[1].name: must be "model-meter"',
      'plugins[1].source: must be "./plugins/model-meter"',
      "plugins[1].version: must equal plugin.json's version",
    ])
  })

  test('variant D: a GitHub source fails, without echoing it', () => {
    const marketplace = realMarketplace()
    entry(marketplace).source = { source: 'github', repo: 'example-owner/example-plugin' }
    const problems = problemsOf(marketplace)
    assert.deepEqual(problems, ['plugins[0].source: must be "./plugins/model-meter"'])
    assert.ok(!problems.join('\n').includes('example-owner'))
  })

  test('variant E: a metadata.pluginRoot shadow fails', () => {
    const marketplace = realMarketplace()
    marketplace.metadata.pluginRoot = './spikes/shadow'
    assert.deepEqual(problemsOf(marketplace), ['metadata: key not allowed: pluginRoot'])
  })

  test('strict: false on the one entry fails', () => {
    const marketplace = realMarketplace()
    entry(marketplace).strict = false
    assert.deepEqual(problemsOf(marketplace), ['plugins[0]: key not allowed: strict'])
  })

  test('an unknown key on the entry fails', () => {
    for (const key of ['commands', 'agents', 'lspServers', 'skills', 'whatever']) {
      const marketplace = realMarketplace()
      marketplace.plugins = [{ ...entry(marketplace), [key]: [] }]
      assert.deepEqual(problemsOf(marketplace), [`plugins[0]: key not allowed: ${key}`], key)
    }
  })

  test('an unknown top-level key fails', () => {
    const marketplace = realMarketplace()
    marketplace.pluginRoot = './elsewhere'
    assert.deepEqual(problemsOf(marketplace), ['top level: key not allowed: pluginRoot'])
  })

  test("a version that differs from plugin.json's fails", () => {
    const marketplace = realMarketplace()
    entry(marketplace).version = '9.9.9'
    assert.deepEqual(problemsOf(marketplace), [
      "plugins[0].version: must equal plugin.json's version",
    ])
    assert.deepEqual(marketplaceProblems(realMarketplace(), '9.9.9'), [
      "plugins[0].version: must equal plugin.json's version",
    ])
  })

  test('another name fails', () => {
    const marketplace = realMarketplace()
    entry(marketplace).name = 'model-meter2'
    assert.deepEqual(problemsOf(marketplace), ['plugins[0].name: must be "model-meter"'])
  })

  test('no entry at all fails', () => {
    const marketplace = realMarketplace()
    marketplace.plugins = []
    assert.deepEqual(problemsOf(marketplace), ['plugins: must hold exactly one entry, found 0'])
  })

  test('anything of an unexpected shape fails closed', () => {
    const shape = ['unexpected marketplace.json shape']
    const withPlugins = (/** @type {unknown} */ plugins) => ({ ...realMarketplace(), plugins })
    const withMetadata = (/** @type {unknown} */ metadata) => ({ ...realMarketplace(), metadata })
    for (const marketplace of [
      null,
      'x',
      [],
      withPlugins(undefined),
      withPlugins({}),
      withPlugins([null]),
      withPlugins(['model-meter']),
      withPlugins([[]]),
      withMetadata(null),
      withMetadata([]),
    ]) {
      assert.deepEqual(problemsOf(marketplace), shape, JSON.stringify(marketplace))
    }
    assert.deepEqual(marketplaceProblems(realMarketplace(), undefined), [
      'plugin.json declares no version',
    ])
  })

  test('a marketplace without metadata is fine', () => {
    const { metadata, ...withoutMetadata } = realMarketplace()
    assert.ok(metadata)
    assert.deepEqual(problemsOf(withoutMetadata), [])
  })
})

describe('main', () => {
  /**
   * @param {{ marketplace?: string | Error, plugin?: string | Error }} files
   */
  function capture({ marketplace = MARKETPLACE_TEXT, plugin = PLUGIN_TEXT }) {
    let out = ''
    const reader = (/** @type {string | Error} */ content) => () => {
      if (content instanceof Error) throw content
      return content
    }
    const code = main({
      readMarketplace: reader(marketplace),
      readPlugin: reader(plugin),
      write: (text) => (out += text),
    })
    return { code, out }
  }

  test('the files it names are the ones it reads by default', () => {
    assert.deepEqual(FILES, {
      marketplace: '.claude-plugin/marketplace.json',
      plugin: 'plugins/model-meter/.claude-plugin/plugin.json',
    })
  })

  test('exits 0 on the real files and says so', () => {
    const { code, out } = capture({})
    assert.equal(code, 0)
    assert.equal(out, 'marketplace: ok (one entry, model-meter from ./plugins/model-meter)\n')
  })

  test('exits 1 and lists each problem', () => {
    const marketplace = realMarketplace()
    entry(marketplace).source = './spikes/wic-spike'
    entry(marketplace).hooks = {}
    const { code, out } = capture({ marketplace: JSON.stringify(marketplace) })
    assert.equal(code, 1)
    assert.equal(
      out,
      'marketplace: 2 problem(s) in .claude-plugin/marketplace.json\n' +
        '  - plugins[0]: key not allowed: hooks\n' +
        '  - plugins[0].source: must be "./plugins/model-meter"\n',
    )
  })

  test('exits 1 when a file cannot be read or is not JSON', () => {
    const missing = capture({ marketplace: new Error('ENOENT') })
    assert.equal(missing.code, 1)
    assert.equal(
      missing.out,
      'marketplace: could not read .claude-plugin/marketplace.json: ENOENT\n',
    )
    const broken = capture({ plugin: '{' })
    assert.equal(broken.code, 1)
    assert.match(
      broken.out,
      /^marketplace: could not read plugins\/model-meter\/\.claude-plugin\/plugin\.json: /,
    )
    const notAnObject = capture({ plugin: '[]' })
    assert.equal(notAnObject.code, 1)
    assert.match(notAnObject.out, /plugin\.json declares no version/)
  })

  test('reports a failure to read that is not an Error', () => {
    let out = ''
    const code = main({
      readMarketplace: () => {
        // eslint-disable-next-line @typescript-eslint/only-throw-error -- what a reader may throw is not ours to choose
        throw 'denied'
      },
      write: (text) => (out += text),
    })
    assert.equal(code, 1)
    assert.equal(out, 'marketplace: could not read .claude-plugin/marketplace.json: denied\n')
  })

  test('writes to stdout and reads from disk by default', (t) => {
    /** @type {string[]} */
    const written = []
    t.mock.method(process.stdout, 'write', (/** @type {string} */ text) => {
      written.push(text)
      return true
    })
    const code = main()
    t.mock.restoreAll()
    assert.equal(code, 0)
    assert.match(written.join(''), /^marketplace: ok/)
  })
})
