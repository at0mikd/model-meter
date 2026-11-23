# T-004 · 8-bit band above the prompt, and `auto` placement

- **Status:** Done ([#24](https://github.com/at0mikd/model-meter/pull/24), `aa60f67`; the sprites and label were later replaced by T-010)
- **Branch:** `feat/T-004-band-auto`
- **Plan:** `docs/PLAN.md` §3.2, §3.3 (`placement`, `autoMinColumns`), §3.4 and §5

## Goal

At full screen, model-meter can also show an **8-bit band** above the prompt (`AbovePrompt`): an original sprite for the model's family, and a label with the model and the effort. The `placement` option decides when it shows:

- `footer` (the default): the footer only, as today;
- `auto`: the footer, plus the band while the terminal is wide;
- `band`: the footer, plus the band whenever it fits.

The compact footer of T-003, T-003b and T-009 **does not change**.

## Starting data

- **The `AbovePrompt` contract** (CLI 2.1.327 types):
  - it is asked once for each plugin that hooks it, with `e.plugin` naming the plugin; a hook draws its own plugin's row, or passes;
  - read-only props:
    - `hasSurvey`: a survey holds the band, so the mod must yield to it;
    - `isCollapsed`: the person folded the band; the tree is returned anyway;
    - `isWorking`;
    - `maxRows`;
    - `bodyColumns`: usable cells, with the 5 of the `[-]` already subtracted;
  - a row that does not validate, or exceeds the tree's limits, draws nothing;
  - on the terminal, a tree that throws empties the band.
- **T-000's measurements:**
  - `bodyColumns` = `columns − 5`: 90 at half screen and 186 maximized;
  - `maxRows` = 47 with an empty session and 18 in use;
  - when the window's width changes, `SessionMode` and `AbovePrompt` are redrawn.
- **The plugin's options:** declared in `plugin.json`'s `userConfig`, as `sub-meter` does, and passed to `register(on, options)`. They are untrusted input, so they are validated.
- **The Maintainer's decision (AC7 of T-003):** text in lowercase; only the model's name starts with a capital (`Opus 5.5`).

## Scope

**In:**

1. **Options** in `plugin.json` (`userConfig`):
   - `placement`: `footer` | `auto` | `band`, `footer` by default;
   - `autoMinColumns`: a number, `140` by default, from 80 to 400.

   A pure core function validates them: a value off the list or out of range takes the default, without throwing.
2. **The band's visibility,** as a pure core function with hysteresis, so it does not flicker on resize:
   - with `footer`, never;
   - with `band`, whenever it fits;
   - with `auto`, it enters at `columns ≥ autoMinColumns` and leaves at `columns < autoMinColumns − 20`; between the two thresholds it keeps what it had;
   - in every case, only if `maxRows ≥ 6` and there is no survey (`hasSurvey`).
3. **Sprites,** as pure core data: one per family (Opus, Sonnet, Haiku, Fable and unknown).
   - **Original design,** with no resemblance to existing characters or artwork.
   - At most 4 rows by 8 columns, in half blocks (`▀ ▄ █` and space).
   - The same size for all.
   - Painted with the family's color key (`familyColor`).
   - In the "off" state (§3.1.1), the unknown sprite, dimmed.
4. **The band's label,** to the right of the sprite, lowercase except the model. For example, `player Opus 5.5` and `power ▮▮▮▯▯ high` (T-010 later changed `player` to `model`).
   - It uses the same sanitized core parts as the footer (`badgeState`, `badgeRuns` or equivalent).
   - It fits `bodyColumns` in this order: first the meter goes, then the effort label, and finally only the sprite is left. If not even the sprite fits, the band is not drawn.
5. **The `ui.render { component: 'AbovePrompt' }` hook** in `register.tsx`, which only wires:
   - it draws only when `e.plugin === 'model-meter'` and the surface is the terminal; with any other plugin or surface, `return next(e)`;
   - if the band must not show, it passes (`next(e)`);
   - the hysteresis state lives in the module's closure, like `hintColumns`;
   - it adds no `$` calls.

**Out:**

- palettes (`palette`) and `showEffortMeter`, which belong to another task;
- `desktop` and `mobile`, where the mod still draws nothing;
- any change to the footer, its room computation, or `$.store`;
- animations or timers.

## Acceptance criteria

- **AC1** — Core tests of the options' validation: valid values, values off the list, out of range, values that are neither numbers nor text, and `undefined`.
- **AC2** — Core tests of the visibility, as a table:
  - `footer`, `band` and `auto` at 95, 119, 120, 139, 140 and 191 columns, coming from a visible band and from a hidden one;
  - `maxRows` 5 against 6;
  - `hasSurvey`.
- **AC3** — Core tests of the sprites:
  - the same size for every family, at most 4×8;
  - only the allowed glyphs;
  - all five different from each other;
  - the dimmed sprite in the `disabled` state.
- **AC4** — Mod tests of the band:
  - it draws with `e.plugin` equal to `model-meter`, and passes with another plugin or with `desktop`;
  - it yields with `hasSurvey`;
  - with `auto`, going from 191 to 130 columns keeps it, from 130 to 110 removes it, and from 110 to 191 brings it back;
  - with `footer`, it never draws;
  - it fits `bodyColumns` in the order of scope item 4.
- **AC5** — The footer's 46 mod tests stay green and unchanged. `capabilities` green, with the same `$` calls as today. `npm run check` green.
- **AC6** — Documentation:
  - PLAN §3.2, with the label in lowercase, and §3.3–§3.4 up to date with what was implemented;
  - the mod's README, with the options and a text sample of the band;
  - the CHANGELOG.
- **AC7** — Screenshots by the Maintainer, with the mod installed from the marketplace and `placement: auto`:
  - maximized (about 190 columns), with the band visible;
  - at half screen (about 95), with no band and the footer as today.

  The Maintainer approves the look of the sprites.

## Security constraints

- The `userConfig` options are untrusted input: they are validated against a closed list and a range, and never drawn verbatim.
- The label only draws text the core has already sanitized. The sprites are constants in the code.
- No new `$` calls: the allowlist does not change.
- No new dependencies.
- An error inside the hook never leaves the band empty for other plugins: the hook only draws model-meter's own row, and if it fails, it passes.

## Required evidence

- The output of `npm run check` and of `claude plugin validate`, with the capabilities.
- The tables of AC2's tests.
- A text sample of the band at 186 and at 90 cells.
- The AC7 screenshots.
