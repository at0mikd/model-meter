# T-009 · Review debts: measure what is drawn across the row, and test the commitlint guard

- **Status:** Done ([#22](https://github.com/at0mikd/model-meter/pull/22), `5abaade`)
- **Branch:** `fix/T-009-review-debts`
- **Plan:** `docs/PLAN.md` §3.1; the reviews of [#19](https://github.com/at0mikd/model-meter/pull/19) (finding 2) and [#20](https://github.com/at0mikd/model-meter/pull/20) (nit 2)

## Goal

The badge counts what is really drawn on its row, including when a mod beneath wraps the hint line or changes the engine's mode labels. Also, `isDependabotBump`'s type guard gets a test that tells it apart.

## Starting data

- **Hint (`PromptHint`).** Since T-003b, the hook measures the hint that the engine's link receives in `next.trace` (`drawnHintWidth`).
  - It covers the two documented ways to change the line: rewriting `hint`, or adding `tail`. It also covers a link that draws the line itself.
  - It does not cover a link beneath that calls `next(e)` and **wraps** the engine's node in a tree with more text: only the engine's hint is measured.
- **Mode labels (`SessionMode`).** The engine node's width comes from `e.props.modes`, that is, the `modes` as they **reach** model-meter (`register.tsx`, where `below` is computed).
  - If a mod beneath removes or adds labels, the engine draws different ones.
  - It is the same problem T-003b solved for the hint.
- **The contract** (CLI 2.1.327 types):
  - `next.trace` lists the links beneath, the nearest first and the engine (the pair `engine`/`core`) last;
  - `next(e)` resolves to what the links beneath draw. In `PromptHint`, without wrappers, it is the engine's opaque node, `{ type: 'engine' }` (T-003b, P1).
  - If the harness or the engine does not expose the engine's node inside a tree that wraps it, the task is marked `Blocked` and explained (`docs/WORKFLOW.md` §8).
- **commitlint.** Without the guard `typeof message !== 'string'`, `RegExp.test` converts the value to text: `undefined`, `null` and `42` still give `false`, so the mutant survives (review of #20).

## Scope

**In:**

1. **The hint, measured as drawn, wrappers included.**
   - The line's width is that of the tree `next(e)` returns. The engine's node counts as wide as the hint the engine's link received, which is what `drawnHintWidth` gives today.
   - If the result is not a recognizable tree, it is measured as today.
   - The pure logic goes in the core, for example with `widthOfTree(result, engineWidth)`, which `SessionMode` already uses.
2. **The mode labels, as drawn.** The engine node's width in `SessionMode` comes from the `modes` that the engine's link received according to `next.trace` (the pair `engine`/`core`). If the trace does not say, `e.props.modes` is used, as today.
3. **A test of the commitlint guard.** An object whose `toString()` returns a bump subject gives `false` and throws no error. Without the guard, the test fails.

**Out:**

- changing the mode label's 26-column reservation, or the order `full → noMeter → modelOnly → none`;
- mods **above**, whose changes cannot be seen from here;
- drawing anything of other mods: they are only measured.

## Acceptance criteria

- **AC1** — Core tests for measuring the line, with the core's coverage at 100%:
  - the engine's node alone;
  - the engine's node wrapped with text before and after;
  - a tree of a mod's own, without the engine's node;
  - an unrecognizable result, measured as today.
- **AC2** — Mod tests at 95 columns:
  - a mod in `append` wraps the hint line with about 10 more columns: the badge counts them and gives way (the test computes the expected variant);
  - a mod in `append` removes `focus` from the `modes`: the badge gains that room;
  - a mod in `append` adds a label: the badge gives way;
  - with no mod, everything comes out as today.
- **AC3** — The test of the commitlint guard exists, and its output with the guard removed shows that it fails.
- **AC4** — `capabilities` green, with the same `$` calls as today, and `npm run check` green.
- **AC5** — PLAN §3.1 and the mod's README say that what is drawn is measured, mode labels and wrappers included.

## Security constraints

- What comes from other mods (`next.trace` and the result of `next(e)`) is only measured, with `widthOfTree`'s bounded depth. It is never drawn or stored.
- Hooks return the result of `next(e)` untouched.
- No new dependencies.

## Required evidence

- The output of `npm run check` and `npm run capabilities`.
- The list of new tests.
- For AC3, the test's output with the guard removed.
