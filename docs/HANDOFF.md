# Session handoff — 2026-11-27

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
| #32–#33 | Task files and spike results in English; v0.1.0 recorded; Code-Review decision A (`d768acf`, `f8a0585`) |
| #34 | T-013 specified: a full audit with Cloudflare's `security-audit` skill (`488052e`) |
| #36 | T-013: audit report of v0.1.0, 0 confirmed, 9 `needs_validation`, 3 rejected (`b3df2e4`); first approval given with the full 40-hex SHA |
| #37–#38 | T-013 closed; mitigations T-014 to T-017 planned, then set `Ready` (`b9e0d31`, `7faf7ac`) |
| #39 | T-016: approvals bound to the full reviewed SHA, `main` pinned for the update check, trusted heads defined (`c0c15d2`) |
| #40 | T-014: capability gate checks every declared component; new marketplace gate; gate output quoted (`544ab68`) |
| #41 | T-015: package digest bound across jobs, attested by digest; tag re-checked before publishing; pinned verification documented (`63be751`) |
| #43 | T-017: exact allow rules for the Builder, a wider deny list, the credential table in REPO-SETTINGS §7 (`dff671a`) |

## Released

- **v0.1.0** — 2026-11-22, tag `v0.1.0` on `e844730`, [GitHub Release](https://github.com/at0mikd/model-meter/releases/tag/v0.1.0).
  - The workflow `Release` (run 45011714546) was green: version check, tag on `main`, signed tag verified by GitHub, full CI, package, attestation, release.
  - Verified after publishing: `sha256sum --check` OK, `gh attestation verify` OK (SLSA provenance v1, signer `release.yml@refs/tags/v0.1.0`, source `e844730`), 17 files as listed.
  - Clean install from `main` checked (T-012 AC7, on #30).
- **Repository security:** every Advanced Security feature is on (Dependabot alerts and security updates, secret scanning with push protection, private vulnerability reporting). The `main` ruleset and the `release tags` ruleset (id `27836653`) are active.

## Done since v0.1.0

- **The whole repository's documentation is in English** (#28, #29, #31, #32, #33).
- **Code-Review decision: A, accepted risk** (2026-11-23), recorded in `docs/REPO-SETTINGS.md` §6.
- **Old branches deleted and release immutability enabled** by the Maintainer (2026-11-23). Immutability is not retroactive: v0.1.0 stays mutable, and its attestation is what binds it.
- **T-013 security audit** (#36, `docs/security/audit-v0.1.0-security-audit-skill.md`): no exploitable vulnerability in v0.1.0. Nine leads remain to mitigate. Leads N5–N9 (agent workflow) are public only by title until mitigated (Maintainer's decision, 2026-11-26); their details stay in the Builder's private audit run.

## T-013 mitigations: state at the end of the 2026-11-27 window

| Lead | Task | State |
| --- | --- | --- |
| N1, N2 | T-014 | Closed |
| N3 | T-015 | Closed |
| N4 | T-015 | Closed in the docs; the Maintainer's pinned verification of v0.1.0 is pending |
| N5 | T-017 | Closed in source; the engine check (AC2) is pending |
| N6, N7, N8 | T-016 | Closed (the Builder confirmed each against the private run) |
| N9 | T-017 | **Open** until AC3 and the AC4 re-run |

**Observed hosted controls of the cloud Reviewer session** (2026-11-27, harmless probes against a nonexistent repository, no real write):

- the project deny list in `.claude/settings.json` did **not** refuse them in the running session;
- the session's GitHub proxy refused release writes, writes to ref paths (ref deletion included) and repository settings writes;
- the git proxy injects no credential for a repository outside the session's set, so pushes elsewhere fail;
- not tested, because it would be a real write: a tag or branch push to `model-meter` itself. `v*` tags are covered by the tag ruleset, and `release.yml` needs a tag signed with the Maintainer's key.

## Next session: pending, in order

| # | What | Who | Notes |
| --- | --- | --- | --- |
| 1 | **T-017 AC3:** record the Claude GitHub App's repository access and permissions in `REPO-SETTINGS.md` §7, and narrow the access to selected repositories | Maintainer, then the Reviewer writes it down | github.com/settings/installations → Claude → Configure. The App's own permission set is fixed by the App; the repository admin role is the owner's and cannot be removed |
| 2 | **T-017 AC2:** in a throwaway clone, the Builder's normal flow runs without new prompts, and anything outside the exact allow list prompts | Maintainer | — |
| 3 | **T-017 AC4 re-run:** a fresh cloud Reviewer session on `main`, with the repository as its working directory, runs the three harmless probes of the #43 review (a release write and a ref deletion against a nonexistent repository, and a tag refspec push to a nonexistent remote), and records what refuses each | Maintainer and Reviewer | Shows whether a fresh session loads the deny list |
| 4 | **T-015 AC5:** `gh release download v0.1.0 --repo at0mikd/model-meter --pattern 'model-meter-0.1.0.tar.gz'`, then the pinned `gh attestation verify` of `docs/RELEASING.md` §5 | Maintainer, on their own machine | The cloud session cannot initialize the Sigstore verifier |
| 5 | The Builder's final yes/no per lead (N1–N9), over the private channel | Builder | After 1–3 |
| 6 | **T-013 report update:** publish the details of every mitigated lead with its mitigation; N9 stays withheld while open | Reviewer | T-016 scope item 4 |
| 7 | **Dependabot #35** (TypeScript 6.0.3 → 7.0.2, a major version): judged from the diff, the changelog and CI only; recommend merging, waiting, or ignoring that major version | Reviewer | — |
| 8 | **Optional:** add `package (dry run)` and `package (digest across jobs)` to the `main` ruleset's required checks | Maintainer | Recommended by the Reviewer |

The Builder keeps its private audit run until item 6 is merged.

## Later

- **Phase 5, optional:** palettes and `showEffortMeter` (T-011, not specified). The Maintainer's call.

## Backlog (no task yet)

- **[nit from #22]** An element whose `type` `widthOfTree` does not know, and with no `children`, measures 0, so too little room would be reserved. No known case today: the CLI's types are a closed union. Revisit if that union grows.
- **[nit from #40]** `JSON.stringify` does not escape C1 control characters (for example `\u009b`) in gate messages. They cannot forge an Actions workflow command, which needs a line start.

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
- **Channel with the Builder:** cross-session messages (`send_message` of the remote-session tools) plus GitHub. Withheld audit details travel only over this channel. The only valid approval is the Maintainer's, written in the Reviewer's conversation (`docs/WORKFLOW.md` §6).
- **Merging after T-016:** approvals name the full 40-hex SHA, copied from the Reviewer's LGTM; record comments are posted with `-F body=@<file>` (T-017: the deny list matches command text).
- **gitleaks:** the permission classifier blocks running it locally, in both sessions; it runs in CI.
