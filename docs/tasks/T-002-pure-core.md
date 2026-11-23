# T-002 · Pure core: model, effort, sanitization and fit by width

- **Status:** Done ([#10](https://github.com/at0mikd/model-meter/pull/10))
- **Branch:** `feat/T-002-pure-core`
- **Plan:** `docs/PLAN.md` §2.4 (decisions after T-000), §3.1, §4, §5

## Goal

Modules **without `$`** in `plugins/model-meter/hooks/core/`, fully tested with `node --test`, that turn what the engine gives into what is drawn. T-003 will only wire events and draw with them.

## Scope

**In.** Each module is `hooks/core/<name>.ts`, with its `<name>.test.ts`, in syntax Node 22 can erase (no `enum` or `namespace`):

1. **`sanitize.ts`**
   - `sanitize(text: string, max = 32): string`:
     - removes everything outside `[A-Za-z0-9.\-\[\] @/_]`, including control, ANSI/OSC, bidi and non-printable characters;
     - collapses spaces and cuts to `max`;
     - never throws.
   - A property test with `fast-check` (≥ 1,000 cases): for any input, the output only contains allowed characters and is ≤ `max` long.
2. **`model.ts`**
   - `parseModel(id: string): { family: Family, label: string }`, with `Family = 'opus' | 'sonnet' | 'haiku' | 'fable' | 'unknown'`.
   - It must recognize these forms, with a test for each:
     - current ids: `claude-opus-5-5` → `OPUS 5.5`; `claude-fable-5-2` → `FABLE 5.2`;
     - a context suffix: `claude-sonnet-5-5[1m]` → `SONNET 5.5 1M`;
     - dated ids: `claude-opus-4-1-20250805` → `OPUS 4.1`;
     - the old format: `claude-3-5-sonnet-20241022` → `SONNET 3.5`;
     - Bedrock (`us.anthropic.claude-opus-4-1-20250805-v1:0`) and Vertex (`claude-opus-4-1@20250805`);
     - bare aliases (`opus`, `sonnet`, `haiku`, `fable`) → the family, without a version.
   - Anything else → `unknown`, with the label sanitized and uppercased (≤ 16).
   - T-003 later changed the case: see its decisions.
3. **`effort.ts`**
   - `type Level = 'low' | 'medium' | 'high' | 'xhigh' | 'max'`; `LEVELS` frozen.
   - `parseLevel(value: unknown): Level | undefined`: an exact allowlist, case-insensitive, after `trim`.
   - `parseEffortArg(args: string): Level | undefined`: what was typed after `/effort` (`'high'` → `high`; `''` or anything else → `undefined`). It never returns the user's text.
   - `effortCells(level: Level): 1|2|3|4|5` (from `low` = 1 to `max` = 5) and `effortLabel(level)`: `LOW`, `MED`, `HIGH`, `XHI`, `MAX`.
   - A numeric effort (internal builds only): `{ label: 'CUSTOM', cells: null }`. No scale is invented.
4. **`state.ts`**
   - `effortState({ step, stored, pending }): EffortView`, with `EffortView = { level?: Level, custom?: boolean, source: 'step' | 'stored' | 'pending' | 'unknown' }`, following PLAN §2.4:
     - `pending` (after `/effort`) wins: it shows the level from `args` if valid, otherwise the last known one;
     - otherwise `step` (the last `turn.step`);
     - otherwise `stored` (the value from `$.store`, validated with `parseLevel`);
     - otherwise `unknown`.
   - A corrupt `stored`, or one of an unexpected type, gives `unknown` and never throws.
5. **`layout.ts`**
   - `widthOf(text)`: the columns of sanitized text plus our glyphs (`◆ ▮ ▯ …`), ignoring variation selectors.
   - `fitBadge({ columns, reserved, variants }): Variant | 'none'`:
     - it picks the first variant that fits in `columns − reserved`, in this order: `full` → `noMeter` → `modelOnly` → `none`;
     - `reserved` gathers the margins, the mode label, the hints' width and what lies beneath (PLAN §3.1).
   - Tests at 95 and 191 columns, with the hints `''`, `1 shell · ↓ to manage` and `esc to interrupt`, with and without a 30-column node beneath.

**Out:** any hook, any use of `$` or `claude-code` (that is T-003), and sprites (T-004).

> **Deviation accepted by the Reviewer (2026-11-18).** With engine 2.1.327, two things break:
>
> - a `node:test` test inside `plugins/model-meter/hooks/` breaks `claude plugin validate --strict` (TS2591: the engine's tsconfig includes all of `hooks/` and has no Node types) and `claude plugin test` (which loads every `*.test.ts` of the plugin);
> - a value import `./x.ts` between modules fails in `validate --strict` (TS5097), and `./x.js` fails in Node.
>
> Therefore:
>
> - the modules stay in `plugins/model-meter/hooks/core/<name>.ts`, and always import values from each other as `./x.js` (`import type` with `.ts` works too);
> - their tests live in **`test/core/<name>.test.ts`**, outside the plugin: `node --test` sees them, `claude plugin test` never does;
> - `test/resolve-ts.mjs` (with its own tests) maps `./x.js` → `./x.ts` when all of these hold: the importer is under `hooks/core/`, the target stays in `hooks/core/`, the `.js` does not exist and the `.ts` does;
> - `engines.node` becomes `>=22.15` (`module.registerHooks`), for development only;
> - coverage is still measured on `hooks/core/` (≥ 95%).

## Acceptance criteria

- **AC1** — The five modules exist with the signatures above, and none imports `claude-code` or `node:*` (checked by a test that reads the files).
- **AC2** — A test for each model id form in the list, and for each row of `effortState`'s cascade.
- **AC3** — Property tests of `sanitize`, `parseModel` and `parseEffortArg` (≥ 1,000 cases each): they never throw, and their output is an allowlisted value or sanitized text.
- **AC4** — `npm run check` green; coverage ≥ 95% of lines and branches in `hooks/core/`.
- **AC5** — `claude plugin validate --strict plugins/model-meter` stays green, and `capabilities` does not change: the core adds no `$` calls.

## Security constraints

- No new dependencies (`fast-check` is already allowed).
- No core function returns the user's or the engine's text without going through `sanitize` or an allowlist.

## Required evidence

The output of `npm run check` (with the coverage of `hooks/core/`) and the list of tests.
