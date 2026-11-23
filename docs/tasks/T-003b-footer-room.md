# T-003b · Real room in the footer: the badge at half screen next to `sub-meter`

- **Status:** Done ([#19](https://github.com/at0mikd/model-meter/pull/19), `872bfc8`)
- **Branch:** `fix/T-003b-footer-room`
- **Plan:** `docs/PLAN.md` §3.1; AC7 of T-003 ([#12](https://github.com/at0mikd/model-meter/pull/12#issuecomment-7005912032))

## Goal

At half screen (about 95 columns), the badge shows whenever there really is room, without ever covering or wrapping the footer again. This is the Maintainer's main use.

## Starting data (AC7 of T-003)

- **The symptom:** at rest, with `sub-meter` and `auto mode on`, about **41 columns are visibly free**, and `full` needs **27** (a 24-wide slot plus the separator). Even so, the badge **does not show**. It only appears while typing, as `modelOnly`.
- **The cause:** the computation reserves too much, for two reasons:
  1. **The raw hint.** The `PromptHint` hook measures `e.props.hint` as it arrives, with `(shift+tab to cycle)`. But `sub-meter` hides that part (`hideCycleHint`), so on screen it is about 23 columns shorter.
  2. **A pessimistic mode label.** 26 columns are reserved (`⏵⏵ bypass permissions on ·`), even when the real label is shorter (`⏵⏵ auto mode on ·`, about 17) or there is none.

## Phase 1 · Measure (without changing the mod's behavior)

Measure with the spike (`spikes/wic-spike`, throwaway, allowed to add observations but no capabilities beyond those it uses), or with a local build that is never pushed. Answer with data, as in T-000:

- **P1 · What our hook sees in `PromptHint`** with `sub-meter` active.
  - Does it get the raw hint or the trimmed one?
  - What does `next(e)` return: an opaque engine node (`{ type: 'engine' }`) or a tree with the text?
  - **A hypothesis to confirm:** `e.props.hint` does **not** include the mode label. It is the only way AC7's screenshot 9 adds up (typing, ~95 columns, `modelOnly` shows): if it included it, the reservation would be 4 + 26 + 35 + 2 + 29 = 96 > 95, and nothing would show.
- **P2 · The order of hooks across plugins.**
  - **What the types say** (`TIERS`, `Tier`, `EngineCreateInput`):
    - there are five fixed tiers, from outermost inwards: `prepend → user → append → builtin → core`;
    - a plugin does not choose its tier;
    - within a tier, modules chain "in list order, first outermost", with no documentation of how that list is ordered in `user`;
    - without managed settings, the person can move their own plugins to `prepend`/`append` with `prependPlugins`/`appendPlugins` in their user settings.
  - **What to measure:**
    - the order with `--plugin-dir` (`model-meter@inline`, as in AC7, where `model-meter` ended up outside `sub-meter`) **against** an install from the marketplace (`model-meter@model-meter`), which is how people will use it;
    - whether the order is stable across sessions, after `/reload-plugins` and after reinstalling;
    - the effect of listing either one in `prependPlugins`/`appendPlugins`.
- **P3 · `permission_mode`.**
  - **What the types say:**
    - it only exists in classic events (`BaseHookInput.permission_mode`), and in a subagent spawn's `permissionMode`;
    - no mod event announces a change of mode;
    - `config.set` is only for `/config` rows;
    - `SessionMode`'s props do not carry the permission mode.
  - **What to measure:**
    - which classic events carry it, and when they arrive: session start, every prompt, every tool;
    - whether any arrives when the mode changes with shift+tab;
    - the **real shift+tab cycle** in the version and settings tested: `bypassPermissions` only appears with `allowDangerouslySkipPermissions`, and `auto` only when it is on;
    - how wide each mode's label is on screen.
- **P4 · Overflow.** If `SessionMode`'s tree does not fit, what does the engine do: trim the hint on the left, trim our tree, or wrap the row? Try it **only** in a local build forcing a wide badge, never in the pull request.

Results go in `docs/spikes/T-003b-results.md`: a table per question, the CLI version, the terminal, and sanitized JSON if any.

## Phase 2 · Implement according to the data

- **Hint:** measure what is drawn, not `e.props.hint`.
  - If `next(e)` returns measurable text, measure that tree.
  - If it is opaque, propose in the pull request the alternative that P1 and P2 allow, with its risks.
  - No hint of the engine or of another mod is hidden, trimmed or rewritten.
- **Mode label:** reserve the real mode's width from `permission_mode`, with a **closed table** of widths per mode.
  - An unknown or absent mode reserves today's 26 columns.
  - If P3 confirms that a shift+tab change is not seen until the next classic event, reserve the maximum of the cycle's modes until it arrives.
  - If the cycle includes `bypassPermissions`, that maximum is 26 again: document it and propose another solution in the pull request.
  - `permission_mode` is never drawn: it only picks a row of the table.
- **Order-independent:** the computation must be right whether `model-meter` ends up above or beneath `sub-meter` (P2). If, in some order, there is no way to know which hint is drawn, reserve as today in that case.
- **What stays:** the order `full → noMeter → modelOnly → none`, and the footer is **never** covered or wrapped.
- **If P4 shows that the engine trims the hint without wrapping the row,** document it and propose a less pessimistic computation in the pull request. Do not implement it without the Reviewer's approval.

## Acceptance criteria

- **AC1** — P1–P4 answered with data in `docs/spikes/T-003b-results.md`.
- **AC2** — Mod tests:
  - with the raw hint against the trimmed one;
  - with each `permission_mode` of the table, and with an unknown one (which reserves 26);
  - at 95 and 191 columns, with and without a 30-column node beneath.
- **AC3** — Screenshots by the Maintainer on the pull request, with `model-meter` **installed from the marketplace** (as people will use it; `--plugin-dir` only for comparison), at about 95 columns with `sub-meter`:
  - at rest with `auto mode on`, the badge shows **in full**;
  - with `1 shell · ↓ to manage`, the variant that fits shows (or none), **without covering or wrapping** the footer;
  - after changing mode with shift+tab (to a longer one and a shorter one), it does not cover or wrap either.
- **AC4** — `capabilities` green **without widening the call allowlist**. Any new hook (for example, a classic event to read `permission_mode`) only observes, returns `next(e)` untouched, and, if it can block an event, carries a `.catch` that lets it through.
- **AC5** — `npm run check` green, with core coverage ≥ 95%.

## Security constraints

- `permission_mode` and the hint are engine data: they are only measured or compared against an allowlist. They are never drawn or kept in `$.store`.
- No new dependencies.

## Required evidence

`docs/spikes/T-003b-results.md`, the output of `npm run check` and `npm run capabilities`, and the AC3 screenshots.

## Outcome

- **Reviewer's decisions after phase 1:**
  - the mode label keeps its 26 columns: shift+tab emits no event, and an overflow wraps the footer;
  - the hint is measured as the engine's own link received it, from `next.trace`.
- **Result:** the badge shows in full at half screen next to `sub-meter` (#19).
