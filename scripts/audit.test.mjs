import assert from 'node:assert/strict'
import process from 'node:process'
import { describe, test } from 'node:test'

import {
  EXPIRY_WARNING_DAYS,
  allowedGhsas,
  expiryWarnings,
  findAuditProblems,
  main,
} from './audit.mjs'
import exceptionsFile from '../security/audit-exceptions.json' with { type: 'json' }
import auditReport from './fixtures/npm-audit.json' with { type: 'json' }
import lsReport from './fixtures/npm-ls-runtime.json' with { type: 'json' }

const TODAY = '2026-11-18'
const WORKFLOW = `jobs:
  review:
    steps:
      - uses: actions/dependency-review-action@bbc44d14a204704ccc493733616cd1e93a0321ec # v5.0.1
        with:
          fail-on-severity: low
          # Must match security/audit-exceptions.json (npm run audit checks it).
          allow-ghsas: GHSA-fc5q-39xc-vjpf
`

/**
 * @typedef {{ id: string, package: string, severity: string, scope: string, reason: string,
 *   approvedBy: string, approvedOn: string, expires: string }} AuditException
 * @typedef {{ name?: string, severity?: string, url?: string } | string} Via
 * @typedef {{ vulnerabilities: Record<string, { via: Via[] }> }} AuditReport
 * @typedef {{ name?: string, dependencies?: Record<string, unknown> }} LsReport
 */

/**
 * A deep copy, safe to change.
 *
 * @param {unknown} value
 * @returns {unknown}
 */
function copy(value) {
  /** @type {unknown} */
  const clone = structuredClone(value)
  return clone
}

/** The real inputs of today's tree: one advisory, covered by the one exception. */
function inputs() {
  return {
    audit: copy(auditReport),
    ls: copy(lsReport),
    exceptions: /** @type {AuditException[]} */ (copy(exceptionsFile)),
    workflow: WORKFLOW,
    today: TODAY,
  }
}

/** @param {AuditException[]} exceptions */
function first(exceptions) {
  const entry = exceptions[0]
  assert.ok(entry)
  return entry
}

/**
 * Adds an advisory the way npm audit reports it.
 *
 * @param {unknown} audit
 * @param {{ id: string, name: string, severity: string }} advisory
 */
function addAdvisory(audit, { id, name, severity }) {
  const report = /** @type {AuditReport} */ (audit)
  report.vulnerabilities = {
    ...report.vulnerabilities,
    [name]: {
      via: [{ name, severity, url: `https://github.com/advisories/${id}` }],
    },
  }
}

