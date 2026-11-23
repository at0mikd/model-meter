# GitHub repository settings

> What the Maintainer configures by hand on GitHub. No agent changes the repository's settings (`docs/WORKFLOW.md` §7). These settings are the **real control** behind the workflow: without them, GitHub allows merging with red checks, pushing straight to `main` or rewriting its history.

**State as of 2026-11-20: steps 1 and 2 applied and verified.**

- **How it was verified:** through the read-only API, with `gh api` from the Builder's session. The cloud session cannot read that API.
- **The ruleset:** `main` (id `27628705`), active, targeting `~DEFAULT_BRANCH`, with no bypass.
- **Rules in effect on `main`:**
  - `deletion`, `non_fast_forward`, `required_linear_history` and `required_signatures`;
  - `pull_request` with 0 approvals and `squash` only;
  - `required_status_checks`: the 12 checks in the table below, all from GitHub Actions, with `strict_required_status_checks_policy: true` (the branch must be up to date with `main`);
  - `code_scanning`: CodeQL, with security alerts `high_or_higher` and alerts `errors`.
- **First pull request merged under step 2:** #19.

## 0. Order of application

1. ✅ (2026-11-19) The ruleset of section 1, **without** the rule *Require status checks to pass*.
   - It already guarded against deletion, force pushes, direct pushes and merges other than squash.
   - Until step 2, the Reviewer made sure that checks were green (`docs/WORKFLOW.md` §6).
2. ✅ (2026-11-20, after T-008) *Require status checks to pass*, with the list of checks.
   - T-008 made the mod job's name stable and let Dependabot's pull requests pass commitlint.
   - Requiring the checks earlier would have blocked Dependabot, and left the mod's check waiting for a name that changes.
3. Before the first release (T-012): the **tag ruleset** of section 4.

## 1. The `main` ruleset

**Settings → Rules → Rulesets → New ruleset → New branch ruleset**

| Field | Value |
| --- | --- |
| Ruleset name | `main` |
| Enforcement status | **Active** |
| Bypass list | **Empty.** Any actor with bypass makes Scorecard consider that the rule does not apply to administrators |
| Target branches | *Add target* → **Include default branch** |

Rules to tick:

| Rule | Setting | Why |
| --- | --- | --- |
| **Restrict deletions** | ✓ | Nobody deletes `main` (Scorecard, Tier 1) |
| **Block force pushes** | ✓ | Nobody rewrites the published history (Scorecard, Tier 1) |
| **Require linear history** | ✓ | Squash only, no merge commits on `main` |
| **Require signed commits** | ✓ | GitHub signs the squash (verified) |
| **Require a pull request before merging** | ✓ · *Required approvals*: **0** · *Allowed merge methods*: **Squash** | A single human account: GitHub does not let anyone approve their own pull request. The approval lives in the conversation with the Reviewer (`docs/WORKFLOW.md` §6) |
| **Require status checks to pass** | ✓ · **Require branches to be up to date before merging** ✓ · the 12 checks below | Prevents merging on red, and CI testing a merge with an old `main` |
| **Require code scanning results** (optional) | Tool **CodeQL** · *Security alerts*: **High or higher** · *Alerts*: **Errors** | Blocks new serious CodeQL alerts |

> **`require_extra_approval_for_unattributed_changes: true`.** GitHub turns it on by default in every ruleset, new or existing: the rule ["Additional approval for unattributed Copilot pull requests"](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets), in *public preview* (checked against the official docs on 2026-11-19).
>
> - **What it does:** it only requires an extra approval when the Copilot agent opens a pull request that is not attributed to a person.
> - **Why it does not affect us:** our pull requests are attributed to the Maintainer, and Dependabot is not Copilot.
> - **Decision:** it stays on, because it protects us if Copilot is ever used. It will be reviewed when it leaves preview.

Required checks. The names are exact; when adding them, pick *GitHub Actions* as the source:

| Check | Workflow |
| --- | --- |
| `check:core (Node 22, ubuntu-latest)` | CI |
| `check:core (Node 22, macos-latest)` | CI |
| `check:core (Node 22, windows-latest)` | CI |
| `check:core (Node 24, ubuntu-latest)` | CI |
| `check:core (Node 24, macos-latest)` | CI |
| `check:core (Node 24, windows-latest)` | CI |
| `mod (validate, test:mod, capabilities)` | CI |
| `Analyze (javascript-typescript)` | CodeQL |
| `Review dependency changes` | Dependency review |
| `Scan the full history` | Gitleaks |
| `actionlint` | Workflow lint |
| `zizmor` | Workflow lint |

