// `npm run audit`: npm audit over every dependency, failing on any advisory
// that has no current, Maintainer-approved exception (docs/tasks/T-001,
// «Excepciones de seguridad»). It fails when:
//   1. an advisory of any severity has no exception;
//   2. an exception has expired (UTC; the expiry day itself still counts);
//   3. an exception matches no active advisory (remove it);
//   4. an exception is not scope "dev" or its package is a runtime dependency;
//   5. allow-ghsas in dependency-review.yml differs from the exceptions file.
// Anything it cannot read fails closed. No dependencies.

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

export const EXCEPTIONS_FILE = 'security/audit-exceptions.json'
export const DEPENDENCY_REVIEW_FILE = '.github/workflows/dependency-review.yml'

const SEVERITIES = ['info', 'low', 'moderate', 'high', 'critical']
const GHSA = /GHSA-[0-9a-z]{4}-[0-9a-z]{4}-[0-9a-z]{4}/

/**
 * @typedef {{ id: string, package: string, severity: string }} Advisory
 * @typedef {{ id: string, package: string, severity: string, scope: string, reason: string,
 *   approvedBy: string, approvedOn: string, expires: string }} AuditException
 */

/** @param {unknown} value */
const isObject = (value) => typeof value === 'object' && value !== null

/** @param {unknown} value */
const isText = (value) => typeof value === 'string' && value !== ''

/** @param {unknown} value */
function isDay(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value)
}

/**
 * Every advisory in an `npm audit --json` report, once per id and package.
 *
 * @param {unknown} report
 * @returns {Advisory[] | null} null when the report is not one
 */
function activeAdvisories(report) {
  if (!isObject(report)) return null
  const { vulnerabilities } = /** @type {Record<string, unknown>} */ (report)
  if (!isObject(vulnerabilities)) return null
  /** @type {Map<string, Advisory>} */
  const found = new Map()
  for (const entry of Object.values(/** @type {Record<string, unknown>} */ (vulnerabilities))) {
    if (!isObject(entry)) return null
    const { via } = /** @type {Record<string, unknown>} */ (entry)
    if (!Array.isArray(via)) return null
    for (const cause of /** @type {unknown[]} */ (via)) {
      if (typeof cause === 'string') continue // a package that is vulnerable through another
      if (!isObject(cause)) return null
      const { name, severity, url } = /** @type {Record<string, unknown>} */ (cause)
      if (!isText(name) || !isText(severity) || !isText(url)) return null
      const id = GHSA.exec(String(url))?.[0] ?? String(url)
      const advisory = { id, package: String(name), severity: String(severity) }
      found.set(`${advisory.id} ${advisory.package}`, advisory)
    }
  }
  return [...found.values()]
}

/**
 * Every package name in an `npm ls --omit=dev --all --json` tree.
 *
 * @param {unknown} report
 * @returns {Set<string> | null} null when the report is not one
 */
function runtimePackages(report) {
  if (!isObject(report)) return null
  /** @type {Set<string>} */
  const names = new Set()
  /** @param {unknown} node */
  const walk = (node) => {
    const { dependencies } = /** @type {Record<string, unknown>} */ (node)
    if (dependencies === undefined) return true
    if (!isObject(dependencies)) return false
    for (const [name, child] of Object.entries(
      /** @type {Record<string, unknown>} */ (dependencies),
    )) {
      if (!isObject(child)) return false
      names.add(name)
      if (!walk(child)) return false
    }
    return true
  }
  return walk(report) ? names : null
}

/**
 * @param {unknown} entry
 * @returns {entry is AuditException}
 */
function isException(entry) {
  if (!isObject(entry)) return false
  const e = /** @type {Record<string, unknown>} */ (entry)
  return (
    typeof e.id === 'string' &&
    /^GHSA-[0-9a-z]{4}-[0-9a-z]{4}-[0-9a-z]{4}$/.test(e.id) &&
    isText(e.package) &&
    typeof e.severity === 'string' &&
    SEVERITIES.includes(e.severity) &&
    isText(e.scope) &&
    isText(e.reason) &&
    e.approvedBy === 'maintainer' &&
    isDay(e.approvedOn) &&
    isDay(e.expires)
  )
}

/**
 * The GHSA ids `allow-ghsas` lists in a workflow: a plain or flow list on
 * one line. Null when there are several such lines or a block scalar.
 *
 * @param {string} workflow
 * @returns {string[] | null}
 */
