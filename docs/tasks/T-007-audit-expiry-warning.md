# T-007 · Early warning on expiring exceptions, and a weekly audit

- **Status:** Done ([#9](https://github.com/at0mikd/model-meter/pull/9); AC4: a manual run, green on `main`)
- **Branch:** `chore/T-007-audit-expiry-warning`
- **Plan:** `docs/PLAN.md` §6; T-001 "Security exceptions"

## Goal

An audit exception's expiry (at the time, `GHSA-fc5q-39xc-vjpf` on 2026-12-18) must **never come as a surprise**:

- a visible warning ahead of time;
- a periodic audit on `main` that depends neither on open pull requests nor on any Claude session.

The Maintainer's decision (option 3, 2026-11-18).

## Scope

**In:**

- **`scripts/audit.mjs`:** if an exception expires in **14 days or fewer** (UTC), it warns. It does not fail: expiry is still rule 2.
  - **Where the warning goes:**
    - to standard output, with the GHSA, the date and the days left;
    - as a GitHub Actions annotation (`::warning title=...::...`) when `GITHUB_ACTIONS === 'true'`, with no paths or environment data.
  - **The margin** is an exported constant (`EXPIRY_WARNING_DAYS = 14`), with tests at the boundaries (15, 14, 1 and 0 days) and with several exceptions.
- **`.github/workflows/audit-schedule.yml`:**
  - **Triggers:** a weekly `schedule` (Mondays, at a non-round minute) and `workflow_dispatch`.
  - **Steps:** `npm ci --ignore-scripts` and `npm run audit` on `main`, plus `npm audit --prefix tools/claude-cli --audit-level=low`.
  - **Permissions:** `permissions: contents: read` and nothing else; actions pinned by SHA; `persist-credentials: false`.
  - **On failure:** a scheduled failure notifies the Maintainer through GitHub's standard email. No issues are created and no token with write access is used.
- **`SECURITY.md`:** under "Active exceptions", explain the 14-day warning and the weekly audit.

**Out:** renewing or changing any exception, creating issues automatically, or touching Dependabot.

## Acceptance criteria

- **AC1** — `npm run audit`, with each case covered by a test:
  - with an exception that expires in ≤ 14 days, it ends with 0 and prints the warning;
  - with > 14 days, there is no warning;
  - once expired, it fails as before.
- **AC2** — With `GITHUB_ACTIONS=true`, the warning comes out as a `::warning` annotation (test).
- **AC3** — `audit-schedule.yml` passes actionlint and zizmor (the pedantic profile too), with only `contents: read`.
- **AC4** — A manual run (`workflow_dispatch`) of the workflow, on the pull request's branch or after the merge, is green, with its link on the pull request.
- **AC5** — `npm run check` green; coverage of `scripts/` ≥ 95%.

## Security constraints

- No write permission or secret in the new workflow.
- The warning prints no absolute paths or environment content.

## Required evidence

- The output of `npm run audit` with a simulated exception at 10 days (in a test).
- The output of actionlint and zizmor.
- The link to AC4's run.
