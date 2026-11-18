// Fails when the model-meter mod reaches for anything outside its allowlist
// (docs/PLAN.md §5–§6) or registers a gating hook that could swallow an event
// (docs/PLAN.md §2.4, decision 6).
//
// It reads the structured part of `claude plugin validate --json`
// (`modules[].uses` and `gatingHooks`), which the engine documents as whole
// and as a public contract; the `notes` lines are display text, "cleaned and
// cut". Messages name modules as hooks.json spells them and never echo the
// report's absolute paths (`target`, `file`).

import { execFileSync } from 'node:child_process'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

export const PLUGIN_DIR = 'plugins/model-meter'

/** What the mod may call on `$`, spelled `noun.method`; `noun.*` allows a whole noun. */
export const ALLOWED_CALLS = Object.freeze([
  'session.model',
  'store.get',
  'store.set',
  'ui.*',
  'clock.now',
])

/** Environment variables the mod may read. None since T-000. */
export const ALLOWED_ENV = Object.freeze(/** @type {string[]} */ ([]))

/**
 * @typedef {{ module: string, hook: string, hasCatch: boolean }} GatingHook
 * @typedef {{ module: string, uses: { calls: string[], env?: { reads: string[], writes: string[] } } }} ModuleUses
 * @typedef {{ type?: string, gatingHooks: GatingHook[], modules: ModuleUses[] | null }} ReportFile
 */

/**
 * @param {string} call
 * @param {readonly string[]} [allowed]
 */
export function isAllowedCall(call, allowed = ALLOWED_CALLS) {
  return allowed.some((entry) =>
    entry.endsWith('.*') ? call.startsWith(entry.slice(0, -1)) : call === entry,
  )
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
  const { calls, env } = /** @type {Record<string, unknown>} */ (uses)
  if (!isStringList(calls)) return false
  if (env === undefined) return true
  if (!isObject(env)) return false
  const { reads, writes } = /** @type {Record<string, unknown>} */ (env)
  return isStringList(reads) && isStringList(writes)
}

/**
 * Everything in a validate report that breaks the allowlist, one line each;
 * empty when the mod stays inside it. Anything unreadable fails closed.
 *
 * @param {unknown} report parsed `claude plugin validate --json`
 * @param {{ calls?: readonly string[], env?: readonly string[] }} [allow]
 * @returns {string[]}
 */
export function findViolations(report, allow = {}) {
  const calls = allow.calls ?? ALLOWED_CALLS
  const env = allow.env ?? ALLOWED_ENV
  if (!isObject(report)) return ['unexpected validate report shape']
  const { success, manifest, contents } = /** @type {Record<string, unknown>} */ (report)
  if (!Array.isArray(contents)) return ['unexpected validate report shape']
  const entries = /** @type {unknown[]} */ (contents)
  const files = manifest === null || manifest === undefined ? entries : [manifest, ...entries]
  if (!files.every(isReportFile)) return ['unexpected validate report shape']

  /** @type {string[]} */
  const problems = []
  if (success !== true) problems.push('claude plugin validate reported failure')

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
    }
  }
  if (scanned === 0 && !problems.some((p) => p.includes('modules: null'))) {
    problems.push('no hooks module was scanned')
  }
  return problems
}

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
 * @param {{ run?: () => string, write?: (text: string) => void }} [io]
 * @returns {0 | 1}
 */
export function main({ run = runValidate, write = (text) => process.stdout.write(text) } = {}) {
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
  const problems = findViolations(report)
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
