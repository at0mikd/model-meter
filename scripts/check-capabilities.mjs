// Fails when the model-meter mod reaches for anything outside its allowlist
// (docs/PLAN.md §5–§6) or registers a gating hook that could swallow an event
// (docs/PLAN.md §2.4, decision 6). Its `$.state` may only be the mod's own,
// under keys its contract (types/index.d.ts) declares (Maintainer, T-003).
//
// It reads the structured part of `claude plugin validate --json`
// (`modules[].uses`, `gatingHooks` and the `provides` block, where the plugin may
// declare its one hooks module and nothing else, T-014), which the engine
// documents as whole and as a public contract; the `notes` lines are display text, "cleaned and
// cut". Messages name modules as hooks.json spells them and never echo the
// report's absolute paths (`target`, `file`).

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

export const PLUGIN_DIR = 'plugins/model-meter'

/**
 * What the mod may call on `$`, spelled `noun.method` as validate reports it.
 * Every entry is one exact call: no wildcards, since a noun such as `ui` also
 * holds `ask`, `copy`, `selection` or `notify`, which an indicator never needs.
 * Widening it needs the Maintainer's approval.
 */
export const ALLOWED_CALLS = Object.freeze([
  'session.model',
  'store.get',
  'store.set',
  'ui.invalidate',
  'ui.resolve',
  'clock.now',
  'state.get',
  'state.set',
])

/** The only plugin whose `$.state` the mod may read or write. */
export const STATE_PLUGIN = 'model-meter'

/**
 * The only component the plugin may declare: its hooks module. Every other list in
 * the report's `provides` block (classic hooks, MCP or LSP servers, bin, skills,
 * commands, agents, and any list a newer CLI adds) must be empty (T-014, N1).
 */
export const ALLOWED_MODULES = Object.freeze(['hooks/register.tsx'])

/** Environment variables the mod may read. None since T-000. */
export const ALLOWED_ENV = Object.freeze(/** @type {string[]} */ ([]))

/**
 * @typedef {{ module: string, hook: string, hasCatch: boolean }} GatingHook
 * @typedef {{ plugin: string, key: string, id?: string }} StateEntry
 * @typedef {{ reads: StateEntry[], writes: StateEntry[] }} StateUses
 * @typedef {{ module: string, uses: { calls: string[], env?: { reads: string[], writes: string[] }, state?: StateUses } }} ModuleUses
 * @typedef {{ type?: string, gatingHooks: GatingHook[], modules: ModuleUses[] | null }} ReportFile
 */

/**
 * @param {string} call
 * @param {readonly string[]} [allowed]
 */
export function isAllowedCall(call, allowed = ALLOWED_CALLS) {
  return allowed.includes(call)
}

/** @param {unknown} value */
const isObject = (value) => typeof value === 'object' && value !== null

/** @param {unknown} value */
const isStringList = (value) => Array.isArray(value) && value.every((v) => typeof v === 'string')

/**
 * @param {unknown} file
 * @returns {file is ReportFile}
 */
function isReportFile(file) {
  if (!isObject(file)) return false
  const { gatingHooks, modules } = /** @type {Record<string, unknown>} */ (file)
  if (!Array.isArray(gatingHooks) || !gatingHooks.every(isGatingHook)) return false
  return modules === null || (Array.isArray(modules) && modules.every(isModuleUses))
}

/**
 * @param {unknown} hook
 * @returns {hook is GatingHook}
 */
function isGatingHook(hook) {
  if (!isObject(hook)) return false
  const { module, hook: name, hasCatch } = /** @type {Record<string, unknown>} */ (hook)
  return typeof module === 'string' && typeof name === 'string' && typeof hasCatch === 'boolean'
}

/**
 * @param {unknown} entry
 * @returns {entry is ModuleUses}
 */
function isModuleUses(entry) {
  if (!isObject(entry)) return false
  const { module, uses } = /** @type {Record<string, unknown>} */ (entry)
  if (typeof module !== 'string' || !isObject(uses)) return false
  const { calls, env, state } = /** @type {Record<string, unknown>} */ (uses)
  if (!isStringList(calls)) return false
  if (state !== undefined && !isStateUses(state)) return false
  if (env === undefined) return true
  if (!isObject(env)) return false
  const { reads, writes } = /** @type {Record<string, unknown>} */ (env)
  return isStringList(reads) && isStringList(writes)
}

/**
 * @param {unknown} state
 * @returns {state is StateUses}
 */
function isStateUses(state) {
  if (!isObject(state)) return false
  const { reads, writes } = /** @type {Record<string, unknown>} */ (state)
  if (!Array.isArray(reads) || !Array.isArray(writes)) return false
  const entries = /** @type {unknown[]} */ (reads).concat(/** @type {unknown[]} */ (writes))
  return entries.every(isStateEntry)
}

/**
 * @param {unknown} entry
 * @returns {entry is StateEntry}
 */
function isStateEntry(entry) {
  if (!isObject(entry)) return false
  const { plugin, key, id } = /** @type {Record<string, unknown>} */ (entry)
  return (
    typeof plugin === 'string' &&
    typeof key === 'string' &&
    (id === undefined || typeof id === 'string')
  )
}