export function allowedGhsas(workflow) {
  const lines = workflow.split(/\r?\n/).filter((line) => /^\s*allow-ghsas\s*:/.test(line))
  const [line, ...others] = lines
  if (line === undefined) return []
  if (others.length > 0) return null
  let value = line
    .replace(/^\s*allow-ghsas\s*:/, '')
    .replace(/\s#.*$/, '')
    .trim()
  if (value.startsWith('[') && value.endsWith(']')) value = value.slice(1, -1)
  value = value.replace(/^(['"])(.*)\1$/, '$2')
  if (value === '' || /^[|>]/.test(value)) return null
  return value
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id !== '')
}

/**
 * @param {{ audit: unknown, ls: unknown, exceptions: unknown, workflow: string, today: string }} input
 * @returns {string[]} one line per problem; empty when the tree is acceptable
 */
export function findAuditProblems({ audit, ls, exceptions, workflow, today }) {
  const advisories = activeAdvisories(audit)
  if (advisories === null) return ['could not read the npm audit report']
  const runtime = runtimePackages(ls)
  if (runtime === null) return ['could not read the npm ls report']
  if (!Array.isArray(exceptions)) return [`${EXCEPTIONS_FILE} must be a list`]
  /** @type {AuditException[]} */
  const approved = []
  for (const [index, entry] of /** @type {unknown[]} */ (exceptions).entries()) {
    if (!isException(entry)) return [`${EXCEPTIONS_FILE} entry ${String(index + 1)} is not valid`]
    if (approved.some((e) => e.id === entry.id))
      return [`${EXCEPTIONS_FILE} lists ${entry.id} twice`]
    approved.push(entry)
  }
  const allowed = allowedGhsas(workflow)
  if (allowed === null) return [`could not read allow-ghsas in ${DEPENDENCY_REVIEW_FILE}`]

  /** @type {string[]} */
  const problems = []
  /** @param {Advisory} a @param {AuditException} e */
  const matches = (a, e) => a.id === e.id && a.package === e.package

  for (const advisory of advisories) {
    const exception = approved.find((e) => matches(advisory, e))
    if (exception === undefined) {
      problems.push(
        `advisory without an exception: ${advisory.id} (${advisory.package}, ${advisory.severity})`,
      )
    } else if (exception.severity !== advisory.severity) {
      problems.push(
        `advisory severity is ${advisory.severity}, the exception approved ${exception.severity}: ${advisory.id}`,
      )
    }
  }
  for (const exception of approved) {
    if (exception.expires < today) {
      problems.push(
        `exception expired on ${exception.expires}: ${exception.id} (renewing it needs the Maintainer)`,
      )
    }
    if (!advisories.some((a) => matches(a, exception))) {
      problems.push(`exception matches no active advisory, remove it: ${exception.id}`)
    }
    if (exception.scope !== 'dev') {
      problems.push(`exception must be scope "dev": ${exception.id}`)
    } else if (runtime.has(exception.package)) {
      problems.push(`exception covers a runtime dependency: ${exception.id} (${exception.package})`)
    }
  }
  const expected = approved.map((e) => e.id).sort()
  const listed = [...allowed].sort()
  if (expected.join() !== listed.join()) {
    problems.push(
      `allow-ghsas in ${DEPENDENCY_REVIEW_FILE} (${listed.join(', ') || 'none'}) does not match ${EXCEPTIONS_FILE} (${expected.join(', ') || 'none'})`,
    )
  }
  return problems
}

/* c8 ignore start -- spawns npm; exercised by `npm run audit` */
/**
 * Runs npm with the same npm that runs this script, and returns its stdout:
 * `npm audit` and `npm ls` exit 1 with a full JSON report when they find something.
 *
 * @param {string[]} args
 */
function runNpm(args) {
  const npm = process.env.npm_execpath
  if (npm === undefined) throw new Error('run it through `npm run audit`')
  try {
    return execFileSync(process.execPath, [npm, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
  } catch (error) {
    const stdout = /** @type {{ stdout?: unknown }} */ (error).stdout
    if (typeof stdout === 'string' && stdout !== '') return stdout
    throw error
  }
}

/**
 * The two files the audit reads, from the package root (where npm runs it).
 *
 * @param {'exceptions' | 'workflow'} which
 */
const readInput = (which) =>
  which === 'exceptions'
    ? readFileSync('security/audit-exceptions.json', 'utf8')
    : readFileSync('.github/workflows/dependency-review.yml', 'utf8')
/* c8 ignore stop */

/**
 * @param {string} text
 * @param {string} what
 */
function parse(text, what) {
  try {
    /** @type {unknown} */
    const value = JSON.parse(text)
    return { value }
  } catch {
    return { error: `could not read ${what} (not JSON)` }
  }
}

/**
 * @param {{ run?: (args: string[]) => string, read?: (which: 'exceptions' | 'workflow') => string, today?: string,
 *   write?: (text: string) => void }} [io]
 * @returns {0 | 1}
 */
export function main({
  run = runNpm,
  read = readInput,
  today = new Date().toISOString().slice(0, 10),
  write = (text) => process.stdout.write(text),
} = {}) {
  let texts
  try {
    texts = {
      audit: run(['audit', '--json']),
      ls: run(['ls', '--omit=dev', '--all', '--json']),
      exceptions: read('exceptions'),
      workflow: read('workflow'),
    }
  } catch (error) {
    write(`audit: could not run: ${error instanceof Error ? error.message : String(error)}\n`)
    return 1
  }
  const audit = parse(texts.audit, 'the npm audit report')
  const ls = parse(texts.ls, 'the npm ls report')
  const exceptions = parse(texts.exceptions, EXCEPTIONS_FILE)
  const unreadable = [audit, ls, exceptions].flatMap((r) => ('error' in r ? [r.error] : []))
  const problems =
    unreadable.length > 0
      ? unreadable
      : findAuditProblems({
          audit: audit.value,
          ls: ls.value,
          exceptions: exceptions.value,
          workflow: texts.workflow,
          today,
        })
  if (problems.length === 0) {
    const list = /** @type {AuditException[]} */ (exceptions.value)
    const covered = list.map((e) => `${e.id}, expires ${e.expires}`).join('; ')
    write(
      `audit: ok, ${String(list.length)} ${list.length === 1 ? 'advisory' : 'advisories'} covered by an exception${covered === '' ? '' : ` (${covered})`}\n`,
    )
    return 0
  }
  write(`audit: ${String(problems.length)} problem(s)\n`)
  for (const problem of problems) write(`  - ${problem}\n`)
  return 1
}

/* c8 ignore next 3 -- entry point when run as a script */
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  process.exitCode = main()
}
