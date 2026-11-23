# Session handoff — 2026-11-23

The state of `model-meter`, to resume in a new session (Reviewer in the cloud, Builder local).

## Done (on `main`)

| PR | What |
| --- | --- |
| #1–#7 | Plan, Reviewer–Builder workflow, backlog and spike; T-000 results; single name `model-meter`; T-001 scaffold, quality and security gates, CI |
| #9–#13 | T-007 expiry warning and weekly audit; T-002 pure core (100% coverage); T-003 spec; T-003 compact footer badge (`46fa489`); picomatch exception withdrawn |
| #15–#18 | T-003 closed and T-003b specified; GitHub settings (`REPO-SETTINGS.md`) and merge rules; T-008 specified; ruleset step 1 applied |
| #19 | T-003b: the hint is measured as drawn (`next.trace`); the badge shows in full at half screen next to `sub-meter` (`872bfc8`) |
| #20 | T-008: commitlint skips only Dependabot bumps; stable mod job name `mod (validate, test:mod, capabilities)` (`826fd97`) |
| #21 | T-003b and T-008 closed, full ruleset recorded, T-009 specified (`bf238d9`) |
| #22 | T-009: the footer counts what mods beneath draw; commitlint guard test (`5abaade`); first PR with the Builder's signed commits |
| #23 | T-004 specified, T-009 closed (`0404e7e`) |
| #24 | T-004: 8-bit band above the prompt and `auto` placement, with provisional sprites (`aa60f67`) |
| #25 | T-010 specified: 12×12 three-color sprites, Mythos family, `model` label (`c3b8688`) |
| #26 | Dependabot ignores major updates of `@types/node`, which stays on the oldest supported Node, 22 (`1c93ce3`); #8 closed |
| #27 | T-010: 12×12 three-color sprites (chalice with a ruby, quill, mountain, papyrus scroll, winged helmet, cartridge) in fixed hex identity colors, the Mythos family and the `model` label (`71d4031`) |
| #28 | Professional English documentation (README, CONTRIBUTING, SECURITY, Code of Conduct, issue forms), T-012 specified (`99d809b`) |
| #29 | WORKFLOW and REPO-SETTINGS in English; tag ruleset documented; the Builder may not push tags or run `gh release` (`244f521`) |
| #30 | T-012: release workflow (signed, verified tag on `main`; full CI; deterministic package; build provenance), v0.1.0, security review, RELEASING (`d87bc8e`) |
| #31 | PLAN in English and up to date (`e844730`) |

## Released

- **v0.1.0** — 2026-11-22, tag `v0.1.0` on `e844730`, [GitHub Release](https://github.com/at0mikd/model-meter/releases/tag/v0.1.0).
  - The workflow `Release` (run 45011714546) was green: version check, tag on `main`, signed tag verified by GitHub, full CI, package, attestation, release.
  - Verified after publishing: `sha256sum --check` OK, `gh attestation verify` OK (SLSA provenance v1, signer `release.yml@refs/tags/v0.1.0`, source `e844730`), 17 files as listed.
  - Clean install from `main` checked (T-012 AC7, on #30).
- **Repository security:** every Advanced Security feature is on (Dependabot alerts and security updates, secret scanning with push protection, private vulnerability reporting). The `main` ruleset and the `release tags` ruleset (id `27836653`) are active.

## In progress

- **Documentation in English:** every living document is in English. The task files T-000…T-010 are translated in this pull request; the spike results (`docs/spikes/`) follow in the next one.

## Pending, in order

| # | What | Who | Depends on |
| --- | --- | --- | --- |
| 1 | Translate the spike results (`docs/spikes/`) to English | Reviewer | — |
| 2 | Enable **release immutability** (Settings → General → Releases), so published release assets cannot change | Maintainer | — |
| 3 | Edit the v0.1.0 release notes: `&lt;version&gt;` shows escaped (the CHANGELOG avoids `<…>` placeholders from now on) | Maintainer | — |
| 4 | Decision A/B on Code-Review (Scorecard) | Maintainer | — |
| 5 | Delete the old branches (below) | Maintainer | — |
| — | **Phase 5, optional, later:** palettes and `showEffortMeter` (T-011, not specified) | Reviewer | Maintainer's call |

**Old branches.** There are 10 branches that were merged or replaced. Each head matches its pull request's, so nothing is lost:

- `spike/T-000-terminal` (#2), `chore/T-001-scaffold` (#6), `chore/T-007-audit-expiry-warning` (#9), `feat/T-002-pure-core` (#10), `feat/T-003-compact-footer` (#12), `chore/remove-picomatch-exception` (#13), `claude/docs-t003b` (#15), `claude/docs-repo-settings` (#16) and `claude/docs-t008` (#17);
- `claude/cool-euler-xg853i`: #14, closed, with the same content as #15.

The Maintainer deletes them from the *Branches* tab. New branches are deleted on merge (*Automatically delete head branches*). The Dependabot branch of #8 went away when #8 was closed.

## Backlog (no task yet)

- **[nit from #22]** An element whose `type` `widthOfTree` does not know, and with no `children`, measures 0, so too little room would be reserved. No known case today: the CLI's types are a closed union. Revisit if that union grows.

## Recorded incidents

- **#7 and #11 were merged with `check:core` red** (commitlint), because the Reviewer did not check their CI. This was fixed in the process (check every check before merging, one branch per pull request, lowercase subjects) and, for good, by the ruleset.
- **Altered Dependabot command** (2026-11-20). The Reviewer's `@dependabot rebase` comment on #8 was stored with separators inserted, and Dependabot ignored it. Bot commands are written by the Maintainer (`WORKFLOW.md` §7).
- **"Up to date" stated wrongly** (2026-11-21). On #27 the Reviewer stated that the head was up to date with `main` when it was not; the ruleset's `strict` rule blocked the merge. The fix was an "Update branch" verified with `git merge-tree`. Lesson: check with `gh api …/compare` before stating it.

## Operational notes

- **GitHub access:**
  - the cloud session reaches the repository as `at0mikd/model-meter`, added with push access, and uses `gh api` (REST);
  - the session's GitHub tools under the old name `who-is-claude` were retired;
  - merges need the **Accept edits** permission mode: in *Auto* mode, the permission classifier blocks them.
- **Proxy limits in the cloud:** the cloud session cannot open GitHub attachments (`user-attachments`), nor some external hosts. Screenshots are checked by the Maintainer, and their content is relayed by the Builder.
- **Channel with the Builder:** cross-session messages (Remote Control) plus GitHub. The only valid approval is the Maintainer's, written in the Reviewer's conversation (`docs/WORKFLOW.md` §6).
- **gitleaks:** the permission classifier blocks running it locally, in both sessions; it runs in CI.
