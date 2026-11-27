// The release's digest binding (T-015, audit N3), tested on the workflow files
// themselves: the steps are read from release.yml and ci.yml and run with bash
// against a local fixture, the T-013 scenario included (the archive replaced and
// SHA256SUMS regenerated to match it).

import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { after, describe, test } from 'node:test'

const RELEASE = readFileSync('.github/workflows/release.yml', 'utf8')
const CI = readFileSync('.github/workflows/ci.yml', 'utf8')

const CHECK_STEP = 'The archive is the one the package job built'
const DIGEST_STEP = "The archive's digest, as a job output"

/** @param {string} line */
const indentOf = (line) => line.length - line.trimStart().length

/**
 * The lines of one job of a workflow, from its `  <job>:` line to the next job.
 *
 * @param {string} workflow
 * @param {string} job
 */
function jobLines(workflow, job) {
  const lines = workflow.split('\n')
  const start = lines.indexOf(`  ${job}:`)
  assert.ok(start >= 0, `job ${job}`)
  const rest = lines.slice(start + 1)
  const end = rest.findIndex((line) => /^ {2}\S/.test(line))
  return end < 0 ? rest : rest.slice(0, end)
}

/**
 * The script of a step's `run: |` block, dedented, found by the step's name.
 *
 * @param {string} workflow
 * @param {string} job
 * @param {string} name
 */
function stepRun(workflow, job, name) {
  const lines = jobLines(workflow, job)
  const at = lines.findIndex((line) => line.trim() === `- name: ${name}`)
  assert.ok(at >= 0, `step "${name}" in ${job}`)
  const runAt = lines.findIndex((line, i) => i > at && line.trim() === 'run: |')
  assert.ok(runAt > at, `run block of "${name}" in ${job}`)
  const runLine = lines.at(runAt) ?? ''
  const body = []
  for (const line of lines.slice(runAt + 1)) {
    if (line.trim() !== '' && indentOf(line) <= indentOf(runLine)) break
    body.push(line)
  }
  const indent = Math.min(...body.filter((l) => l.trim() !== '').map(indentOf))
  return `${body
    .map((line) => line.slice(indent))
    .join('\n')
    .trimEnd()}\n`
}

/**
 * The text of a whole step, from its `- name:` line to the next step.
 *
 * @param {string} workflow
 * @param {string} job
 * @param {string} name
 */
function stepText(workflow, job, name) {
  const lines = jobLines(workflow, job)
  const at = lines.findIndex((line) => line.trim() === `- name: ${name}`)
  assert.ok(at >= 0, `step "${name}" in ${job}`)
  const next = lines.findIndex((line, i) => i > at && /^ {6}- /.test(line))
  return lines.slice(at, next < 0 ? undefined : next).join('\n')
}

describe('the same digest steps everywhere', () => {
  test('attest, release and the CI dry run check the archive with the same script', () => {
    const attest = stepRun(RELEASE, 'attest', CHECK_STEP)
    assert.equal(stepRun(RELEASE, 'release', CHECK_STEP), attest)
    assert.equal(stepRun(CI, 'package-digest', CHECK_STEP), attest)
  })

  test('the release and the dry run compute the digest output with the same script', () => {
    assert.equal(stepRun(CI, 'package', DIGEST_STEP), stepRun(RELEASE, 'package', DIGEST_STEP))
  })
})

