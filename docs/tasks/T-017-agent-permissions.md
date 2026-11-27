# T-017 · Agent permissions: exact allow rules and a bounded write scope

- **Status:** Ready
- **Branch:** `chore/T-017-agent-permissions`
- **Plan:** `docs/WORKFLOW.md` §7, `docs/REPO-SETTINGS.md`; T-013 audit, leads N5 and N9 (`docs/security/audit-v0.1.0-security-audit-skill.md`)

## Goal

Mitigate two agent-workflow leads of the T-013 audit. Their details are **withheld until mitigated**: the Builder already holds them in its private audit run. This file stays at the level the report already publishes.

- **N5.** The Builder's allow rules pre-approve broader effects than intended.
- **N9.** The Reviewer's GitHub writes other than merges have no deterministic scope.

## Scope

**In:**

1. **N5 (Builder).** In `.claude/settings.json`, replace argument-unbounded allow prefixes with exact commands, so that anything outside them prompts. Keep the deny list.
2. **N9 (Reviewer and Maintainer).**
   - **Record** in `docs/REPO-SETTINGS.md` what the cloud session's GitHub credential can write in this repository. The Maintainer reads it from the GitHub App and the session settings; no agent changes them.
   - **Narrow** it where the platform allows, by the Maintainer.
   - **Add deterministic deny rules** for the GitHub write APIs the Reviewer does not need. They go in the project settings that the cloud session loads, and the Maintainer approves them in the pull request.
3. **Docs:** WORKFLOW §7 describes the resulting boundaries.

**Out:**

- The approval and merge rules (T-016).
- Creating tokens or a second GitHub identity (decision A, `docs/REPO-SETTINGS.md` §6).

## Acceptance criteria

- **AC1** — The allow list holds only exact commands, each with a one-line reason in the pull request.
- **AC2** — The Builder's normal flow (`npm run check`, commits, pushes to its branch) still works without new prompts; anything else prompts. The evidence is a short transcript of both cases.
- **AC3** — `REPO-SETTINGS.md` records the credential's scope and the Maintainer's narrowing decision.
- **AC4** — The deny rules block a sample of unneeded write calls in the Reviewer's session (shown as refused), and do not block reading, the record comment or the merge.
- **AC5** — The Builder confirms against its private run that N5 and N9 are closed, or says what is missing.

## Security constraints

- No agent edits its own permissions outside this pull request. The change takes effect only after the Maintainer's approval and the merge.
- No attack detail of N5–N9 in this file, the pull request or its comments until the T-013 report update (T-016, scope item 4).

## Required evidence

- The before and after allow lists.
- The AC2 and AC4 transcripts.
- The Builder's confirmation (AC5), as a yes or no per lead.