Scorecard is not on the list: it runs only on `main`, not on pull requests. Any check added later (for example T-012's packaging dry run) is not required until it is added here and in the ruleset.

> **Dependabot and commitlint.** Dependabot always writes "Bump" capitalized (`chore(deps-dev): Bump @types/node`), which `subject-case` rejects.
>
> - **Since T-008,** commitlint skips only the commits that have **both** Dependabot's exact subject (`chore(deps)`, `chore(deps-dev)` or `ci(deps)`, followed by `: Bump …`) **and** its line `Signed-off-by: dependabot[bot] <support@github.com>` (`scripts/commitlint-ignores.mjs`, with tests).
> - **Any other commit** goes through every rule.

> **"BLOCKED" and unsigned commits.** GitHub can show a pull request as blocked (`mergeable_state: blocked`) even when it meets everything else. The cause is `required_signatures`: when it evaluates a pull request, GitHub also checks the branch's commits, and *"unsigned commits on the head branch can block a squash merge, even though GitHub would sign the final squash commit. This restriction can also apply to the author of the pull request"* ([official docs](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets), checked on 2026-11-20).
>
> - Squash merges through the API worked anyway (#18, #19 and #20), but GitHub does not guarantee it.
> - The cloud session's commits carry an SSH signature.
> - **Fix applied (2026-11-20):** the Maintainer created and registered an SSH signing key, and the Builder's local git signs the commits of this repository. The first pull request with every commit signed, #22, came out `clean` instead of `blocked`, which confirms the cause.

> **"Require branches to be up to date".** After each merge into `main`, the other open pull requests need "Update branch", which gives them a new SHA. So that not everything has to be approved again, `docs/WORKFLOW.md` §6 defines when such an update keeps the approval.

## 2. Pull requests

**Settings → General → Pull Requests**

- **Allow squash merging** ✓. *Allow merge commits* and *Allow rebase merging* ✗.
- **Always suggest updating pull request branches** ✓.
- **Automatically delete head branches** ✓ (on since 2026-11-19). It fits one branch per pull request (`docs/WORKFLOW.md` §7).

## 3. Code security

**Settings → Advanced Security**

- **Dependency graph** ✓ (already on).
- **Dependabot alerts** ✓ and **Dependabot security updates** ✓.
- **Secret Protection** ✓ with **Push protection** ✓.
- **Private vulnerability reporting** ✓ (`SECURITY.md`; the issue forms link to it).
- **CodeQL:** no *default setup*. Our advanced workflow (`.github/workflows/codeql.yml`) runs it.

## 4. Tag ruleset (before the first release)

Releases are cut from a tag `v*` (T-012, `release.yml`). Once a tag is published, nobody may move or delete it.

**Settings → Rules → Rulesets → New ruleset → New tag ruleset**

| Field | Value |
| --- | --- |
| Ruleset name | `release tags` |
| Enforcement status | **Active** |
| Bypass list | **Repository admin** role only (the Maintainer), so that only the Maintainer can create a release tag. Scorecard's Branch-Protection check looks at branches, not tags, so this bypass does not lower it |
| Target tags | *Add target* → **Include by pattern** → `v*` |

| Rule | Setting | Why |
| --- | --- | --- |
| **Restrict creations** | ✓ | Only the bypass actor (the admin role) creates `v*` tags |
| **Restrict updates** | ✓ | A published tag never moves to another commit |
| **Restrict deletions** | ✓ | A published tag is never deleted |
| **Require signed commits** | ✓ | The tagged commit is signed (squash commits on `main` are) |

> **Limit of this ruleset.** The Builder works under the Maintainer's GitHub account, so the admin bypass covers it too. Two more guards keep an agent from publishing a release:
>
> - the Builder's local permissions (`.claude/settings.json`) deny pushing tags (`git push --tags`, `git push origin v*`) and `gh release`;
> - `docs/WORKFLOW.md` §7: only the Maintainer creates and pushes release tags.

**Release flow:** `docs/RELEASING.md` (written in T-012). The Maintainer creates a **signed** tag (`git tag -s v0.1.0`) on `main` and pushes it. The workflow verifies the version, runs the gates again, packages the archive, attests its provenance and publishes the GitHub Release.

## 5. How to check it

1. A pull request with a red check shows **Merging is blocked**, and the merge button is disabled.
2. The next Scorecard run on `main` raises Branch-Protection to 3/10 (Tier 1). Going further requires at least one approval from another identity; see the accepted risk below.
3. After section 4: pushing a commit onto an existing tag `v*`, or deleting it, is rejected.

## 6. Accepted risk: no second reviewing identity (decision A, 2026-11-23)

OpenSSF Scorecard's **Code-Review** and the higher tiers of **Branch-Protection** expect every change to be approved on GitHub by an identity other than its author. Here they score low, and the Maintainer **accepted that risk** on 2026-11-23 (decision A).

- **Why it scores low.**
  - The project has a single human maintainer, and the Builder opens pull requests through that same account.
  - GitHub does not let anyone approve their own pull request, so the ruleset requires 0 approvals.
- **What controls the change instead.**
  - **Approval:** the Maintainer approves each pull request at a specific head SHA, in the conversation with the Reviewer (`docs/WORKFLOW.md` §6).
  - **The record:** a comment on the pull request records that approval, and the merge is pinned to the approved SHA.
  - **Separation of duties:** the Reviewer, a separate agent session, reviews every change against its task, with severities, and with mutation and security checks.
  - **Technical gates:** 12 required checks, up to date with `main`, signed commits, linear history, and CodeQL code scanning.
- **The rejected alternative (B).** A second, machine identity for the Builder, so the Maintainer could approve on GitHub and the ruleset could require 1 approval. It would raise the score, at the cost of creating, securing and rotating another account and its signing key. Rejected for now.
- **When to revisit:** when a second human maintainer joins, or if the project starts publishing to a wider audience.
