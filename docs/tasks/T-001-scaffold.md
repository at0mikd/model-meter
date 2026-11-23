# T-001 · Repository layout, local gates and CI

- **Status:** Done ([#6](https://github.com/at0mikd/model-meter/pull/6))
- **Branch:** `chore/T-001-scaffold`
- **Plan:** `docs/PLAN.md` §4, §6, §6.1, phase 1

> **Decision (Maintainer, after the Builder was blocked on AC2):** the project is called **`model-meter`** everywhere:
>
> - the plugin (`plugins/model-meter/`);
> - the marketplace (`name` in `.claude-plugin/marketplace.json`);
> - the repository (`at0mikd/model-meter`, renamed on GitHub by the Maintainer).
>
> No exception is added to the `--strict` gate.

## Goal

Get the repository ready so that all later code goes through the same quality and security controls, locally (`npm run check`) and in CI, with an empty mod that validates.

## Scope

**In:**

- **`package.json`:** `"private": true`, `"type": "module"`, `engines.node >= 22`, and **no runtime dependencies**.
  - Development dependencies at exact versions, with `package-lock.json`: `typescript`, `@types/node`, `eslint`, `@eslint/js`, `typescript-eslint`, `eslint-plugin-security`, `prettier`, `c8`, `fast-check`, `@commitlint/cli`, `@commitlint/config-conventional`.
  - Any other needs a justification in the pull request.
- **The `claude` CLI is not a development dependency:**
  - locally, the global one ≥ 2.1.327;
  - in CI, `npm i -g @anthropic-ai/claude-code@2.1.327` (exact version, in its own job).
  - `validate` and `test` work **without authentication** (verified by the Reviewer with an empty `HOME`), so CI holds no secret.
- **A strict `tsconfig.base.json`:** `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch`.
- **Types, in two layers.** The engine's types are not versioned: they belong to the engine, are regenerated per version, and `validate` does not write them.
  - **The pure core** (`plugins/model-meter/hooks/core/*.ts`, which never imports `claude-code`): its own `tsc -p tsconfig.core.json`, without the CLI.
  - **The hooks:** `claude plugin validate --strict --json`. With `--strict` it fails on the TypeScript errors the validator reports as warnings (verified: a `const n: number = 'x'` exits with 1).
  - **Locally,** if the engine has already written `.claude-plugin/types/` (when the mod is loaded with `--plugin-dir`), `tsc -p plugins/model-meter` is an optional extra, not a gate.
- **Lint and formatting:** ESLint (`strict-type-checked` and `eslint-plugin-security`), Prettier and `.editorconfig`.
- **The mod's skeleton, `plugins/model-meter/`:**
  - a manifest with `license: MIT`, `author` and `types`;
  - `hooks/hooks.json`;
  - a `register.tsx` that registers no hooks;
  - `types/index.d.ts`, `tsconfig.json` and `README.md`.
  - Plus `.claude-plugin/marketplace.json` at the root.
- **`scripts/check-capabilities.mjs`:**
  - **What it reads:** it runs `claude plugin validate plugins/model-meter --json`, reads `contents[].notes`, and extracts the `calls:` and `env reads:` entries. It does not depend on the report's absolute paths, which are never printed or pasted as evidence.
  - **When it fails:**
    - if anything falls outside the allowlist defined in the script itself. Initially: `$.session.model`, `$.store.get`, `$.store.set`, `$.ui.*` and `$.clock.now`, and no environment variable (updated after T-000);
    - if any entry of `gatingHooks` in the JSON report has no `.catch` (`docs/PLAN.md` §2.4, decision 6).
  - It has its own tests on sample outputs.
- **npm scripts:**
  - `typecheck` (the core), `lint`, `format:check`, `test:node` (with `c8`, 95% threshold) and `commitlint`;
  - `check:core` chains those, **without the CLI**;
  - `validate` (`--strict`), `test:mod` and `capabilities` need the CLI;
  - `check` = `check:core` plus those three.
- **Erasable syntax only:** on Node 22, `node --test` only strips types from `.ts` files (not `.tsx`, `enum`, `namespace` or parameter properties). So the pure core and its tests are `.ts` files with erasable syntax (`erasableSyntaxOnly` in their tsconfig).
- **A minimal mod test:** `claude plugin test` exits with 1 when there are no tests, so the skeleton includes one (for example, that `register` registers no writing hooks).
- **Workflows** in `.github/workflows/`:
  - `ci.yml`: `check:core` on a Node 22/24 × ubuntu/macos/windows matrix, plus an ubuntu job with the pinned CLI for `validate`, `test:mod` and `capabilities`;
  - `codeql.yml` (javascript-typescript), `dependency-review.yml`, `scorecard.yml` (push to `main` plus weekly);
  - `gitleaks.yml`: the full history, with the official binary pinned by version and **verified by SHA-256 checksum**, no third-party action;
  - workflow lint with `actionlint` and `zizmor`.
  - **For all of them:**
    - `permissions: contents: read` by default, widened only per job and with a justification;
    - actions pinned by **full SHA**, with a version comment;
    - `persist-credentials: false` on checkout;
    - no `pull_request_target`.
- **Governance files:**
  - `.github/dependabot.yml` (npm and github-actions, weekly, grouped) and `.github/CODEOWNERS`;
  - `SECURITY.md` (GitHub's private vulnerability reporting) and `CONTRIBUTING.md` (linking `docs/WORKFLOW.md`);
  - `CHANGELOG.md`.
- **Commitlint** (Conventional Commits) in CI on the pull request's commits.

**Out:**

- the mod's logic (T-002 onwards);
- the repository's settings on GitHub (branch protection, secret scanning). The Maintainer applies them, and the pull request must list them as a checklist.

## Security exceptions (Maintainer's decision, 2026-11-18)

**Context:**

- **The advisory:** GHSA-fc5q-39xc-vjpf (picomatch, ReDoS, high) affects every picomatch ≤ 4.0.7. That is the latest published version, so no fixed version exists (verified by the Reviewer with `npm view` and `npm audit`).
- **Exposure:** it arrives only as a development dependency (typescript-eslint → typescript-estree → tinyglobby), and only processes the fixed globs of our configuration. The real risk is negligible.
- **The decision:** a **bounded, versioned, expiring exception** is accepted, never a relaxed threshold.

**The exception:**

- **`security/audit-exceptions.json`:** a list of `{ id, package, severity, scope: "dev", reason, approvedBy: "maintainer", approvedOn, expires }`. The first entry: `GHSA-fc5q-39xc-vjpf`, `picomatch`, `high`, approved on `2026-11-18`, expiring on `2026-12-18`.
- **`scripts/audit.mjs`** (no dependencies; the `npm run audit` script) runs `npm audit --json` over **all** dependencies, and fails when:
  1. any advisory appears, of any severity, whose GHSA is not in the file;
  2. an exception has expired (`expires` < today, in UTC);
  3. an exception no longer matches any active advisory (a stale exception, which must be deleted);
  4. an exception affects a runtime dependency (`scope` other than `dev`, or the package appears in `npm ls --omit=dev`);
  5. the GHSAs in `allow-ghsas` of `.github/workflows/dependency-review.yml` do not match the file's exactly.

  It has tests on sample JSON reports, one per rule.
- **`dependency-review.yml`:** `fail-on-severity: low` stays; `allow-ghsas: GHSA-fc5q-39xc-vjpf`, with a comment that points to `security/audit-exceptions.json`.
- **`SECURITY.md`:** an "Active exceptions" section with the GHSA, the reason and the expiry date.
- **Overrides:** those of `glob` (14.0.6) and `minimatch` (11.0.9), for the two other advisories, which do have fixes, are accepted. They carry a comment in the pull request, and are removed when `c8` / `test-exclude` publish versions that include them.
- **Renewal:** renewing an exception requires a new approval from the Maintainer in the conversation with the Reviewer. No agent changes `expires` on its own.

## Acceptance criteria

- **AC1** — `npm ci && npm run check` passes locally from a clean clone, and `npm run check:core` passes without the CLI installed.
- **AC2** — `claude plugin validate --strict plugins/model-meter` and `claude plugin validate .` pass. A type error introduced on purpose in `register.tsx` makes `npm run validate` fail (shown, then reverted).
- **AC3** — `npm run capabilities` fails if a call outside the allowlist is added (shown with a test of the script).
- **AC4** — Every workflow triggered on `pull_request` passes; `actionlint` and `zizmor` with no findings.
- **AC5** — No action referenced by tag or branch; all by SHA.
- **AC6** — `npm ls --omit=dev` is empty (no runtime dependencies), and `npm run audit` is green with `GHSA-fc5q-39xc-vjpf` as the only exception. Each of the five rules of `scripts/audit.mjs` is shown by a test.
- **AC7** — The pull request includes the checklist of GitHub settings the Maintainer must apply (§6.1 of the plan).

## Security constraints

- Install with `npm ci --ignore-scripts` in CI. If the `claude` CLI needs install scripts, isolate it in its own job and document it.
- No secrets in workflows. The Scorecard job uses only `id-token: write` and `security-events: write`, in its own job.

## Required evidence

The output, with absolute paths redacted, of:

- `npm run check`, `claude plugin validate` and `npm ls --omit=dev`;
- the demonstration of AC3.

Plus the link to the CI run.
