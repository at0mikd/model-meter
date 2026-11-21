# T-012 · Hardening and the v0.1.0 release

- **Status:** Ready (after T-010, #27)
- **Branch:** `chore/T-012-hardening-release`
- **Plan:** `docs/PLAN.md` §5 (threat model), §6 (quality gates), §8 phase 6; Maintainer's decision of 2026-11-21: phase 5 (palettes, `showEffortMeter`) is optional and left for later, and the first release is cut after T-010.

## Goal

Ship **model-meter v0.1.0**:

- a final security review of everything that is published;
- a release workflow that builds the published package from a tag and attests its provenance;
- the version set everywhere;
- the mod's own documentation in English, with real screenshots.

## Scope

**In:**

1. **Security review**, recorded in `docs/security/review-v0.1.0.md`:
   - run `/security-review` (Claude Code) over `plugins/model-meter/` and `scripts/`, and attach its output;
   - walk the STRIDE table of PLAN §5 against the code as it is, and record for each threat the control and the test that covers it;
   - list what is published (the files of `plugins/model-meter/` that the marketplace serves) and confirm that `spikes/`, `test/`, `scripts/` and `tools/` are not part of it;
   - any finding is fixed in this task when it is small; otherwise it becomes a new task, and the Reviewer decides whether it blocks the release.
2. **Release workflow** `.github/workflows/release.yml`:
   - **Trigger:** a pushed tag `v*`.
   - **Checks before anything is published:**
     - the tag must equal `v` + `version` in `plugins/model-meter/.claude-plugin/plugin.json`, in `.claude-plugin/marketplace.json` and in `package.json`; otherwise the workflow fails;
     - the full `npm run check` runs again on the tag (same jobs as CI, or a `workflow_call` of `ci.yml`).
   - **Package:** a deterministic archive of what the marketplace serves, `model-meter-<version>.tar.gz` with `plugins/model-meter/` and `.claude-plugin/marketplace.json`, plus its `SHA256SUMS`.
   - **Provenance:** `actions/attest-build-provenance`, pinned by SHA, over the archive.
   - **Release:** a GitHub Release with the archive, `SHA256SUMS` and the notes of that version from `CHANGELOG.md`.
   - **Permissions:** least privilege, per job. `contents: write` only where the release is created; `id-token: write` and `attestations: write` only on the attestation step's job. Everything else is `contents: read`.
   - **Other rules:**
     - every action is pinned by SHA, with its version in a comment;
     - no `pull_request_target`;
     - `persist-credentials: false` on checkout;
     - actionlint and zizmor clean.
3. **Version 0.1.0:**
   - set in `plugin.json`, `marketplace.json` and `package.json`;
   - `CHANGELOG.md` moves `[Unreleased]` to `[0.1.0] - <date>`, in English, with a fresh empty `[Unreleased]`.
4. **Documentation of the mod, in English:**
   - `plugins/model-meter/README.md`, fully in English if T-010 did not already do it;
   - real screenshots in `docs/assets/`: the footer at half screen next to `sub-meter`, and the band at full screen. They come from the Maintainer's CA7 captures of T-004 and T-010, cropped so that nothing private shows;
   - **`docs/RELEASING.md`:** how to cut a release — bump the version, update the changelog, open the pull request, have the Maintainer approve it, have the Maintainer create a signed tag, let the workflow run, and verify the attestation with `gh attestation verify`.
5. **Clean install check** after the merge, before the tag: in a fresh Claude Code profile, `/plugin marketplace add at0mikd/model-meter` and `/plugin install model-meter@model-meter` from `main`. Record the output and a screenshot in the pull request.

**Out:**

- phase 5 (palettes, `showEffortMeter`), which is optional and comes later;
- translating `docs/` beyond the mod's README (the Reviewer does that separately);
- creating the tag and the GitHub release: the Maintainer pushes the tag, and the workflow does the rest.

## Acceptance criteria

- **AC1** — `docs/security/review-v0.1.0.md` with:
  - the `/security-review` output;
  - the STRIDE walk-through (threat, control, test);
  - the list of published files.

  No open finding of high severity.
- **AC2** — `release.yml` passes actionlint and zizmor. A test of the tag/version check: a script in `scripts/`, with `node --test` tests, that fails on any mismatch. That script is what the workflow calls.
- **AC3** — A dry run of the packaging on the pull request: the same script and archive steps, without publishing. It shows the archive's file list and its SHA-256.
- **AC4** — Version `0.1.0` in the three manifests and in `CHANGELOG.md`. `claude plugin validate --strict` passes.
- **AC5** — The mod's README in English, with the screenshots, and `docs/RELEASING.md`.
- **AC6** — `npm run check` green, with the same `$` calls and no new runtime dependencies.
- **AC7** — The clean install check from `main` after the merge, recorded in the pull request by the Builder.

## Security constraints

- The release workflow is the only workflow with write permissions to contents and with an OIDC token. It must run only on tags, never on pull requests or branches.
- The archive contains only what the marketplace serves, checked against an explicit file list in the script.
- No secrets: provenance uses GitHub's OIDC token, never a stored key.
- New development dependencies need the Reviewer's approval in the pull request. Runtime dependencies are still not allowed.

## Required evidence

- The `/security-review` output and the review document.
- actionlint and zizmor output for `release.yml`.
- The dry run's file list and SHA-256.
- `npm run check` output.
- The screenshots and the clean install output.

## After the merge (Maintainer)

1. Apply a **tag ruleset** for `v*`: restrict creation to the Maintainer, block deletions and updates, and require signed tags if available (`docs/REPO-SETTINGS.md`).
2. Create and push the signed tag `v0.1.0` from `main`.
3. Check the GitHub Release, and run `gh attestation verify model-meter-0.1.0.tar.gz --repo at0mikd/model-meter`.