/**
 * @param {unknown} provides
 * @returns {provides is Record<string, unknown[]> & { modules: { path: string }[] }}
 */
function isProvides(provides) {
  if (!isObject(provides) || Array.isArray(provides)) return false
  const lists = Object.values(provides)
  if (!lists.every((list) => Array.isArray(list))) return false
  const { modules } = /** @type {Record<string, unknown>} */ (provides)
  return (
    Array.isArray(modules) &&
    modules.every(
      (m) => isObject(m) && typeof (/** @type {{ path?: unknown }} */ (m).path) === 'string',
    )
  )
}

/**
 * What the plugin declares beyond its one hooks module, one line per list. Names
 * only the list and a count, never what an entry points at; module paths come
 * from a file under review, so they are quoted with JSON.stringify.
 *
 * @param {Record<string, unknown[]> & { modules: { path: string }[] }} provides
 * @returns {string[]}
 */
function providesProblems(provides) {
  /** @type {string[]} */
  const problems = []
  const paths = provides.modules.map((m) => m.path)
  const exact = JSON.stringify(paths) === JSON.stringify(ALLOWED_MODULES)
  if (!exact) {
    const found = paths.length === 0 ? 'none' : paths.map((p) => JSON.stringify(p)).join(', ')
    problems.push(`provides.modules: must be exactly ${ALLOWED_MODULES.join(', ')}, found ${found}`)
  }
  for (const [list, items] of Object.entries(provides)) {
    if (list !== 'modules' && items.length > 0) {
      problems.push(`provides.${list}: the plugin may declare none, found ${String(items.length)}`)
    }
  }
  return problems
}

/** A member of an object type, `readonly` aside: `name:`, `'name'?:`, `"name":`. */
const MEMBER = /^(?:'([^']+)'|"([^"]+)"|([A-Za-z_$][\w$]*))\s*\??\s*:/
const READONLY = /^readonly\s+/

/**
 * The text inside the braces that open at `open`, or undefined when they never close.
 *
 * @param {string} text
 * @param {number} open
 */
function blockAt(text, open) {
  let depth = 0
  for (let i = open; i < text.length; i += 1) {
    const char = text.charAt(i)
    if (char === '{') depth += 1
    else if (char === '}') {
      depth -= 1
      if (depth === 0) return text.slice(open + 1, i)
    }
  }
  return undefined
}

/**
 * The top-level members of an object type's body, as `{ name, type }`, split on
 * `;`, `,` or a line that starts a new member; undefined when brackets do not balance.
 *
 * @param {string} body
 * @returns {{ name: string, type: string }[] | undefined}
 */
function membersOf(body) {
  /** @type {string[]} */
  const parts = []
  let depth = 0
  let start = 0
  for (let i = 0; i < body.length; i += 1) {
    const char = body.charAt(i)
    if (char === '{' || char === '(' || char === '[') depth += 1
    else if (char === '}' || char === ')' || char === ']') depth -= 1
    if (depth < 0) return undefined
    const splits =
      char === ';' ||
      char === ',' ||
      (char === '\n' &&
        MEMBER.test(
          body
            .slice(i + 1)
            .trimStart()
            .replace(READONLY, ''),
        ))
    if (depth === 0 && splits) {
      parts.push(body.slice(start, i))
      start = i + 1
    }
  }
  if (depth !== 0) return undefined
  parts.push(body.slice(start))
  return parts
    .map((part) => part.trim().replace(READONLY, ''))
    .filter((part) => part !== '')
    .flatMap((part) => {
      const match = MEMBER.exec(part)
      const name = match?.[1] ?? match?.[2] ?? match?.[3]
      return match === null || name === undefined
        ? []
        : [{ name, type: part.slice(match[0].length).trim() }]
    })
}

/**
 * The keys a contract declares under `PluginState['model-meter']`, sorted; undefined
 * when there is no such entry or the text does not balance. A small reader for the
 * mod's own types/index.d.ts, not a TypeScript parser: anything else fails closed.
 *
 * @param {string} text
 * @returns {string[] | undefined}
 */
