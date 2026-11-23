# T-008 · CI: Dependabot commits and a stable name for the mod job

- **Status:** Done ([#20](https://github.com/at0mikd/model-meter/pull/20), `826fd97`)
- **Branch:** `chore/T-008-ci-dependabot-names`
- **Plan:** `docs/PLAN.md` §6; `docs/REPO-SETTINGS.md` §0 (ruleset step 2)

## Goal

The checks can be required in the `main` ruleset (step 2 of `docs/REPO-SETTINGS.md` §0) without blocking Dependabot or depending on the CLI's version.

## Starting data

- **Dependabot always writes "Bump" capitalized,** and commitlint rejects it under `subject-case`.
  - Verified on `3b10c21` (pull request #8): `chore(deps-dev): Bump @types/node` → "subject must not be sentence-case".
  - The real prefixes, from `.github/dependabot.yml`: `chore(deps)` and `chore(deps-dev)` for npm, and `ci(deps)` for GitHub Actions and for `tools/claude-cli`.
  - The commits carry the trailer `Signed-off-by: dependabot[bot] <support@github.com>`.
- **The mod job is called `validate, test:mod, capabilities (claude CLI 2.1.327)`.** When Dependabot updates the CLI, the name will change, and a required check with the old name would never arrive.

## Scope

**In:**

1. **`scripts/commitlint-ignores.mjs`** (new, no dependencies). It has a pure function, `isDependabotBump(message: string): boolean`, that returns `true` **only** when both conditions hold:
   - the first line matches `^(chore|ci)\((deps|deps-dev)\): Bump \S` (anchored, no nested quantifiers);
   - the message contains the exact line `Signed-off-by: dependabot[bot] <support@github.com>`.

   `commitlint.config.js` uses it in `ignores: [isDependabotBump]`. The other rules do not change: any other commit still goes through `subject-case`.
2. **Tests** in `scripts/commitlint-ignores.test.mjs`, with coverage of `scripts/` ≥ 95%.
   - **Positive:** a single npm bump (`deps-dev`), a grouped bump (`Bump the dev-dependencies group …`), GitHub Actions (`ci(deps)`) and `tools/claude-cli` (`ci(deps)`), all with the trailer.
   - **Negative:**
     - Dependabot's subject without the trailer;
     - the trailer with another subject (`docs: Update readme`);
     - another type (`feat(deps): Bump x`);
     - another scope (`chore(deps-prod): Bump x`);
     - `Bump` with nothing after it;
     - the trailer with another email, or with `dependabot` without `[bot]`;
     - an empty message.
   - **Integration:** the real message of `3b10c21` as a fixture → `true`.
3. **`.github/workflows/ci.yml`:** the mod job is renamed **`mod (validate, test:mod, capabilities)`**, with no version. The version stays visible in the log (the `claude --version` step). Nothing else in the workflow changes.
4. **`docs/REPO-SETTINGS.md`:** the mod job's new name in the table of required checks, and the version warning removed.
5. **`SECURITY.md`:** a line under "So that an expiry never comes as a surprise". GitHub disables scheduled workflows in a public repository after 60 days without activity, and they are re-enabled from the Actions tab.

**Out:** changing `dependabot.yml`, relaxing `subject-case` for other commits, or touching the ruleset, which the Maintainer applies.

## Acceptance criteria

- **AC1** — `npx commitlint --from <parent of 3b10c21> --to 3b10c21` passes with the new configuration (or, if Dependabot's branch no longer exists, the test with the real message as a fixture).
- **AC2** — Every positive and negative test passes; coverage of `scripts/` ≥ 95%.
- **AC3** — In the pull request's CI, the mod job shows as `mod (validate, test:mod, capabilities)`.
- **AC4** — `npm run check` green; actionlint and zizmor with no findings.

## After the merge (Reviewer and Maintainer)

1. ✅ The Maintainer applies **step 2** of the ruleset (required checks, with the new name). Applied and verified on 2026-11-20 (`docs/REPO-SETTINGS.md`).
2. The Maintainer writes `@dependabot rebase` on #8, so its CI runs with the new configuration. If it passes, it is reviewed and merged like any pull request.
   - The Reviewer was going to ask for it at first, but its GitHub tool inserted separators into the comment (`·@·d·ependabot r·ebase`) and Dependabot did not recognize it (#8, 2026-11-20). Bot commands are written by the Maintainer (`docs/WORKFLOW.md` §7).
   - **Outcome:** #8 (`@types/node` 22 → 26) passed CI but was closed by the Maintainer's decision. The types follow the oldest supported Node, and Dependabot now ignores major updates of `@types/node` (#26).

## Security constraints

- commitlint is a style control, not a security one: a person could copy Dependabot's trailer. That is why the exception requires **both** the exact pattern and the trailer.
- **Reviewer's clarification on #20:** `ignores` skips the whole commit, not just `subject-case`.
  - **Why it is accepted:** a bump can also break other rules; for example, a long subject breaks `header-max-length`.
  - **What keeps it narrow:** the double condition.
- No new dependencies; the regular expression is anchored, with no nested quantifiers.