describe('findAuditProblems', () => {
  test('the real tree passes: its only advisory has a current exception', () => {
    assert.deepEqual(findAuditProblems(inputs()), [])
  })

  test('rule 1: an advisory of any severity without an exception fails', () => {
    const input = inputs()
    addAdvisory(input.audit, { id: 'GHSA-aaaa-bbbb-cccc', name: 'left-pad', severity: 'low' })
    assert.deepEqual(findAuditProblems(input), [
      'advisory without an exception: GHSA-aaaa-bbbb-cccc (left-pad, low)',
    ])
  })

  test('rule 1: an advisory without a GHSA id can never be excepted', () => {
    const input = inputs()
    const report = /** @type {AuditReport} */ (input.audit)
    report.vulnerabilities.odd = {
      via: [{ name: 'odd', severity: 'info', url: 'https://example.com/1' }],
    }
    assert.deepEqual(findAuditProblems(input), [
      'advisory without an exception: https://example.com/1 (odd, info)',
    ])
  })

  test('rule 2: an exception past its expiry date fails (UTC, the day itself still counts)', () => {
    assert.deepEqual(findAuditProblems({ ...inputs(), today: '2026-12-18' }), [])
    assert.deepEqual(findAuditProblems({ ...inputs(), today: '2026-12-19' }), [
      'exception expired on 2026-12-18: GHSA-fc5q-39xc-vjpf (renewing it needs the Maintainer)',
    ])
  })

  test('rule 3: an exception no active advisory needs fails, so it gets removed', () => {
    const input = inputs()
    input.audit = { auditReportVersion: 2, vulnerabilities: {} }
    assert.deepEqual(findAuditProblems(input), [
      'exception matches no active advisory, remove it: GHSA-fc5q-39xc-vjpf',
    ])
  })

  test('rule 3: an exception for the same id on another package is not a match', () => {
    const input = inputs()
    first(input.exceptions).package = 'micromatch'
    assert.deepEqual(findAuditProblems(input), [
      'advisory without an exception: GHSA-fc5q-39xc-vjpf (picomatch, high)',
      'exception matches no active advisory, remove it: GHSA-fc5q-39xc-vjpf',
    ])
  })

  test('rule 4: an exception whose scope is not dev fails', () => {
    const input = inputs()
    first(input.exceptions).scope = 'runtime'
    assert.deepEqual(findAuditProblems(input), [
      'exception must be scope "dev": GHSA-fc5q-39xc-vjpf',
    ])
  })

  test('rule 4: an exception for a package that runtime code depends on fails', () => {
    const input = inputs()
    input.ls = {
      name: 'model-meter',
      dependencies: { a: { version: '1.0.0', dependencies: { picomatch: { version: '4.0.7' } } } },
    }
    assert.deepEqual(findAuditProblems(input), [
      'exception covers a runtime dependency: GHSA-fc5q-39xc-vjpf (picomatch)',
    ])
  })

  test('rule 5: allow-ghsas in dependency-review.yml must list exactly the exceptions', () => {
    const input = inputs()
    const mismatch = (/** @type {string} */ workflow) => findAuditProblems({ ...input, workflow })
    const message = (/** @type {string} */ listed) =>
      `allow-ghsas in .github/workflows/dependency-review.yml (${listed}) does not match security/audit-exceptions.json (GHSA-fc5q-39xc-vjpf)`
    assert.deepEqual(mismatch('jobs: {}\n'), [message('none')])
    assert.deepEqual(mismatch('allow-ghsas: GHSA-fc5q-39xc-vjpf, GHSA-aaaa-bbbb-cccc\n'), [
      message('GHSA-aaaa-bbbb-cccc, GHSA-fc5q-39xc-vjpf'),
    ])
    assert.deepEqual(
      findAuditProblems({ ...input, audit: { vulnerabilities: {} }, exceptions: [] }),
      [
        'allow-ghsas in .github/workflows/dependency-review.yml (GHSA-fc5q-39xc-vjpf) does not match security/audit-exceptions.json (none)',
      ],
    )
  })

  test('a changed severity needs a new approval', () => {
    const input = inputs()
    first(input.exceptions).severity = 'moderate'
    assert.deepEqual(findAuditProblems(input), [
      'advisory severity is high, the exception approved moderate: GHSA-fc5q-39xc-vjpf',
    ])
  })

  describe('fails closed on what it cannot read', () => {
    test('an npm audit report of another shape (npm error, no network)', () => {
      assert.deepEqual(
        findAuditProblems({ ...inputs(), audit: { error: { code: 'ENOTFOUND' } } }),
        ['could not read the npm audit report'],
      )
      assert.deepEqual(findAuditProblems({ ...inputs(), audit: null }), [
        'could not read the npm audit report',
      ])
      for (const audit of [
        { vulnerabilities: null },
        { vulnerabilities: { x: null } },
        { vulnerabilities: { x: { via: 'nope' } } },
        { vulnerabilities: { x: { via: [42] } } },
        { vulnerabilities: { x: { via: [{ name: 'x', severity: 'low' }] } } },
      ]) {
        assert.deepEqual(
          findAuditProblems({ ...inputs(), audit }),
          ['could not read the npm audit report'],
          JSON.stringify(audit),
        )
      }
    })

    test('an npm ls report of another shape', () => {
      assert.deepEqual(findAuditProblems({ ...inputs(), ls: 'nope' }), [
        'could not read the npm ls report',
      ])
      for (const ls of [
        { dependencies: 'x' },
        { dependencies: { a: null } },
        { dependencies: { a: { dependencies: { b: 1 } } } },
      ]) {
        assert.deepEqual(findAuditProblems({ ...inputs(), ls }), [
          'could not read the npm ls report',
        ])
      }
    })

    test('an exceptions file that is not a list of complete entries', () => {
      const broken = (/** @type {unknown} */ exceptions) =>
        findAuditProblems({ ...inputs(), exceptions })
      assert.deepEqual(broken({}), ['security/audit-exceptions.json must be a list'])
      assert.deepEqual(broken([null]), ['security/audit-exceptions.json entry 1 is not valid'])
      const entry = first(inputs().exceptions)
      for (const change of [
        { id: 'CVE-2026-1' },
        { severity: 'huge' },
        { reason: '' },
        { approvedBy: 'an agent' },
        { approvedOn: '18/11/2026' },
        { expires: '2026-02-30' },
        { package: 7 },
      ]) {
        assert.deepEqual(
          broken([{ ...entry, ...change }]),
          ['security/audit-exceptions.json entry 1 is not valid'],
          JSON.stringify(change),
        )
      }
      assert.deepEqual(broken([entry, entry]), [
        'security/audit-exceptions.json lists GHSA-fc5q-39xc-vjpf twice',
      ])
    })

    test('an allow-ghsas line it cannot parse', () => {
      for (const workflow of [
        'allow-ghsas: |\n  GHSA-fc5q-39xc-vjpf\n',
        'allow-ghsas: GHSA-fc5q-39xc-vjpf\nallow-ghsas: GHSA-fc5q-39xc-vjpf\n',
      ]) {
        assert.deepEqual(findAuditProblems({ ...inputs(), workflow }), [
          'could not read allow-ghsas in .github/workflows/dependency-review.yml',
        ])
      }
    })
  })
})