export function declaredStateKeys(text) {
  const source = text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ')
  const found = /\binterface\s+PluginState\s*\{/.exec(source)
  if (found === null) return undefined
  const body = blockAt(source, found.index + found[0].length - 1)
  const entry =
    body === undefined ? undefined : membersOf(body)?.find((m) => m.name === STATE_PLUGIN)
  if (entry === undefined || !entry.type.startsWith('{') || !entry.type.endsWith('}'))
    return undefined
  const keys = membersOf(entry.type.slice(1, -1))
  return keys === undefined ? undefined : [...new Set(keys.map((key) => key.name))].sort()
}

/**
 * Everything in a validate report that breaks the allowlist, one line each;
 * empty when the mod stays inside it. Anything unreadable fails closed.
 *
 * @param {unknown} report parsed `claude plugin validate --json`
 * @param {{ calls?: readonly string[], env?: readonly string[], state?: readonly string[] }} [allow]
 *   `state`: the keys the contract declares; without it, any `$.state` use fails
 * @returns {string[]}
 */
export function findViolations(report, allow = {}) {
  const calls = allow.calls ?? ALLOWED_CALLS
  const env = allow.env ?? ALLOWED_ENV
  if (!isObject(report)) return ['unexpected validate report shape']
  const { success, manifest, contents, provides } = /** @type {Record<string, unknown>} */ (report)
  if (!Array.isArray(contents)) return ['unexpected validate report shape']
  const entries = /** @type {unknown[]} */ (contents)
  const files = manifest === null || manifest === undefined ? entries : [manifest, ...entries]
  if (!files.every(isReportFile)) return ['unexpected validate report shape']
  if (provides === undefined) {
    return ['the validate report has no provides block, so the plugin components cannot be checked']
  }
  if (!isProvides(provides)) return ['unexpected validate report shape']

  /** @type {string[]} */
  const problems = []
  if (success !== true) problems.push('claude plugin validate reported failure')
  problems.push(...providesProblems(provides))

  let scanned = 0
  for (const file of files) {
    for (const gate of file.gatingHooks) {
      if (!gate.hasCatch) problems.push(`${gate.module}: gating hook without .catch: ${gate.hook}`)
    }
    if (file.modules === null) {
      problems.push(
        `${file.type ?? 'file'}: validate could not read the hooks module (modules: null)`,
      )
      continue
    }
    for (const { module, uses } of file.modules) {
      scanned += 1
      for (const call of uses.calls) {
        if (!isAllowedCall(call, calls)) problems.push(`${module}: call not allowed: $.${call}`)
      }
      for (const name of uses.env?.reads ?? []) {
        if (!env.includes(name)) problems.push(`${module}: env read not allowed: ${name}`)
      }
      for (const name of uses.env?.writes ?? []) {
        problems.push(`${module}: env write not allowed: ${name}`)
      }
      problems.push(...stateProblems(module, uses.state, allow.state))
    }
  }
  if (scanned === 0 && !problems.some((p) => p.includes('modules: null'))) {
    problems.push('no hooks module was scanned')
  }
  return problems
}

/**
 * What is wrong with a module's `$.state`: another plugin's, a key the contract
 * does not declare, or any use without a readable contract. One line each.
 *
 * @param {string} module
 * @param {StateUses | undefined} state
 * @param {readonly string[] | undefined} declared
 * @returns {string[]}
 */
function stateProblems(module, state, declared) {
  if (state === undefined) return []
  const entries = [...state.reads, ...state.writes]
  if (entries.length === 0) return []
  if (declared === undefined) {
    return [`${module}: uses $.state, but types/index.d.ts declares no ${STATE_PLUGIN} state`]
  }
  /** @type {Set<string>} */
  const problems = new Set()
  for (const { plugin, key } of entries) {
    if (plugin !== STATE_PLUGIN)
      problems.add(`${module}: state of another plugin: ${plugin}.${key}`)
    else if (!declared.includes(key)) {
      problems.add(`${module}: state key not declared in types/index.d.ts: ${plugin}.${key}`)
    }
  }
  return [...problems]
}

/** The mod's state contract, from the package root (where npm runs this script). */
const readContractFile = () => readFileSync('plugins/model-meter/types/index.d.ts', 'utf8')

/* c8 ignore start -- spawns the real CLI; exercised by `npm run capabilities` */
/** Runs the CLI and returns its JSON report; validate exits 1 with a report on errors. */
function runValidate() {
  try {
    return execFileSync('claude', ['plugin', 'validate', PLUGIN_DIR, '--json'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
  } catch (error) {
    const stdout = /** @type {{ stdout?: unknown }} */ (error).stdout
    if (typeof stdout === 'string' && stdout !== '') return stdout
    throw error
  }
}
/* c8 ignore stop */

/**
 * @param {{ run?: () => string, readContract?: () => string, write?: (text: string) => void }} [io]
 * @returns {0 | 1}
 */
export function main({
  run = runValidate,
  readContract = readContractFile,
  write = (text) => process.stdout.write(text),
} = {}) {
  let output
  try {
    output = run()
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    write(`capabilities: could not run claude plugin validate: ${reason}\n`)
    return 1
  }
  /** @type {unknown} */
  let report
  try {
    report = JSON.parse(output)
  } catch {
    write('capabilities: could not read the validate report (empty or not JSON)\n')
    return 1
  }
  /** @type {string[] | undefined} */
  let declared
  try {
    declared = declaredStateKeys(readContract())
  } catch {
    declared = undefined
  }
  const problems = findViolations(report, declared === undefined ? {} : { state: declared })
  if (problems.length === 0) {
    write(`capabilities: ok (${PLUGIN_DIR} stays inside the allowlist)\n`)
    return 0
  }
  write(`capabilities: ${String(problems.length)} problem(s) in ${PLUGIN_DIR}\n`)
  for (const problem of problems) write(`  - ${problem}\n`)
  return 1
}

/* c8 ignore next 3 -- entry point when run as a script */
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  process.exitCode = main()
}
