// The release package (T-012): what the marketplace serves, as a
// deterministic archive with its SHA-256.
//
//   node scripts/package.mjs [--out <dir>]
//
// 1. The files git tracks in the package paths must be exactly PUBLISHED;
//    anything missing or extra fails before an archive is made.
// 2. `git archive` packs them from HEAD as model-meter-<version>.tar.gz, the
//    version read from plugin.json. A commit always gives the same bytes: the
//    entries carry the commit's time, and git compresses with its own gzip.
// 3. <dir>/SHA256SUMS gets the archive's digest, as `sha256sum --check` reads it.
//
// The release workflow runs it on the tag; CI runs it on every pull request
// as a dry run, publishing nothing. No dependencies.

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

/** Where the published files live: the plugin's folder, and the marketplace that lists it. */
export const PACKAGE_PATHS = Object.freeze([
  'plugins/model-meter',
  '.claude-plugin/marketplace.json',
])

/**
 * Every file the marketplace serves, and nothing else. A file added to the
 * plugin folder must be added here too, on purpose, or packaging fails.
 */
export const PUBLISHED = Object.freeze([
  '.claude-plugin/marketplace.json',
  'plugins/model-meter/.claude-plugin/plugin.json',
  'plugins/model-meter/README.md',
  'plugins/model-meter/hooks/core/badge.ts',
  'plugins/model-meter/hooks/core/band.ts',
  'plugins/model-meter/hooks/core/effort.ts',
  'plugins/model-meter/hooks/core/layout.ts',
  'plugins/model-meter/hooks/core/model.ts',
  'plugins/model-meter/hooks/core/options.ts',
  'plugins/model-meter/hooks/core/sanitize.ts',
  'plugins/model-meter/hooks/core/sprite.ts',
  'plugins/model-meter/hooks/core/state.ts',
  'plugins/model-meter/hooks/hooks.json',
  'plugins/model-meter/hooks/register.test.tsx',
  'plugins/model-meter/hooks/register.tsx',
  'plugins/model-meter/tsconfig.json',
  'plugins/model-meter/types/index.d.ts',
])

const USAGE = 'usage: node scripts/package.mjs [--out <dir>]\n'

/**
 * What keeps the tracked files from being exactly the published ones.
 * @param {readonly string[]} tracked @param {readonly string[]} [published]
 * @returns {string[]}
 */
export function fileListProblems(tracked, published = PUBLISHED) {
  const have = new Set(tracked)
  const want = new Set(published)
  return [
    ...[...want]
      .filter((file) => !have.has(file))
      .map((file) => `missing from the package: ${file}`),
    ...[...have]
      .filter((file) => !want.has(file))
      .map((file) => `not on the published list: ${file}`),
  ]
}

/** @param {string} version */
export const archiveName = (version) => `model-meter-${version}.tar.gz`

/**
 * The lines of a SHA256SUMS file. @param {readonly { name: string, digest: string }[]} entries
 */
export const sha256sums = (entries) =>
  entries.map(({ name, digest }) => `${digest}  ${name}\n`).join('')

/** The version plugin.json declares. @param {string} text @returns {string | undefined} */
function versionOf(text) {
  try {
    const manifest = /** @type {unknown} */ (JSON.parse(text))
    const version =
      typeof manifest === 'object' && manifest !== null
        ? /** @type {{ version?: unknown }} */ (manifest).version
        : undefined
    return typeof version === 'string' && version !== '' ? version : undefined
  } catch {
    return undefined
  }
}

/** The output folder from the arguments; undefined when they are not understood. @param {string[]} argv */
function outDirOf(argv) {
  if (argv.length === 0) return 'dist'
  const [flag, dir] = argv
  return argv.length === 2 && flag === '--out' && dir !== undefined && dir !== '' ? dir : undefined
}

/* c8 ignore start -- touches git and the disk; exercised by CI's package dry run */
// The paths below are the output folder (`dist`, or --out) and a name built
// from plugin.json's version: this script's own, never user input.
/** @param {string[]} args */
const runGit = (args) => execFileSync('git', args, { encoding: 'utf8' })
const readPluginJson = () => readFileSync('plugins/model-meter/.claude-plugin/plugin.json', 'utf8')
/** @param {string} path */
const sha256File = (path) =>
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- the archive this script names
  createHash('sha256').update(readFileSync(path)).digest('hex')
/** @param {string} path @param {string} text */
const writeTextFile = (path, text) => {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- SHA256SUMS in the output folder
  writeFileSync(path, text)
}
/** @param {string} path */
const makeDirectory = (path) => {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- the output folder
  mkdirSync(path, { recursive: true })
}
/* c8 ignore stop */

/**
 * @param {{
 *   argv?: string[],
 *   git?: (args: string[]) => string,
 *   readText?: () => string,
 *   sha256?: (path: string) => string,
 *   writeText?: (path: string, text: string) => void,
 *   makeDir?: (path: string) => void,
 *   write?: (text: string) => void,
 * }} [io]
 * @returns {0 | 1}
 */
export function main({
  argv = process.argv.slice(2),
  git = runGit,
  readText = readPluginJson,
  sha256 = sha256File,
  writeText = writeTextFile,
  makeDir = makeDirectory,
  write = (text) => process.stdout.write(text),
} = {}) {
  const out = outDirOf(argv)
  if (out === undefined) {
    write(USAGE)
    return 1
  }
  let version
  try {
    version = versionOf(readText())
  } catch {
    version = undefined
  }
  if (version === undefined) {
    write('package: could not read the version of plugins/model-meter/.claude-plugin/plugin.json\n')
    return 1
  }
  const name = archiveName(version)
  const archive = `${out}/${name}`
  try {
    const tracked = git(['ls-tree', '-r', '--name-only', 'HEAD', '--', ...PACKAGE_PATHS])
      .split('\n')
      .filter((line) => line !== '')
    const problems = fileListProblems(tracked)
    if (problems.length > 0) {
      write(`package: the tracked files are not the published list (${String(problems.length)})\n`)
      for (const problem of problems) write(`  - ${problem}\n`)
      return 1
    }
    makeDir(out)
    git([
      'archive',
      '--format=tar.gz',
      `--prefix=model-meter-${version}/`,
      `--output=${archive}`,
      'HEAD',
      '--',
      ...PACKAGE_PATHS,
    ])
  } catch (error) {
    write(`package: git failed: ${error instanceof Error ? error.message : String(error)}\n`)
    return 1
  }
  const sums = sha256sums([{ name, digest: sha256(archive) }])
  writeText(`${out}/SHA256SUMS`, sums)
  write(`package: ${String(PUBLISHED.length)} files in ${name}\n`)
  for (const file of [...PUBLISHED].sort()) write(`  ${file}\n`)
  write(`SHA256SUMS:\n${sums}`)
  return 0
}

/* c8 ignore next 3 -- entry point when run as a script */
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  process.exitCode = main()
}
