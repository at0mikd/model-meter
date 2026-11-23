# T-003 · Compact mode in the footer (`SessionMode`)

- **Status:** Done ([#12](https://github.com/at0mikd/model-meter/pull/12); the room at half screen continues in T-003b)
- **Branch:** `feat/T-003-compact-footer`
- **Plan:** `docs/PLAN.md` §2.4 (decisions 1–6), §3.1, §5, §6

## Goal

The first usable version of the mod: `◆ Opus 5.5 ▮▮▯▯▯ med` in the terminal footer.

- It shares the row with other mods (`sub-meter`) and with the engine's hints.
- It updates live with `/model`, `/effort` and every turn.
- All the decision logic comes from `hooks/core/` (T-002); `register.tsx` only wires events and draws.

> **Maintainer's decision (2026-11-18): `$.state` bounded to `model-meter`.**
>
> - **The problem:** the atoms of item 7 are `$.state`, and `claude plugin validate` counts them as `state.get`/`state.set`, outside AC6's allowlist.
> - **Option B is accepted:** the allowlist adds `state.get` and `state.set`, nothing else.
> - **`check-capabilities` fails when:**
>   - any entry of `uses.state` (reads and writes) is not `plugin: 'model-meter'`;
>   - its key is not declared in `types/index.d.ts` under `PluginState['model-meter']`;
>   - `uses.state` has an unexpected shape.
> - **The contract** declares exactly the keys the mod uses. `$.store` only keeps `effort` (a `Level`).

> **Maintainer's decision (2026-11-19, in AC7): everything lowercase.** In the terminal every letter takes one cell, but capitals made the badge look bigger than the rest of the footer (`auto mode on`, `week`, `context`). The model's name and the effort label go lowercase: `◆ opus 5.5 ▮▮▮▮▯ xhi`, `sonnet 5.5 1m`, `custom`. The widths do not change.
>
> **Maintainer's adjustment (2026-11-19, after AC7): the model's name starts with a capital,** as Claude Code writes it (`Set model to Opus 5.5`): `◆ Opus 5.5 ▮▮▮▮▯ xhi`, `Sonnet 5.5 1m`. Everything else stays lowercase, including the id of an unknown model (`gpt-x`). The widths do not change.

## Scope

**In:**

1. **Surface.** It only draws when `e.surface === 'terminal'`. On `desktop`, `vscode` and `mobile` it returns `next(e)` unchanged: the app already shows the model and effort, and duplicating them adds nothing.
2. **Imports.** `register.tsx` imports the core as `./core/<name>.js`, the form that `validate --strict` and `claude plugin test` accept (see T-002's deviation). The mod's tests are still only `hooks/register.test.tsx`.
3. **Hooks.** They all observe, and return what `next(e)` gives, unchanged:
   - `session.start`: `isInteractive`; `$.session.model()` → state; `$.store.get('effort')` → `stored`, validated with `parseLevel`.
   - `classic.SessionStart` with `source === 'clear'`: the same as `session.start` (the model may carry on; the turn does not).
   - `turn.step`: an **async generator** with `return yield* next(e)`.
     - Only when `e.agentId === undefined`: it keeps `e.model` and `e.effort` in the state, and clears `pending`.
     - If `parseLevel(e.effort)` gives a level: `$.store.set('effort', level)`. Only that allowlisted value is stored, never any other text.
   - `config.set` with `key === 'model'`: refreshes with `$.session.model()`.
   - `command.run` with `{ command: 'effort' }`: `pending = { args: e.args }`. The text is interpreted by `effortState`, which never returns the user's text.
   - `ui.render` `{ component: 'PromptHint' }`: it only measures `widthOf(e.props.hint)` and keeps the width; if it changes, it calls `$.ui.invalidate('ui.render')`. It returns `next(e)` untouched: it does not hide, trim or rewrite hints.
   - `ui.render` `{ component: 'SessionMode' }`: draws the badge and then what `next(e)` returns, with a ` · ` separator only when something lies beneath.
4. **Points that can block an event** (`config.set`, `command.run`):
   - the body runs in `try/catch` and always returns `next(e)`;
   - each hook carries `.catch(($, e, next) => next(e))` (PLAN §2.4, decision 6). `capabilities` already rejects any such hook without `.catch`.
5. **Fit by width,** with the core's `fitBadge`:
   - `reserved` = the footer's margins + the mode label (`e.props.modes`) + the measured width of the hints + the width of what `next(e)` returns;
   - a render tree's width comes from a new **pure** helper in `hooks/core/layout.ts` (`widthOfTree`), with its own structural type, never importing `claude-code`, and tests in `test/core/`;
   - with `none`, only what lies beneath is returned.
6. **Presentation:**
   - **A known family:** `◆` and the label in the family's color, through theme keys (never raw ANSI).
   - **`unknown`:** `? ` and the label dimmed, so it is not mistaken for a known model (a comment from the review of #10).
   - **The meter:** filled `▮` in color, empty `▯` dimmed. `custom` has no meter.
   - **States** by `source`: `stored` dimmed; `pending` dimmed with `…` at the end; `unknown` as `?`.

   6b. **The 8-bit "off" state** (PLAN §3.1.1, the Maintainer's request). A new **pure** function `badgeState({ model, effort })` in `hooks/core/badge.ts`, with tests in `test/core/badge.test.ts`:
   - it takes the output of `parseModel` (or `null` if the model has not been read yet) and that of `effortState`;
   - it returns `{ state: 'active' | 'partial' | 'disabled', model: { enabled, text }, effort: { enabled, cells, text } }`, with the glyphs of the §3.1.1 table (`◆`/`◇`, `▮▯`/`░`, `---`);
   - the three variants (`full`, `noMeter`, `modelOnly`) are as wide when active as when off, so the badge does not jump when it lights up;
   - the render paints the parts with `enabled: false` in the theme's dim color.
7. **State:** atoms with a contract in `types/index.d.ts`:
   - `model: string | null`;
   - `step: unknown`, validated on read;
   - `pending: { args: string } | null`;
   - `hintWidth: number`.

   `$.store` only keeps `effort` (a `Level`).
8. **The plugin's README:** what it shows, how to install it, and "How to try it". It includes the warning that `/model` and `/effort` change the user's defaults (T-000, finding 7), and what data the mod keeps: only the last effort level.

**Out:**

- the 8-bit band and `auto` mode (T-004);
- `userConfig` (T-005);
- widening the capability allowlist.

## Acceptance criteria

- **AC1** — Mod tests on `terminal`:
  - with `session.start`, the badge shows the model and the previous effort dimmed (or `?`);
  - a main-thread `turn.step` updates it, and one with `agentId` does not;
  - the model's `config.set` refreshes it;
  - `/effort high` shows it as pending;
  - a later `turn.step` confirms it.
- **AC1b** — The off state, tested from the start:
  - pure tests of `badgeState` for **every** combination of model (known, `unknown`, `null`) × effort (`step`, `pending`, `stored`, `unknown`, `CUSTOM`), with each part's glyph, text and `enabled`;
  - a width test: the active and off variants are equally wide;
  - a mod test:
    - the **first** badge of a session with no previous effort comes out `partial` (effort off), and turns `active` with the first `turn.step`;
    - with the model not yet read and no effort, it comes out `disabled`.
- **AC2** — On `desktop`, the output is exactly the engine's (`next(e)`), proved by a test.
- **AC3** — Tests that `/model` and `/effort` reach what lies beneath untouched, even when the inner logic throws (injected in the test).
- **AC4** — Degradation tests:
  - at 95 and 191 columns, with the hints `''`, `1 shell · ↓ to manage` and `esc to interrupt`, with and without a 30-column node beneath;
  - the order `full` → `noMeter` → `modelOnly` → `none` holds, and what lies beneath is never lost.
- **AC5** — `$.store` only receives values from `LEVELS`; a corrupt `stored` gives `?` (test).
- **AC6** — `npm run check` green, `capabilities` green **without widening the allowlist**, and `validate --strict` green.
- **AC7** — A manual test by the Maintainer in their terminal, with screenshots on the pull request:
  - next to `sub-meter`, at half screen and maximized;
  - with a background shell (`1 shell · ↓ to manage`);
  - after `/model` and `/effort`;
  - **the off state:** a new session before the first turn, after deleting the mod's stored value, or in a clean install.

## Security constraints

- No text from the engine or the user is drawn without going through `sanitize`, `parseModel` or the allowlist of levels.
- No hook rewrites, blocks or delays an engine event.
- No new dependencies.

## Required evidence

The output of `npm run check` and `npm run capabilities`, the list of mod tests, and the AC7 screenshots.
