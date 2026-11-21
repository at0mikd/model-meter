// The release's version checks (T-012). The release workflow calls it on a
// pushed tag:
//
//   node scripts/release-version.mjs check vX.Y.Z   fails unless the tag is v
//     plus the version of plugin.json, marketplace.json and package.json;
//   node scripts/release-version.mjs notes vX.Y.Z   prints that version's
//     section of CHANGELOG.md, the body of the GitHub release.
//
// Anything it cannot read fails closed. No dependencies.

import { readFileSync } from 'node:fs'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

/** The three manifests that carry the version, from the package root. */
export const MANIFESTS = Object.freeze({
  plugin: 'plugins/model-meter/.claude-plugin/plugin.json',
  marketplace: '.claude-plugin/marketplace.json',
  pkg: 'package.json',
})

export const CHANGELOG = 'CHANGELOG.md'
const PLUGIN = 'model-meter'
/** v plus a version: major, minor and patch (v0.1.0). */
const TAG = /^v(\d+\.\d+\.\d+)$/
const USAGE = 'usage: node scripts/release-version.mjs check <vX.Y.Z> | notes <vX.Y.Z>\n'

/** @param {unknown} value @returns {value is Record<string, unknown>} */
const isObject = (value) => typeof value === 'object' && value !== null

/** @param {unknown} value */
const textOrNothing = (value) => (typeof value === 'string' ? value : undefined)

/** @param {unknown} manifest */
const versionField = (manifest) =>
  isObject(manifest) ? textOrNothing(manifest.version) : undefined

/** The marketplace's entry for model-meter, and its version. @param {unknown} marketplace */
function marketplaceVersion(marketplace) {
  const plugins = isObject(marketplace) ? marketplace.plugins : undefined
  if (!Array.isArray(plugins)) return undefined
  const entry = /** @type {unknown[]} */ (plugins).find(
    (plugin) => isObject(plugin) && plugin.name === PLUGIN,
  )
  return versionField(entry)
}

/**
 * @typedef {{ plugin: unknown, marketplace: unknown, pkg: unknown }} Manifests
 * @typedef {{ file: string, version: string | undefined }} Declared
 */

/** The version each manifest declares, by file. @param {Manifests} manifests @returns {Declared[]} */
export function versionsOf({ plugin, marketplace, pkg }) {
  return [
    { file: MANIFESTS.plugin, version: versionField(plugin) },
    { file: MANIFESTS.marketplace, version: marketplaceVersion(marketplace) },
    { file: MANIFESTS.pkg, version: versionField(pkg) },
  ]
}

/**
 * Why the tag cannot be released from these manifests; none when it is v
 * plus the version each of them declares.
 * @param {string} tag @param {Declared[]} versions @returns {string[]}
 */
export function tagProblems(tag, versions) {
  const wanted = TAG.exec(tag)?.[1]
  if (wanted === undefined) return [`the tag "${tag}" is not v plus a version (vX.Y.Z)`]
  return versions.flatMap(({ file, version }) => {
    if (version === undefined) return [`${file} declares no version`]
    return version === wanted ? [] : [`${file} declares ${version}, not ${wanted}`]
  })
}

/**
 * One version's section of the changelog, without its `## [X.Y.Z]` heading;
 * undefined when there is none, or it is empty.
 * @param {string} changelog @param {string} version @returns {string | undefined}
 */
export function releaseNotes(changelog, version) {
  const lines = changelog.split(/\r?\n/)
  const start = lines.findIndex(
    (line) => line === `## [${version}]` || line.startsWith(`## [${version}] `),
  )
  if (start === -1) return undefined
  const rest = lines.slice(start + 1)
  const end = rest.findIndex((line) => line.startsWith('## ['))
  const notes = (end === -1 ? rest : rest.slice(0, end)).join('\n').trim()
  return notes === '' ? undefined : notes
}

/* c8 ignore start -- reads the real files; exercised by the release workflow */
/** One of the files the script reads, by its literal path from the package root. @param {string} path */
function readFromRoot(path) {
  switch (path) {
    case MANIFESTS.plugin:
      return readFileSync('plugins/model-meter/.claude-plugin/plugin.json', 'utf8')
    case MANIFESTS.marketplace:
      return readFileSync('.claude-plugin/marketplace.json', 'utf8')
    case MANIFESTS.pkg:
      return readFileSync('package.json', 'utf8')
    default:
      return readFileSync('CHANGELOG.md', 'utf8')
  }
}
/* c8 ignore stop */

/**
 * @param {{ argv?: string[], readText?: (path: string) => string, write?: (text: string) => void }} [io]
 * @returns {0 | 1}
 */
export function main({
  argv = process.argv.slice(2),
  readText = readFromRoot,
  write = (text) => process.stdout.write(text),
} = {}) {
  const [command, tag = ''] = argv
  const version = TAG.exec(tag)?.[1]
  if ((command !== 'check' && command !== 'notes') || version === undefined) {
    write(USAGE)
    return 1
  }
  if (command === 'notes') {
    let changelog
    try {
      changelog = readText(CHANGELOG)
    } catch {
      write(`release-version: could not read ${CHANGELOG}\n`)
      return 1
    }
    const notes = releaseNotes(changelog, version)
    if (notes === undefined) {
      write(`release-version: no notes for ${version} in ${CHANGELOG}\n`)
      return 1
    }
    write(`${notes}\n`)
    return 0
  }
  /** @param {string} path @returns {{ value: unknown } | undefined} */
  const parse = (path) => {
    try {
      return { value: JSON.parse(readText(path)) }
    } catch {
      write(`release-version: could not read ${path}\n`)
      return undefined
    }
  }
  const plugin = parse(MANIFESTS.plugin)
  const marketplace = plugin && parse(MANIFESTS.marketplace)
  const pkg = marketplace && parse(MANIFESTS.pkg)
  if (plugin === undefined || marketplace === undefined || pkg === undefined) return 1
  const problems = tagProblems(
    tag,
    versionsOf({ plugin: plugin.value, marketplace: marketplace.value, pkg: pkg.value }),
  )
  if (problems.length === 0) {
    write(`release-version: ${tag} matches plugin.json, marketplace.json and package.json\n`)
    return 0
  }
  write(`release-version: ${String(problems.length)} problem(s) with ${tag}\n`)
  for (const problem of problems) write(`  - ${problem}\n`)
  return 1
}

/* c8 ignore next 3 -- entry point when run as a script */
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  process.exitCode = main()
}