describe('release.yml binds the digest across jobs (T-015)', () => {
  const lines = (/** @type {string} */ job) => jobLines(RELEASE, job).join('\n')

  test('package exposes the digest, and only the digest, as its output', () => {
    assert.match(
      lines('package'),
      /\n {4}outputs:\n {6}digest: \$\{\{ steps\.digest\.outputs\.digest \}\}\n {4}steps:/,
    )
  })

  test('attest checks the archive first, then attests the digest, not a path', () => {
    const attest = lines('attest')
    assert.ok(attest.indexOf(CHECK_STEP) < attest.indexOf('actions/attest-build-provenance@'))
    assert.match(attest, /subject-name: \$\{\{ steps\.archive\.outputs\.name \}\}/)
    assert.match(attest, /subject-digest: sha256:\$\{\{ needs\.package\.outputs\.digest \}\}/)
    assert.doesNotMatch(attest, /subject-path/)
  })

  test('release checks the archive, then the tag, then publishes that exact file', () => {
    const release = lines('release')
    assert.match(release, /needs: \[package, attest\]/)
    const check = release.indexOf(CHECK_STEP)
    const tag = release.indexOf("The tag still points to this run's commit")
    const create = release.indexOf('gh release create')
    assert.ok(check > 0 && check < tag && tag < create)
    assert.match(release, /gh release create "\$TAG" "dist\/\$NAME" dist\/SHA256SUMS/)
    assert.doesNotMatch(release, /gh release create[^\n]*model-meter-\*/)
  })

  test('the tag check compares the remote tag with GITHUB_SHA, through env only', () => {
    const step = stepText(RELEASE, 'release', "The tag still points to this run's commit")
    assert.match(step, /git\/ref\/tags\/\$TAG/)
    assert.match(step, /if \[ "\$commit" != "\$GITHUB_SHA" \]/)
    assert.doesNotMatch(step.slice(step.indexOf('run:')), /\$\{\{/)
  })

  test('no digest step interpolates an expression into its script', () => {
    for (const [workflow, job, name] of /** @type {const} */ ([
      [RELEASE, 'package', DIGEST_STEP],
      [RELEASE, 'attest', CHECK_STEP],
      [RELEASE, 'release', CHECK_STEP],
      [CI, 'package', DIGEST_STEP],
      [CI, 'package-digest', CHECK_STEP],
    ])) {
      assert.doesNotMatch(stepRun(workflow, job, name), /\$\{\{/, `${job}: ${name}`)
    }
  })
})

const bashSkip = process.platform === 'linux' ? false : 'needs bash and GNU sha256sum (Linux)'

describe('the steps, run against a local fixture', { skip: bashSkip }, () => {
  const root = mkdtempSync(join(tmpdir(), 'release-digest-'))
  after(() => {
    rmSync(root, { recursive: true, force: true })
  })
  const digestScript = stepRun(RELEASE, 'package', DIGEST_STEP)
  const checkScript = stepRun(RELEASE, 'attest', CHECK_STEP)
  const NAME = 'model-meter-0.1.0.tar.gz'
  let n = 0

  /** @param {Buffer} bytes */
  const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')

  /**
   * A fresh dist/ with an archive and its SHA256SUMS, as package.mjs writes them.
   *
   * @param {Buffer} bytes
   * @param {string} [name]
   */
  function fixture(bytes, name = NAME) {
    n += 1
    const dir = join(root, String(n))
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- this test's own temporary folder
    mkdirSync(join(dir, 'dist'), { recursive: true })
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- a file in this test's own temporary folder
    writeFileSync(join(dir, 'dist', name), bytes)
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- a file in this test's own temporary folder
    writeFileSync(join(dir, 'dist', 'SHA256SUMS'), `${sha256(bytes)}  ${name}\n`)
    return dir
  }

  /**
   * Runs a step's script in `dir` with bash, as Actions does.
   *
   * @param {string} script
   * @param {string} dir
   * @param {Record<string, string>} env
   */
  function run(script, dir, env) {
    const output = join(dir, 'github-output')
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- a file in this test's own temporary folder
    writeFileSync(output, '')
    try {
      const stdout = execFileSync('bash', ['-c', script], {
        cwd: dir,
        encoding: 'utf8',
        env: { PATH: process.env.PATH ?? '', GITHUB_OUTPUT: output, ...env },
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- a file in this test's own temporary folder
      return { code: 0, stdout, outputs: readFileSync(output, 'utf8') }
    } catch (error) {
      const { status, stdout } = /** @type {{ status: number, stdout: string }} */ (error)
      return { code: status, stdout, outputs: '' }
    }
  }

  const GENUINE = Buffer.from('the archive the package job built\n')
  const SWAPPED = Buffer.from('a different archive, uploaded later\n')

  /** The package job's digest output for the genuine archive, from its own step. */
  function packageDigest() {
    const result = run(digestScript, fixture(GENUINE), {})
    assert.equal(result.code, 0)
    const match = /^digest=([0-9a-f]{64})$/m.exec(result.outputs)
    assert.ok(match?.[1])
    return match[1]
  }

  test('the package step outputs the archive digest', () => {
    assert.equal(packageDigest(), sha256(GENUINE))
  })

  test('the genuine archive passes, and its name becomes the attestation subject', () => {
    const result = run(checkScript, fixture(GENUINE), { DIGEST: packageDigest(), TAG: 'v0.1.0' })
    assert.equal(result.code, 0, result.stdout)
    assert.equal(result.outputs, `name=${NAME}\n`)
  })

  test('the T-013 scenario: a swapped archive with a regenerated SHA256SUMS fails', () => {
    const dir = fixture(SWAPPED)
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- a file in this test's own temporary folder
    const sums = readFileSync(join(dir, 'dist', 'SHA256SUMS'), 'utf8')
    assert.equal(
      execFileSync('sha256sum', ['--check', '--strict', 'SHA256SUMS'], {
        cwd: join(dir, 'dist'),
        encoding: 'utf8',
      }),
      `${NAME}: OK\n`,
      'the old in-artifact check would pass',
    )
    const result = run(checkScript, dir, { DIGEST: packageDigest(), TAG: 'v0.1.0' })
    assert.equal(result.code, 1)
    assert.match(
      result.stdout,
      /^::error::model-meter-0\.1\.0\.tar\.gz has sha256 [0-9a-f]{64}, not the package job's/m,
    )
    assert.equal(result.outputs, '')
    assert.ok(sums.startsWith(sha256(SWAPPED)))
  })

  test('the genuine archive with a tampered SHA256SUMS fails', () => {
    const dir = fixture(GENUINE)
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- a file in this test's own temporary folder
    writeFileSync(join(dir, 'dist', 'SHA256SUMS'), `${sha256(SWAPPED)}  ${NAME}\n`)
    const result = run(checkScript, dir, { DIGEST: packageDigest(), TAG: 'v0.1.0' })
    assert.equal(result.code, 1)
    assert.match(result.stdout, /SHA256SUMS does not list the package job's digest/)
  })

  test('an archive that is not the tag version fails', () => {
    const result = run(checkScript, fixture(GENUINE), { DIGEST: packageDigest(), TAG: 'v0.2.0' })
    assert.equal(result.code, 1)
    assert.match(result.stdout, /is not the archive of v0\.2\.0/)
  })

  test('the dry run, with no tag, still checks the digest', () => {
    const digest = packageDigest()
    assert.equal(run(checkScript, fixture(GENUINE), { DIGEST: digest, TAG: '' }).code, 0)
    assert.equal(run(checkScript, fixture(SWAPPED), { DIGEST: digest, TAG: '' }).code, 1)
  })

  test('no digest, or not a sha256, fails before anything is read', () => {
    for (const digest of ['', 'abc', sha256(GENUINE).toUpperCase(), `${sha256(GENUINE)}\n`]) {
      const result = run(checkScript, fixture(GENUINE), { DIGEST: digest, TAG: 'v0.1.0' })
      assert.equal(result.code, 1, JSON.stringify(digest))
      assert.match(result.stdout, /the package job gave no sha256 digest/)
    }
  })

  test('two archives, or an oddly named one, fail', () => {
    const digest = packageDigest()
    const two = fixture(GENUINE)
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- a file in this test's own temporary folder
    writeFileSync(join(two, 'dist', 'model-meter-0.0.9.tar.gz'), SWAPPED)
    assert.match(run(checkScript, two, { DIGEST: digest, TAG: '' }).stdout, /found 2/)
    const odd = fixture(GENUINE, 'model-meter-x.tar.gz')
    assert.match(
      run(checkScript, odd, { DIGEST: digest, TAG: '' }).stdout,
      /not named model-meter-X\.Y\.Z\.tar\.gz/,
    )
    assert.equal(run(digestScript, two, {}).code, 1)
  })
})