describe('allowedGhsas', () => {
  test('reads a plain, quoted or flow list, and ignores comments', () => {
    assert.deepEqual(allowedGhsas('allow-ghsas: GHSA-a, GHSA-b # why\n'), ['GHSA-a', 'GHSA-b'])
    assert.deepEqual(allowedGhsas("  allow-ghsas: 'GHSA-a'\n"), ['GHSA-a'])
    assert.deepEqual(allowedGhsas('allow-ghsas: [GHSA-a, GHSA-b]\n'), ['GHSA-a', 'GHSA-b'])
    assert.deepEqual(allowedGhsas('steps: []\n'), [])
  })
})

describe('expiryWarnings', () => {
  const exception = first(inputs().exceptions) // expires 2026-12-18
  const at = (/** @type {string} */ today) => expiryWarnings([exception], today)
  const warning = (/** @type {number} */ daysLeft) => [
    { id: 'GHSA-fc5q-39xc-vjpf', expires: '2026-12-18', daysLeft },
  ]

  test('the margin is 14 days', () => {
    assert.equal(EXPIRY_WARNING_DAYS, 14)
  })

  test('warns from 14 days before the expiry date up to the day itself (UTC)', () => {
    assert.deepEqual(at('2026-12-03'), []) // 15 days left
    assert.deepEqual(at('2026-12-04'), warning(14))
    assert.deepEqual(at('2026-12-17'), warning(1))
    assert.deepEqual(at('2026-12-18'), warning(0))
  })

  test('an expired exception is no warning: rule 2 fails the audit instead', () => {
    assert.deepEqual(at('2026-12-19'), [])
  })

  test('with several exceptions, warns only for those close to expiry, soonest first', () => {
    const later = { ...exception, id: 'GHSA-aaaa-bbbb-cccc', expires: '2027-03-01' }
    const sooner = { ...exception, id: 'GHSA-dddd-eeee-ffff', expires: '2026-12-10' }
    assert.deepEqual(expiryWarnings([exception, later, sooner], '2026-12-08'), [
      { id: 'GHSA-dddd-eeee-ffff', expires: '2026-12-10', daysLeft: 2 },
      { id: 'GHSA-fc5q-39xc-vjpf', expires: '2026-12-18', daysLeft: 10 },
    ])
  })
})

