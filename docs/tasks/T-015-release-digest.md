# T-015 · Release integrity: bind the package digest across jobs and pin the documented check

- **Status:** Ready
- **Branch:** `chore/T-015-release-digest`
- **Plan:** `docs/PLAN.md` §5–§6; T-013 audit, leads N3 and N4 (`docs/security/audit-v0.1.0-security-audit-skill.md`)

## Goal

Close two gaps in the release path that the T-013 audit left as `needs_validation`:

- **N3.** `release.yml` uploads the package as an artifact named `package`, and the `attest` and `release` jobs download it **by name**. The only integrity check is a `sha256sum --check` inside the `package` job, against a `SHA256SUMS` written beside the archive. No digest leaves the `package` job for the later jobs to compare against.
- **N4.** `docs/RELEASING.md` §5 verifies the attestation with `--repo` only, so the archive is tied to the repository but not to `release.yml`, the tag or its commit; and `SHA256SUMS` comes from the same release assets it checks.

The fix is applied **whether or not** GitHub lets one job replace another job's artifact: binding the digest closes the gap whatever the answer.

## Scope

**In:**

1. **The digest as a job output.** The `package` job computes the archive's sha256 and exposes it as an output. `scripts/package.mjs` prints it in a form the workflow can read, or a step computes it with `sha256sum`.
2. **Checked after every download.** In `attest` and `release`, a step compares the downloaded archive's sha256 with the `package` job's output and fails on any difference, before anything else uses the archive.
3. **Attest the digest, not the path.** `actions/attest-build-provenance` (same pinned SHA) takes `subject-name` and `subject-digest` from the job output.
4. **The tag has not moved.** Before `gh release create`, check that the remote tag still points to the run's commit (`github.sha`); fail otherwise. (A hardening note of T-013.)
5. **The CI dry run mirrors it.** The `package (dry run)` job in `ci.yml` exposes and checks the digest the same way, so pull requests exercise the new steps.
6. **`docs/RELEASING.md` §5:**
   - the pinned check: `gh attestation verify model-meter-X.Y.Z.tar.gz --repo at0mikd/model-meter --signer-workflow at0mikd/model-meter/.github/workflows/release.yml --source-ref refs/tags/vX.Y.Z --source-digest <tag commit>`;
   - `SHA256SUMS` is a convenience, not the trust root; the attestation is;
   - a note that **v0.1.0 is not immutable**: release immutability was enabled after it was published and does not apply retroactively. Its attestation still binds it to `release.yml@refs/tags/v0.1.0` and `e844730`.

**Out:**

- Testing GitHub-hosted artifact behaviour in a throwaway repository (the fix does not depend on it).
- Cutting a new release. The first real run of the new steps is the next release, which the Maintainer tags.

## Acceptance criteria

- **AC1** — actionlint and zizmor clean on `release.yml` and `ci.yml`.
- **AC2** — Every new or changed action is pinned by SHA with its version in a comment; job permissions do not widen.
- **AC3** — The dry run on the pull request shows the digest output and a passing comparison. A local fixture shows the comparison failing when the archive is swapped and `SHA256SUMS` regenerated (the T-013 scenario).
- **AC4** — Any script change has `node --test` tests; `npm run check` green; no new dependencies.
- **AC5** — The pinned `gh attestation verify` form, run by the Maintainer against v0.1.0 (read only), passes; its output goes in the pull request.

## Security constraints

- `release.yml` stays the only workflow with `contents: write` and an OIDC token, and runs only on `v*` tags.
- Job outputs carry only the hex digest; nothing from it is interpolated into `run:` steps except through `env:`.
- No secrets, no stored keys.

## Required evidence

- actionlint and zizmor output.
- The dry run's digest and comparison, and the swapped-archive failure.
- The Maintainer's pinned verification of v0.1.0.
