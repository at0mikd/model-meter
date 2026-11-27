# T-013 · Full security audit with Cloudflare's `security-audit` skill

- **Status:** Done ([#36](https://github.com/at0mikd/model-meter/pull/36), `b3df2e4`; mitigations planned as T-014 to T-017)
- **Branch:** `chore/T-013-security-audit`
- **Plan:** `docs/PLAN.md` §5 (threat model), §6; the Maintainer's request of 2026-11-23: a closing security audit of v0.1.0 with [cloudflare/security-audit-skill](https://github.com/cloudflare/security-audit-skill)

## Goal

An independent, structured security audit of the repository at v0.1.0, run with Cloudflare's open-source `security-audit` skill in **full audit mode**. It produces verified findings, a coverage ledger and a report. Confirmed findings become their own tasks.

## Starting data (the Reviewer vetted the skill, 2026-11-23)

- **Source and pin:** `cloudflare/security-audit-skill` at commit **`c1c8a8c1471069fb0e188eeaff69b8e8db6564a8`** (2026-09-14), MIT license.
- **Contents:** Markdown guidance, `report-schema.json`, and two validators (`validate-findings.cjs`, `validate-coverage-ledger.cjs`). The validators only use `node:fs`, `node:path` and `node:util`: no network, no child processes, no `eval`.
- **Its own safety rules,** which this task keeps:
  - source inspection is read-only;
  - target code runs only inside an OS-enforced sandbox (no network, empty environment, read-only target, resource limits); if that sandbox is not available, the skill reports it as a `needs_validation` blocker instead of running code;
  - no dependency installs;
  - no probing of external services;
  - outputs go to a directory **outside** the target.
- **It delegates work** to isolated agents (`research` and `general` roles), through the platform's agent mechanism.

## Scope

**In:**

1. **Install the skill at the pinned commit,** at user level (`~/.claude/skills/security-audit/`), never inside this repository.
   - Verify the commit SHA after the clone.
   - Do not run `npm install` or any script of the skill, other than its two validators.
2. **Run the full audit** with these settings:
   - **target:** a clean checkout of `main` at the v0.1.0 commit `e844730` or later, with no uncommitted changes;
   - **output directory:** the skill's default, `~/security-audit-skill/model-meter/run-1`, outside the repository;
   - **phases:** all six;
   - **validators:** `validate-coverage-ledger.cjs` and `validate-findings.cjs` must pass at the points the skill requires.
3. **Target code execution:** only if the Builder's environment provides the sandbox the skill requires. Otherwise no target code runs; every check that would need it is recorded as `needs_validation`, with the blocker.
4. **Commit a sanitized report** to `docs/security/audit-v0.1.0-security-audit-skill.md`:
   - the skill version (commit) and the reviewed source ref;
   - the summary of `REPORT.md`;
   - each `confirmed` and `needs_validation` record, with its severity, evidence and proposed fix;
   - the number of `rejected` candidates;
   - the coverage-ledger summary: which attack classes were covered and which were not, and why.
   - The full output directory stays local and is **not** committed.
5. **Triage:** the pull request lists each confirmed finding with a one-line fix proposal. The Reviewer turns each into its own task. **No fixes are made in this task.**

**Out:**

- fixing findings, which become separate tasks;
- committing the skill, its output directory, or anything with local paths;
- auditing other repositories or deployed services;
- changing workflows, settings or dependencies.

## Acceptance criteria

- **AC1** — The skill is installed at commit `c1c8a8c…`, with the output of `git -C <skill> rev-parse HEAD` in the pull request.
- **AC2** — Both validators pass on the final `coverage-ledger.json` and `findings.json`, with their output in the pull request.
- **AC3** — `docs/security/audit-v0.1.0-security-audit-skill.md` exists, with the items of scope item 4. It contains no absolute paths, user names, prompts or secrets.
- **AC4** — Execution was only sandboxed: the pull request states whether target code ran, in which sandbox, or which checks are `needs_validation` because none was available.
- **AC5** — The pull request triages every confirmed finding: severity, proposed fix, and whether it blocks.
- **AC6** — `npm run check` green; no file outside `docs/` changes.

## Security constraints

- The skill is third-party content: it is pinned by commit, read-only, and installed outside the repository.
- No target code runs outside an OS-enforced sandbox, with no network.
- No external service is probed, nothing is published, and no release is touched.
- Findings are reported privately first. If a finding is a real, exploitable vulnerability in the published v0.1.0, the Builder stops and tells the Reviewer before writing it in the public pull request. It then goes through GitHub's private vulnerability reporting / a security advisory, as `SECURITY.md` describes.

## Required evidence

- AC1 and AC2 output.
- The report file.
- The execution statement of AC4.
- The triage table of AC5.