describe('main', () => {
  /**
   * @param {Partial<Record<'audit' | 'ls' | 'exceptions' | 'workflow', string>>} [over]
   * @param {string} [today]
   * @param {boolean} [githubActions]
   */
  function capture(over = {}, today = TODAY, githubActions = false) {
    const files = {
      audit: JSON.stringify(auditReport),
      ls: JSON.stringify(lsReport),
      exceptions: JSON.stringify(exceptionsFile),
      workflow: WORKFLOW,
      ...over,
    }
    let out = ''
    const code = main({
      run: (args) => (args[0] === 'audit' ? files.audit : files.ls),
      read: (which) => (which === 'exceptions' ? files.exceptions : files.workflow),
      today,
      githubActions,
      write: (text) => (out += text),
    })
    return { code, out }
  }

  /**
   * Runs `fn` with GITHUB_ACTIONS set to `value` (or unset), then restores it.
   *
   * @param {string | undefined} value
   * @param {() => void} fn
   */
  function withGithubActions(value, fn) {
    const saved = process.env.GITHUB_ACTIONS
    if (value === undefined) delete process.env.GITHUB_ACTIONS
    else process.env.GITHUB_ACTIONS = value
    try {
      fn()
    } finally {
      if (saved === undefined) delete process.env.GITHUB_ACTIONS
      else process.env.GITHUB_ACTIONS = saved
    }
  }

  test('CA1: 10 days before expiry it warns and still exits 0', () => {
    const { code, out } = capture({}, '2026-12-08')
    assert.equal(code, 0)
    assert.equal(
      out,
      'audit: warning: GHSA-fc5q-39xc-vjpf expires on 2026-12-18 (10 days left); renewing it needs the Maintainer\n' +
        'audit: ok, 1 advisory covered by an exception (GHSA-fc5q-39xc-vjpf, expires 2026-12-18)\n',
    )
  })

  test('CA1: more than 14 days ahead there is no warning', () => {
    const { code, out } = capture({}, '2026-12-03')
    assert.equal(code, 0)
    assert.doesNotMatch(out, /warning/)
  })

  test('says "1 day left", and "expires today" on the day itself', () => {
    assert.match(capture({}, '2026-12-17').out, /expires on 2026-12-18 \(1 day left\)/)
    assert.match(capture({}, '2026-12-18').out, /GHSA-fc5q-39xc-vjpf expires today \(2026-12-18\)/)
  })

  test('CA1: once expired it fails as before, with no warning', () => {
    const { code, out } = capture({}, '2026-12-19')
    assert.equal(code, 1)
    assert.match(out, /exception expired on 2026-12-18/)
    assert.doesNotMatch(out, /warning/)
  })

  test('the warning still shows when the audit fails for another reason', () => {
    const audit = /** @type {AuditReport} */ (copy(auditReport))
    addAdvisory(audit, { id: 'GHSA-aaaa-bbbb-cccc', name: 'left-pad', severity: 'low' })
    const { code, out } = capture({ audit: JSON.stringify(audit) }, '2026-12-08')
    assert.equal(code, 1)
    assert.match(out, /^audit: warning: GHSA-fc5q-39xc-vjpf expires on 2026-12-18/)
    assert.match(out, /advisory without an exception: GHSA-aaaa-bbbb-cccc/)
  })

  test('no warning from an exceptions file it cannot trust', () => {
    for (const exceptions of ['{oops', '{}', '[null]']) {
      const { code, out } = capture({ exceptions }, '2026-12-08')
      assert.equal(code, 1, exceptions)
      assert.doesNotMatch(out, /warning/, exceptions)
    }
  })

  test('CA2: under GitHub Actions the warning is also an annotation', () => {
    const { code, out } = capture({}, '2026-12-08', true)
    assert.equal(code, 0)
    assert.match(out, /^audit: warning: GHSA-fc5q-39xc-vjpf/)
    assert.ok(
      out.includes(
        '::warning title=Audit exception expires soon::GHSA-fc5q-39xc-vjpf expires on 2026-12-18 (10 days left). Renewing it needs the Maintainer (security/audit-exceptions.json).\n',
      ),
    )
    assert.doesNotMatch(capture({}, '2026-12-08', false).out, /::warning/)
  })

  test('CA2: reads GITHUB_ACTIONS from the environment by default', () => {
    /** @param {string | undefined} value */
    const run = (value) => {
      let out = ''
      withGithubActions(value, () => {
        main({
          run: (args) => JSON.stringify(args[0] === 'audit' ? auditReport : lsReport),
          read: (which) => (which === 'exceptions' ? JSON.stringify(exceptionsFile) : WORKFLOW),
          today: '2026-12-08',
          write: (text) => (out += text),
        })
      })
      return out
    }
    assert.match(run('true'), /::warning title=/)
    assert.doesNotMatch(run(undefined), /::warning/)
    assert.doesNotMatch(run('false'), /::warning/)
  })

  test('exits 0 and names the exceptions in force', () => {
    const { code, out } = capture()
    assert.equal(code, 0)
    assert.match(
      out,
      /^audit: ok, 1 advisory covered by an exception \(GHSA-fc5q-39xc-vjpf, expires 2026-12-18\)/,
    )
  })

  test('with no advisories and no exceptions there is nothing to cover', () => {
    const { code, out } = capture({
      audit: JSON.stringify({ auditReportVersion: 2, vulnerabilities: {} }),
      exceptions: '[]',
      workflow: 'jobs: {}\n',
    })
    assert.equal(code, 0)
    assert.equal(out, 'audit: ok, 0 advisories covered by an exception\n')
  })

  test('exits 1 and lists each problem', () => {
    const { code, out } = capture({}, '2027-01-01')
    assert.equal(code, 1)
    assert.match(out, /exception expired on 2026-12-18/)
  })

  test('exits 1 when an input is not JSON', () => {
    const { code, out } = capture({ exceptions: '{oops' })
    assert.equal(code, 1)
    assert.match(out, /could not read security\/audit-exceptions\.json/)
  })

  test('exits 1 when npm or a file cannot be read', () => {
    let out = ''
    const code = main({
      run: () => {
        throw new Error('spawn npm ENOENT')
      },
      read: () => '',
      today: TODAY,
      write: (text) => (out += text),
    })
    assert.equal(code, 1)
    assert.match(out, /audit: could not run: spawn npm ENOENT/)
  })

  test('reports a failure that is not an Error, and writes to stdout by default', (t) => {
    /** @type {string[]} */
    const written = []
    t.mock.method(process.stdout, 'write', (/** @type {string} */ text) => {
      written.push(text)
      return true
    })
    const code = main({
      run: () => {
        // eslint-disable-next-line @typescript-eslint/only-throw-error -- what a child process may throw is not ours to choose
        throw 'killed'
      },
      read: () => '',
      today: TODAY,
    })
    t.mock.restoreAll()
    assert.equal(code, 1)
    assert.match(written.join(''), /audit: could not run: killed/)
  })
})
