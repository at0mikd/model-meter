// Fails unless .claude-plugin/marketplace.json, which is what installers read,
// points at exactly the folder the other gates check (T-014, audit N2): one
// entry, named model-meter, with source ./plugins/model-meter, and the same
// version as plugin.json. The top level, the metadata and the entry take only
// an allowlist of keys, so anything an entry could add on its own (hooks, MCP
// or LSP servers, commands, agents, strict, a pluginRoot) fails until someone
// allows it here.
//
// Pure: it reads two files and runs no CLI and no network. Messages never echo
// the values it rejects; a rejected key, or a read error, is quoted with
// JSON.stringify, so it cannot add lines (a forged `::error`) or escape
// sequences to the CI log.

import { readFileSync } from 'node:fs'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

/** The files it reads, from the package root (where npm runs this script). */
export const FILES = Object.freeze({
  marketplace: '.claude-plugin/marketplace.json',
  plugin: 'plugins/model-meter/.claude-plugin/plugin.json',
})

export const PLUGIN_NAME = 'model-meter'
export const PLUGIN_SOURCE = './plugins/model-meter'

/** The keys each part may hold. Widening them needs the Maintainer's approval. */
export const TOP_KEYS = Object.freeze(['name', 'owner', 'metadata', 'plugins'])
export const METADATA_KEYS = Object.freeze(['description'])
export const ENTRY_KEYS = Object.freeze(['name', 'source', 'description', 'version', 'category'])

const SHAPE = 'unexpected marketplace.json shape'

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * @param {string} where
 * @param {Record<string, unknown>} object
 * @param {readonly string[]} allowed
 */
const keyProblems = (where, object, allowed) =>
  Object.keys(object)
    .filter((key) => !allowed.includes(key))
    .map((key) => `${where}: key not allowed: ${JSON.stringify(key)}`)

/**
 * Everything in a parsed marketplace.json that strays from the one entry the
 * gates check, one line each; empty when it does not. Anything unreadable fails closed.
 *
 * @param {unknown} marketplace parsed .claude-plugin/marketplace.json
 * @param {unknown} pluginVersion the version plugin.json declares
 * @returns {string[]}
 */
export function marketplaceProblems(marketplace, pluginVersion) {
  if (typeof pluginVersion !== 'string') return ['plugin.json declares no version']
  if (!isRecord(marketplace)) return [SHAPE]
  const { metadata, plugins } = marketplace
  if (metadata !== undefined && !isRecord(metadata)) return [SHAPE]
  if (!Array.isArray(plugins)) return [SHAPE]
  const entries = /** @type {unknown[]} */ (plugins)
  if (!entries.every(isRecord)) return [SHAPE]

  const problems = keyProblems('top level', marketplace, TOP_KEYS)
  if (metadata !== undefined) problems.push(...keyProblems('metadata', metadata, METADATA_KEYS))
  if (entries.length !== 1) {
    problems.push(`plugins: must hold exactly one entry, found ${String(entries.length)}`)
  }
  entries.forEach((entry, index) => {
    const where = `plugins[${String(index)}]`
    problems.push(...keyProblems(where, entry, ENTRY_KEYS))
    if (entry.name !== PLUGIN_NAME) problems.push(`${where}.name: must be "${PLUGIN_NAME}"`)
    if (entry.source !== PLUGIN_SOURCE) problems.push(`${where}.source: must be "${PLUGIN_SOURCE}"`)
    if (entry.version !== pluginVersion) {
      problems.push(`${where}.version: must equal plugin.json's version`)
    }
  })
  return problems
}

/**
 * @param {() => string} read
 * @returns {{ ok: true, value: unknown } | { ok: false, reason: string }}
 */
function readJson(read) {
  try {
    /** @type {unknown} */
    const value = JSON.parse(read())
    return { ok: true, value }
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * @param {{ readMarketplace?: () => string, readPlugin?: () => string, write?: (text: string) => void }} [io]
 * @returns {0 | 1}
 */
export function main({
  readMarketplace = () => readFileSync('.claude-plugin/marketplace.json', 'utf8'),
  readPlugin = () => readFileSync('plugins/model-meter/.claude-plugin/plugin.json', 'utf8'),
  write = (text) => process.stdout.write(text),
} = {}) {
  const marketplace = readJson(readMarketplace)
  if (!marketplace.ok) {
    write(
      `marketplace: could not read ${FILES.marketplace}: ${JSON.stringify(marketplace.reason)}\n`,
    )
    return 1
  }
  const plugin = readJson(readPlugin)
  if (!plugin.ok) {
    write(`marketplace: could not read ${FILES.plugin}: ${JSON.stringify(plugin.reason)}\n`)
    return 1
  }
  const version = isRecord(plugin.value) ? plugin.value.version : undefined
  const problems = marketplaceProblems(marketplace.value, version)
  if (problems.length === 0) {
    write(`marketplace: ok (one entry, ${PLUGIN_NAME} from ${PLUGIN_SOURCE})\n`)
    return 0
  }
  write(`marketplace: ${String(problems.length)} problem(s) in ${FILES.marketplace}\n`)
  for (const problem of problems) write(`  - ${problem}\n`)
  return 1
}

/* c8 ignore next 3 -- entry point when run as a script */
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  process.exitCode = main()
}
