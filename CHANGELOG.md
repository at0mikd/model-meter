# Changelog

All notable changes to this project are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-11-22

### Added

- **Compact badge in the terminal footer** (`model-meter`): the model and the effort, live with `/model`, `/effort` and every turn. A pending effort is dimmed with `…`, and anything unknown looks "switched off" in 8-bit (`◇`, `░`, `---`) without changing width. The badge gives way by width next to the hints and other mods. It only observes, and stores nothing but the last effort level.
- **Optional 8-bit band above the prompt** (`model-meter`), with the label `model Opus 5.5` / `power ▮▮▮▯▯ high`:
  - an original 8-bit sprite per family, 12×12 pixels in 3 fixed colors, so it looks the same in any theme: a chalice with a ruby, a quill, a mountain with the sun, a papyrus scroll and a winged helmet, plus an empty cartridge for anything unknown;
  - it fits the band's width and gives way to surveys;
  - options `placement` (`footer` by default, `auto` or `band`) and `autoMinColumns` (140, from 80 to 400); `auto` uses hysteresis, coming in at 140 columns and going under 120;
  - the footer does not change.
- **Mythos family** (`model-meter`): `claude-mythos-5`, `claude-mythos-5-1` and `claude-mythos-preview` show as `Mythos 5`, `Mythos 5.1` and `Mythos preview`, in the `planMode` color, in the footer and in the band.
- **Release workflow**: a `v*` tag that matches the three manifests runs the full check again. It then builds a deterministic package of what the marketplace serves (`model-meter-<version>.tar.gz` and `SHA256SUMS`), attests its build provenance and publishes the GitHub release (`docs/RELEASING.md`). CI runs a dry run of the package on every pull request.
- Security review of v0.1.0 (`docs/security/review-v0.1.0.md`).
- `check-capabilities` allows `$.state` only for `model-meter`'s own keys, declared in its contract.
- The `model-meter` mod skeleton and the `model-meter` marketplace.
- The mod's pure core (`hooks/core/`): text sanitization, reading the model id (Bedrock and Vertex included), effort levels as a closed list, the cascade that picks the effort to show, and fitting the badge to the footer's width. No `$` and no dependencies; its tests live in `test/core/`.
- Local gates (`npm run check`, `npm run check:core`) and CI:
  - a Node 22/24 × Linux/macOS/Windows matrix;
  - the mod's validation and tests with a pinned CLI, and the capabilities check;
  - CodeQL, dependency review, Scorecard, gitleaks, actionlint and zizmor.
- `npm run audit`: fails on any security advisory without an approved, current exception (`security/audit-exceptions.json`).
- `npm run audit` warns 14 days before an exception expires, also as a GitHub Actions annotation. A weekly read-only audit (`Scheduled audit`) runs it on `main`.
- `SECURITY.md` (with the active exceptions), `CONTRIBUTING.md`, `CODEOWNERS` and Dependabot.

### Fixed

- The `model-meter` badge shows again at half screen next to `sub-meter`. It measures the footer's hint as drawn, not as it arrives, and no longer reserves room for the text another mod hides.
- The badge also counts what a mod beneath changes in the row: the text it wraps the hint line in, and the mode labels it removes or adds.

### Security

- The audit exception for `picomatch` (GHSA-fc5q-39xc-vjpf) is removed: GitHub withdrew the advisory on 2026-11-18, and `npm run audit` no longer needs it.
