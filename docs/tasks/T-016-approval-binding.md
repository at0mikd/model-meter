# T-016 · Review and merge rules: approval binding and lower-trust heads

- **Status:** Done ([#39](https://github.com/at0mikd/model-meter/pull/39), `c0c15d2`); scope item 4, the report update, waits for N9
- **Owner:** Reviewer (documentation and its own practice); Maintainer approves
- **Branch:** `claude/t016-approval-binding`
- **Plan:** `docs/WORKFLOW.md` §6–§7; T-013 audit, leads N6, N7 and N8 (`docs/security/audit-v0.1.0-security-audit-skill.md`)

## Goal

Mitigate three agent-workflow leads of the T-013 audit. Their details are **withheld until mitigated**: the traces, blockers and validation steps stay in the Builder's private audit run, and the Builder shares them with the Reviewer over the cross-session channel, never on GitHub. This file stays at the level the report already publishes.

The Reviewer has applied the three mitigations in practice since 2026-11-26; this task writes them into the workflow so they bind every future session.

## Scope

**In:**

1. **N6, approval binding.** `docs/WORKFLOW.md` §6:
   - the Maintainer's approval names the pull request and the **full 40-hex** head SHA;
   - the record comment quotes the full SHA;
   - the Reviewer merges only if the head is **exactly** that SHA, and pins the merge to it.
2. **N7, "update keeps the approval".** The check runs against a **fresh, pinned** `main`:
   - fetch `main` and record its SHA first;
   - run `git merge-tree` against that SHA, not a local `origin/main` of unknown age;
   - the updated head's parents must be exactly the approved SHA and the pinned `main` SHA;
   - the API's `compare` confirms `behind_by` 0 against that same `main`.
3. **N8, lower-trust heads.** `docs/WORKFLOW.md` §7: the Reviewer judges fork and Dependabot heads from the diff and CI only. It does not run their code in a session that holds push credentials. Mutation or other local runs are only for heads from the Maintainer's own branches.
4. **The report update.** Once this task and T-017 are merged, the T-013 report gets an update that publishes the full details of N5–N9, with each one's mitigation.

**Out:**

- The Builder's and the Reviewer's permission settings (T-017).
- Any GitHub setting.

## Acceptance criteria

- **AC1** — WORKFLOW §6 and §7 carry the rules of scope items 1–3, each with the reason ("T-013, N6", etc.).
- **AC2** — The Builder confirms, against its private run, that each rule closes its lead as described, or says what is missing.
- **AC3** — `docs/HANDOFF.md` operational notes match.

## Security constraints

- No attack detail of N5–N9 in this file, the pull request or its comments until the report update of scope item 4.

## Required evidence

- The Builder's confirmation (AC2), relayed by the Reviewer in the pull request as a yes or no per lead, without details.
