# Security review: model-meter v0.1.0

- **Date:** 2026-11-22
- **Scope:** the published mod (`plugins/model-meter/`), `scripts/`, the new `.github/workflows/release.yml` and the changes to `.github/workflows/ci.yml`. Task T-012, AC1.
- **Base:** `main` at `99d809b`, plus the T-012 branch `chore/T-012-hardening-release`.
- **Result:** no open finding of any severity. Two issues were found and closed in this task: a test gap, and a cache that zizmor flagged in the release workflow (see [Findings](#findings)).

## 1. `/security-review`

Claude Code's `/security-review` ran over the branch: everything since `main`, read with the published mod and `scripts/` as context. It looks for high-confidence, exploitable vulnerabilities (injection, authorization, secrets, code execution, data exposure) and filters out theoretical ones. Its output, as it came:

> **Result: No findings.**
>
> No high-confidence (>80%), exploitable vulnerability introduced by this branch was found.
>
> **What was checked:**
>
> - **`.github/workflows/release.yml`:**
>   - **Trigger:** only `push: tags: ['v*']`. There is no `pull_request_target`, `workflow_run`, `issue_comment` or `workflow_dispatch`, so no fork or untrusted actor can trigger it; pushing a tag already needs write access.
>   - **Permissions:** `permissions: {}` at the top, and per job:
>     - `version`, `check` and `package` get `contents: read`;
>     - `attest` gets `id-token: write` and `attestations: write`, with no checkout and no repository code run;
>     - `release` gets `contents: write`, and `GH_TOKEN` is set only on the `gh release create` step, not on the step that runs `release-version.mjs notes`.
>   - **Checkout and pinning:** every checkout has `persist-credentials: false`, and every action is pinned to a full commit SHA.
>   - **`github.ref_name`:** never inline in `run:`; it goes through `env: TAG` and is used quoted. The `version` job checks the tag against `^v(\d+\.\d+\.\d+)$` before any later job, the tag cannot start with `-` (`v*` filter), and `--verify-tag` is used.
>   - **Artifacts:** `package` is uploaded and downloaded within the same run, with no cross-workflow `run-id` and no `workflow_run` consumer, so there is no artifact poisoning path.
>   - **Reusable `ci.yml`:** called with `contents: read` and no `secrets: inherit`. Its jobs, including the `mod` job that runs the claude CLI's install scripts, get only a read token in the release context.
>   - **Cache:** no `cache: npm` in `package` or `release`. Pull request caches are scoped to `refs/pull/N/merge` and cannot poison the tag run.
> - **`.github/workflows/ci.yml`:**
>   - Adding `workflow_call` gives no foothold: a public reusable workflow called from another repository runs with that caller's token.
>   - The `package` dry run job inherits `contents: read` and gets no secrets.
>   - `version=$(node -p ...)` is passed quoted as `"v$version"` and never re-evaluated.
> - **`scripts/package.mjs`:**
>   - It calls `execFileSync('git', args)` with an argument array and no shell.
>   - `--output=` and `--prefix=` come from the trusted `--out` flag and from `plugin.json`'s version, which the release path has already checked against the tag as `\d+.\d+.\d+`.
>   - `JSON.parse` output is only type-checked: there is no merge and no prototype pollution sink.
>   - `ls-tree` and `archive` both read `HEAD`, so uncommitted files are never packaged.
>   - The `PUBLISHED` allowlist check fails closed.
> - **`scripts/release-version.mjs`:**
>   - It reads only fixed literal paths through a `switch`.
>   - The tag regex is anchored, and parse or read errors fail closed.
>   - The notes come from `CHANGELOG.md` (repository-controlled) and go to `--notes-file`, with no shell.
> - **The published mod:** only `plugin.json` (the version) and `README.md` change. `hooks/register.tsx` and `hooks/core/*.ts` are unchanged, so no new capability is used. `register.test.tsx`, `tsconfig.json` and `types/index.d.ts` are already public, and `hooks.json` loads only `./register.tsx`.
> - **The screenshots:** `docs/assets/*.png` contain only the `IHDR`, `tIME`, `IDAT` and `IEND` chunks, with no text or EXIF metadata. What they show (model, effort, `auto mode on`, `PR #24`, a usage percentage) is not sensitive.
>
> **Considered and dismissed:**
>
> - **A tag on an arbitrary commit, or one that edits `release.yml`, runs that commit's workflow with `contents: write`.** This is inherent to tag-triggered releases and already needs write access. It is a hardening point, the tag ruleset, not a vulnerability.
> - **A compromised claude CLI dependency in the `mod` job pre-uploads an artifact named `package`.** Artifact names are unique per run, so the real upload would fail rather than be replaced. At most it causes a failed release, after a supply-chain compromise.
> - **A root `.gitattributes` with `export-ignore` or `export-subst` could make the archive differ from `ls-tree`.** Only a committer can add one, and today it is `* text=auto eol=lf`.

Its false-positive filter had nothing to filter: there were no candidate findings.

## 2. STRIDE, against the code as it is

The threat model is PLAN §5. Each row names the control as the code implements it, and the test or gate that proves it.

| Threat | Vector | Control in the code | Proof |
| --- | --- | --- | --- |
| **Tampering** | A hook that rewrites `model` or `effort`, or changes what the engine draws | Every hook returns `next(e)` untouched, or composes it into its tree. `turn.step` is observed with `yield* next(e)`. `/model` and `/effort` reach the engine as typed, even when the mod fails. | Mod tests: `turn.step reaches the engine untouched (T-012)` (new in this review), `/model and /effort reach the engine untouched (CA3)`, `the hint line is drawn as the engine drew it`, `keepsBeneath()` in the band tests |
| **Spoofing / injection in the UI** | A model id with control or ANSI sequences, bidi overrides, or a very long one | `sanitize.ts`: an allowlist of characters, escape sequences dropped whole, a length cap. `parseModel` rebuilds known ids from constants and sanitizes unknown ones (at most 16 characters, lowercase). The options are validated against a closed list and range (`parseOptions`) and never drawn. | Core tests: `sanitize` (including `property: any input gives allowed characters only, within max (1 000 cases)`, fast-check), `parseModel` (property test, 1 000 cases), `parseOptions` (T-004 CA1) |
| **Information disclosure** | Persisting sensitive data | `$.store` holds only the last effort **level**, from a closed list, written only when it changes. Nothing else is stored: no prompts, paths, tokens or model id. `$.state` is limited to the mod's own keys declared in `types/index.d.ts`. | Mod tests: `$.store holds a level and nothing else (CA5)` (3 tests, including `only levels reach the store: a numeric effort does not` and `a corrupt stored value is unknown`); `check-capabilities` (state keys) |
| **Elevation of privilege** | Use of `$.fs`, `$.process`, `$.model`, the network, `$.tool.register` or environment variables | Not used. `claude plugin validate` lists every `$` call the module makes, and `scripts/check-capabilities.mjs` fails on anything outside the allowlist of PLAN §6. | CI job `mod (validate, test:mod, capabilities)`; unit tests in `scripts/check-capabilities.test.mjs`. The calls are the same as at v0.0.0: `$.session.model, $.state.get, $.state.set, $.store.get, $.store.set, $.ui.invalidate, $.ui.resolve` |
| **Denial of service** | Timers or costly renders | No timers (`$.clock` is not used). Width math is linear in what is drawn, and `widthOfTree` stops at a bounded depth. The band's hysteresis needs no timer either. | Core test `a tree nested deeper than any drawing stops counting instead of recursing forever`; capabilities (no `$.clock`) |
| **Supply chain** | Compromised dependencies or Actions | Zero runtime dependencies. Development dependencies are pinned with a lockfile and installed with `npm ci --ignore-scripts`. Actions are pinned by SHA, and Dependabot and dependency review are on. `npm run audit` fails without an approved exception. | `npm run audit` in `check:core`; `zizmor` and `actionlint` in CI; `Review dependency changes`; `package.json` has no `dependencies` |

New in v0.1.0, the release:

| Threat | Vector | Control | Proof |
| --- | --- | --- | --- |
| **Tampering with the release** | A tag that does not match the published version | `release-version.mjs check` fails unless the tag is `v` plus the version of `plugin.json`, `marketplace.json` and `package.json` | `scripts/release-version.test.mjs` (16 tests); the CI dry run runs it on every pull request |
| **Tampering with the release** | A tag on a commit that was never reviewed or merged, or a tag nobody signed | The `version` job fails unless the tagged commit is an ancestor of `origin/main`, and unless the tag is annotated, signed, verified by GitHub and points to that commit. The tag ruleset is the first control; this check does not rely on it alone. | The `version` job in `release.yml`. The `gh api` calls were checked read-only against an annotated, signed tag (verified) and a lightweight one (refused). |
| **Information disclosure / tampering** | Files that should not ship end up in the package | `package.mjs` packs only from `HEAD`, only the files of the explicit `PUBLISHED` list, and fails on anything missing or extra. The archive is deterministic and checked with `sha256sum --check`. | `scripts/package.test.mjs` (12 tests, including `holds nothing from spikes/, test/, scripts/ or tools/`); the `package (dry run)` CI job |
| **Spoofing of the package** | A copy of the archive that GitHub did not build | `actions/attest-build-provenance` over the archive, with GitHub's OIDC token and no stored key; checked with `gh attestation verify` (`docs/RELEASING.md`) | The `attest provenance` job in `release.yml` |
| **Elevation of privilege** | A pull request, or any job, that gets write access or an OIDC token | `release.yml` runs on `v*` tags alone, with `permissions: {}`. Only `attest` gets `id-token`/`attestations: write`, and only `release` gets `contents: write`. Checkouts keep no credentials. | `actionlint` and `zizmor` on this pull request; the workflow file |

## 3. What is published

The marketplace serves `plugins/model-meter/` and lists it in `.claude-plugin/marketplace.json`. The release archive holds exactly these 17 files, the `PUBLISHED` list in `scripts/package.mjs`, which a test compares with `git ls-files`:

```text
.claude-plugin/marketplace.json
plugins/model-meter/.claude-plugin/plugin.json
plugins/model-meter/README.md
plugins/model-meter/hooks/core/badge.ts
plugins/model-meter/hooks/core/band.ts
plugins/model-meter/hooks/core/effort.ts
plugins/model-meter/hooks/core/layout.ts
plugins/model-meter/hooks/core/model.ts
plugins/model-meter/hooks/core/options.ts
plugins/model-meter/hooks/core/sanitize.ts
plugins/model-meter/hooks/core/sprite.ts
plugins/model-meter/hooks/core/state.ts
plugins/model-meter/hooks/hooks.json
plugins/model-meter/hooks/register.test.tsx
plugins/model-meter/hooks/register.tsx
plugins/model-meter/tsconfig.json
plugins/model-meter/types/index.d.ts
```

- **Not part of it:** `spikes/`, `test/`, `scripts/` and `tools/`. A test in `scripts/package.test.mjs` asserts it, and the archive's listing in the dry run shows it.
- **`.claude-plugin/types/`:** the engine generates it in the plugin folder, and git ignores it, so it is never packaged.
- **`hooks/register.test.tsx`:** the mod's tests ship inside the plugin folder, because `claude plugin test` runs them from there. The engine does not load them: `hooks.json` names only `./register.tsx`.

## Findings

| # | Finding | Severity | Status |
| --- | --- | --- | --- |
| 1 | PLAN §5 promised a test that the mod never rewrites `model` or `effort` in `turn.step`. The existing tests covered `/model`, `/effort` and the drawing, but not `turn.step` itself. | Low (a test gap; the code was already correct) | **Fixed in T-012** (`0fa36f7`): a new mod test fails when the hook rewrites the effort, as checked against a mutated hook. |
| 2 | PLAN §5 (Information disclosure) says the mod stores `{ model, effort, seenAt }`. The code stores less, only the effort level. | Informational (documentation) | For the Reviewer, who is translating PLAN: the control is stricter than documented. |
| 3 | A tag on any commit runs that commit's `release.yml` with `contents: write`. | Hardening | The Maintainer applies the `v*` tag ruleset after the merge: creation restricted to the Maintainer, no deletions or updates, signed tags (T-012, "After the merge"). After the Reviewer's review, the workflow also refuses a tagged commit that is not on `main`, and a tag that is not annotated, signed and verified (`version` job). |
| 4 | zizmor (`cache-poisoning`, high) on this pull request: `actions/setup-node` v5 and later turn on the npm cache unless told otherwise, so the three jobs of `release.yml` that set up Node restored a cache that a pull request could have written. `/security-review` read the workflow as using no cache. | High (in the release workflow, before it ever ran) | **Fixed in T-012:** `package-manager-cache: false` on every `setup-node` of `release.yml`. zizmor's `self-repository` help on `uses: ./.github/workflows/ci.yml` is suppressed inline, with the reason. `./` loads the reusable workflow from the caller's own commit, and the newer `$/` form is newer than the actionlint pinned in CI. |

No finding of high severity is open.
