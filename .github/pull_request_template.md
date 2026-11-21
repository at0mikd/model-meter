## Task

<!-- T-NNN and a link to its file in docs/tasks/ -->

## What changes

<!-- A short summary. What does NOT change, if there could be doubts. -->

## Acceptance criteria

<!-- One per line, each with its evidence (test, command or output). -->

- [ ] AC1 — evidence:
- [ ] AC2 — evidence:

## Evidence

<!-- Real command output, pasted as is. No personal paths, tokens or private data. -->

<details><summary>npm run check</summary>

```text
```

</details>

<details><summary>claude plugin validate (mod capabilities)</summary>

```text
```

</details>

## Security checklist

- [ ] The mod only observes: no hook rewrites `model`/`effort` or blocks events
- [ ] Mod capabilities stay within the allowlist (`docs/PLAN.md` §5)
- [ ] No new dependencies, or justified and allowed by the task
- [ ] Text drawn on screen goes through sanitization
- [ ] No secrets, personal data or local paths in code, fixtures or evidence
- [ ] Workflows (if touched): least privilege, actions pinned by SHA, no `pull_request_target`

## Notes for the review

<!-- Decisions, doubts or risks the Reviewer should look at. -->
