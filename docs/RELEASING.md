# Releasing model-meter

A release is a signed tag `vX.Y.Z` on `main`. The tag triggers `.github/workflows/release.yml`, which checks it, builds the package, attests its provenance and publishes the GitHub release. Nobody uploads files by hand, and no stored key is involved: provenance uses GitHub's OIDC token.

## What gets published

The package is what the marketplace serves, and nothing else:

- `model-meter-X.Y.Z.tar.gz` holds `plugins/model-meter/` and `.claude-plugin/marketplace.json`, under a `model-meter-X.Y.Z/` folder.
- `SHA256SUMS` holds the archive's SHA-256, in the format `sha256sum --check` reads.
- A build provenance attestation is made for the archive.

The files must match the explicit `PUBLISHED` list in `scripts/package.mjs`. Anything missing or extra fails the build, so a file added to the plugin folder must be added to that list on purpose. `git archive` packs the files from the tagged commit, so the same commit always gives the same **uncompressed tar**, byte for byte. The `.tar.gz` is identical only when the same zlib compresses it: GitHub's runners use classic zlib, while some distributions ship zlib-ng (Fedora, for example), which compresses the same tar differently. To check a release against a local build, compare the uncompressed tars: `gzip -dc model-meter-<version>.tar.gz | sha256sum` on both sides (verified for v0.1.0: the tars match while the `.gz` digests differ).

## Steps

### 1. Prepare the release in a pull request

1. **Bump the version** in the three manifests. All three must agree:

   ```sh
   npm version X.Y.Z --no-git-tag-version --ignore-scripts   # package.json and package-lock.json
   ```

   Then set the same `version` in `plugins/model-meter/.claude-plugin/plugin.json` and in the `model-meter` entry of `.claude-plugin/marketplace.json`.

2. **Update `CHANGELOG.md`:** move everything under `## [Unreleased]` to a new `## [X.Y.Z] - YYYY-MM-DD` section, and leave `## [Unreleased]` empty above it. That section becomes the release notes.

3. **Check locally:**

   ```sh
   node scripts/release-version.mjs check vX.Y.Z   # the tag matches the three manifests
   node scripts/release-version.mjs notes vX.Y.Z   # the release notes
   node scripts/package.mjs                        # dist/model-meter-X.Y.Z.tar.gz and dist/SHA256SUMS
   npm run check
   ```

4. **Open the pull request.** CI runs the full check, and the `package (dry run)` job, which builds and lists the package without publishing it.

5. **Get it approved and merged.** The Maintainer approves it in the conversation with the Reviewer, naming the pull request and its full 40-hex head SHA, and it is squash-merged (`docs/WORKFLOW.md` §6).

### 2. Check a clean install from `main`

Before tagging, in a fresh Claude Code profile:

```text
/plugin marketplace add at0mikd/model-meter
/plugin install model-meter@model-meter
```

Open a session and check that the badge shows in the footer.

### 3. Tag (Maintainer)

Only the Maintainer creates release tags. A tag ruleset on `v*` restricts their creation and blocks deletions and updates (`docs/REPO-SETTINGS.md`).

```sh
git switch main && git pull --ff-only
git tag -s vX.Y.Z -m "model-meter vX.Y.Z"   # a signed tag on the merged commit
git push origin vX.Y.Z
```

The tag must be annotated and signed (`git tag -s`), with a key registered on GitHub as a signing key, so that GitHub verifies the signature. It must also point to a commit on `main`. The workflow refuses any other tag.

### 4. Let the workflow run

`release.yml` runs these jobs in order, each with only the permissions it needs:

| Job | What it does | Permissions |
| --- | --- | --- |
| `tag matches the manifests` | `release-version.mjs check` on the tag; the tagged commit is on `main`; the tag is annotated, signed, verified by GitHub, and points to that commit | `contents: read` |
| `npm run check` | the whole CI again (`ci.yml` through `workflow_call`) | `contents: read` |
| `package` | `package.mjs`, `sha256sum --check`, uploads the files as an artifact | `contents: read` |
| `attest provenance` | `actions/attest-build-provenance` over the archive | `id-token: write`, `attestations: write` |
| `GitHub release` | creates the release with the archive, `SHA256SUMS` and the notes | `contents: write` |

If any job fails, nothing is published. A tag on a commit that is not on `main`, a lightweight tag, or a tag whose signature GitHub cannot verify stops the release at the first job. A protected tag cannot be moved or deleted, so a fix means a new patch version: go back to step 1.

### 5. Verify the release

```sh
gh release view vX.Y.Z --repo at0mikd/model-meter
gh release download vX.Y.Z --repo at0mikd/model-meter --dir /tmp/model-meter-X.Y.Z
cd /tmp/model-meter-X.Y.Z
sha256sum --check SHA256SUMS
gh attestation verify model-meter-X.Y.Z.tar.gz --repo at0mikd/model-meter
```

`gh attestation verify` must report that the archive was built by `.github/workflows/release.yml` in `at0mikd/model-meter`, from the tag's commit.
