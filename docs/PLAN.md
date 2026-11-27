# model-meter — Implementation plan

> A Claude Code mod that shows **which model and effort level** the session is using, in **8-bit** style.
> Status: phases 0–4 done, phase 5 optional, phase 6 (v0.1.0) in progress · Engine version analyzed: Claude Code `2.1.327`

---

## 1. Executive summary

| Decision | Choice | Reason |
| --- | --- | --- |
| Kind of extension | **Mod** (a plugin of function hooks, TSX) | It draws in the native UI (terminal, desktop, mobile) without running external processes. Same pattern as `sub-meter`. |
| Source of the model | `$.session.model()` plus `e.model` from `turn.step` | The official API. `turn.step` reflects the model *actually sent*, fallbacks included. |
| Source of the effort | `e.effort` from `turn.step` (main thread only) | The effective level after limits (`maxEffortLevel`, the model's capabilities). |
| Place in the UI | **Compact** in the footer (`SessionMode`) by default; an optional **large mode** (`AbovePrompt`) and an **`auto`** mode by width | Built for using Claude Code at half screen; it lives alongside `sub-meter` (§3.4). |
| Repository visibility | **Public** | Extra controls in §6.1. |
| Name | **`model-meter`** for the plugin, the marketplace and the repository | Claude Code 2.1.327 rejects the name `who-is-claude` in `validate --strict` ("reads as one of Anthropic's own"), and `--strict` is the hooks' type gate. The Maintainer chose a single name across the project, consistent with `sub-meter`, `context-meter` and `token-meter`. |
| Methodology | **Spec-driven + TDD** within a light **SSDF (NIST SP 800-218)** | Verifiable quality and security by design. |
| Attack surface | **No capabilities beyond the allowlist**: no `$.fs`, `$.process`, `$.model`, network or tools | A visual indicator needs nothing more; CI checks it. |

---

## 2. Research findings

### 2.1 How the reference mod is built (`midudev/better-claude/plugins/sub-meter`)

- **Layout:**
  - `.claude-plugin/plugin.json`;
  - `hooks/hooks.json` → `{ "modules": ["./register.tsx"] }`;
  - `hooks/register.tsx` and `hooks/register.test.tsx`;
  - `types/index.d.ts` (the `$.state` contract);
  - a `tsconfig.json` that extends `./.claude-plugin/types/tsconfig.json`.
- **User options:** through `userConfig` in `plugin.json`; they show in `/config`.
- **Drawing:** it draws in `ui.render` on `{ component: 'SessionMode' }` (the footer, bottom right), **composing** with what lies beneath (`next(e)`) and adapting to the width (`e.viewport.columns`).
- **State:** reactive with `atom` / `read` / `update`; persisted across sessions with `$.store`.
- **CI** (`.github/workflows/test.yml`): `claude plugin validate`, `claude plugin test`, and a Node 22/24 × 3 OS matrix.

Source: <https://github.com/midudev/better-claude/tree/main/plugins/sub-meter>

### 2.2 Relevant API (the engine's types, `claude-code.d.ts`)

| Need | API | Notes |
| --- | --- | --- |
| Current model | `$.session.model(): Promise<string>` | "the main loop's model, as `/model` shows it". |
| Effective model and effort | `on('turn.step', …)` → `e.model`, `e.effort` | `effort?: 'low'\|'medium'\|'high'\|'xhigh'\|'max'\|number`; absent if the model does not support effort or `CLAUDE_CODE_EFFORT_LEVEL=auto/unset`. Filter `e.agentId === undefined` (ignore subagents). It is *streaming*: **observe only** and return `next(e)` untouched. |
| Session start and end | `session.start`, `session.end`, `classic.SessionStart` (`source: 'clear'`) | As `sub-meter` does. |
| The UI footer | `ui.render` `{ component: 'SessionMode' }` | Props `modes`; compose with `next(e)`. |
| The band above the prompt | `ui.render` `{ component: 'AbovePrompt' }` | For the "large" mode (the 8-bit sprite). |
| Surface | `e.surface`: `terminal` \| `desktop` \| `vscode` \| `mobile` | Elements through `$.ui.resolve(e)`. |

### 2.3 Rejected alternative: the classic `statusLine`

`settings.json → statusLine.command` receives JSON with `model` and `effort.level` on stdin.

**Rejected** as the main path:

- it runs a shell process, a larger attack surface;
- it only works in the terminal;
- it replaces whatever status line the user already has.

Source: <https://code.claude.com/docs/en/statusline>

### 2.4 Unknowns resolved with spikes (phase 0)

1. **Effort before the first turn:** `turn.step` has not happened yet.
2. **Changes with `/model` or `/effort` between turns:** is there an event to refresh without waiting for the next turn?
3. **Real width** available next to `sub-meter` in the footer.

**Spike results (2026-11-18, cloud session, CLI 2.1.327):**

| Source | Result |
| --- | --- |
| `$.session.model()` in `session.start` | `claude-opus-5-5` ✅ available from the start |
| `turn.step` (main thread) | `model: claude-opus-5-5`, `effort: "medium"` ✅ matches the UI |
| `$.settings.read({ key: 'effortLevel' })` | `undefined` (not set in this session) |
| `CLAUDE_CODE_EFFORT_LEVEL` / `CLAUDE_EFFORT` | `undefined` (not defined in the engine's process) |
| `SessionMode` / `AbovePrompt` renders | Not fired: the cloud session seen from the app does not draw that footer → validate in a local terminal |

**T-000 results in a terminal** (`docs/spikes/T-000-results.md`, Fedora + Ghostty, CLI 2.1.327):

| Question | Result |
| --- | --- |
| `/model` between turns | `command.run` plus `config.set { key: "model", value: <alias>, previous }` **before** the next `turn.step`; `$.session.model()` already returns the new id |
| `/effort` between turns | Only `command.run`, no `config.set`. The new level is known at the next `turn.step` |
| `settings.effortLevel` | **Not reliable**: it reads `medium` while the effective effort is `xhigh`/`high`; `/effort` stores its value elsewhere |
| Environment variables | `CLAUDE_CODE_EFFORT_LEVEL` and `CLAUDE_EFFORT` empty |
| Viewport | 95×47 at half screen, 191×47 maximized; `bodyColumns = columns − 5`; `maxRows` 18 in use |
| `isFullscreen` | `true` with the fullscreen renderer (at any width), `false` with the classic one |

**Decisions in force:**

1. **Effort before the first `turn.step`:**
   - the last value from `$.store`, dimmed and marked as previous; if there is none, the "off" look;
   - settings and environment variables are not read: `$.settings.read` and `$.env.get` **are not in the allowlist**.
2. **`/model`:** an observe-only `config.set` hook with `key === "model"` refreshes at once with `$.session.model()`.
3. **`/effort`:** `on('command.run', { command: 'effort' }, …)`, observe only.
   - **What the event carries:** `command` arrives without the slash and with aliases resolved; `args` is what was typed after the name; the event arrives **before** the command runs.
   - Empty `args` (the interactive picker) → **pending**, with the last known value.
   - `args` that is a valid level (`/effort high`) → **pending**, showing that level.
   - In both cases the next `turn.step` confirms or corrects it: the command may fail, or the model may cap the level.
   - `args` goes through sanitization and an allowlist of levels; any other value is ignored.
4. **`sub-meter`'s own width:** measured in the product, on the node that `next(e)` returns in `SessionMode`, with degradation tests by width.
5. **Testing the mod with `/model` or `/effort` changes the user's default:** the mod's README warns about it ("How to try it").
6. **Hooks at points that can block an event** (`config.set`, `command.run`, `prompt.submit`) are observers and must **always let the event through**.
   - **The risk:** a hook that throws there is skipped and the event goes on. But a hook that returns **without** calling `next(e)` keeps the event, and would cancel the user's `/model` or `/effort`.
   - **The controls:**
     - the body runs in `try/catch` and always ends in `return next(e)`;
     - each hook has an explicit `.catch` that lets the event through (`($, e, next) => next(e)`), so failing open is a written decision;
     - tests prove that the command reaches what lies beneath untouched, even when the inner logic throws;
     - `check-capabilities` fails if `validate --json` lists a `gatingHooks` entry without `.catch`.

The `wic-spike` spike (`spikes/`) records these events and renders, and exposes what it observed through a read-only tool.

---

## 3. Functional design

### 3.1 Compact mode (footer, the default)

```text
◆ Opus 5.5 ▮▮▯▯▯ med · ⏵⏵ auto mode on
```

- **The model's name**, normalized: `claude-opus-5-5` → `Opus 5.5`; the suffix `[1m]` → `1m`.
- **Lowercase,** like the rest of the footer: the labels are `low`, `med`, `high`, `xhi` and `max`.
  - Only the model's name starts with a capital, as Claude Code writes it: `Opus`, `Sonnet`, `Haiku`, `Fable`, `Mythos`.
  - The Maintainer decided this in T-003's AC7 (2026-11-19).
- **Effort meter of 5 "pixels":** `low = 1 … max = 5`; a numeric effort shows as `custom`, without a meter.
- **Color:** a retro color per family, with theme keys (`claude`, `warning`, `success`…), never raw ANSI.
- **Degradation by width:** full → no meter → model only → nothing (as `sub-meter` does).
- **The available room is not fixed.** The footer shares its row with the permission mode's label (`⏵⏵ auto mode on`) and with the hint line (`PromptHint`). That line grows with transient indicators: `1 shell · ↓ to manage` with a background shell, `esc to interrupt` while Claude works, `(shift+tab to cycle)`, and so on (observed by the Maintainer, 2026-11-18). So:
  - **Measure the hint, never change it.** The mod watches `ui.render { component: 'PromptHint' }` **only to measure** the hint. It returns `next(e)` untouched, so it never hides or rewrites the engine's hints.
  - **Measure the line as drawn,** not `e.props.hint`: the tree that `next(e)` returns, with the engine's node as wide as the hint the engine's own link received, according to `next.trace`.
    - A mod that trims the hint on the way counts, above or beneath (`sub-meter` hides `(shift+tab to cycle)`; T-003b, `docs/spikes/T-003b-results.md`).
    - So does a mod beneath that wraps the line with more text (T-009).
  - **Redraw at once:** when the width changes, the mod asks for a redraw (`$.ui.invalidate('ui.render')`), so the footer is recomputed without waiting for another event.
  - **The room** is `columns − margins − mode label − hint width − what next(e) returns` (for example `sub-meter`), and the badge degrades in that order.
    - In what `next(e)` returns, the engine's node counts with the mode labels (`focus`…) that the engine's own link received according to `next.trace`, not with `e.props.modes`: a mod beneath may remove or add one (T-009).
  - **Tests:** degradation with hints of different widths (empty, `1 shell · ↓ to manage`, `esc to interrupt`), at 95 and 191 columns, with and without a node beneath.

### 3.1.1 The 8-bit "off" state (Maintainer's request, 2026-11-18)

When information is missing, the badge neither disappears nor makes up data: it looks **switched off**, like an empty cartridge slot. It applies part by part, without changing the badge's width, so nothing jumps when it lights up:

| Model | Effort | Look (`full`) | State |
| --- | --- | --- | --- |
| known | from `turn.step`, or pending | `◆ Opus 5.5 ▮▮▯▯▯ med` | `active` |
| known | previous (`$.store`) | `◆ Opus 5.5` + `▮▮▯▯▯ med` dimmed | `partial` |
| known | unknown | `◆ Opus 5.5` + `░░░░░ ---` off | `partial` |
| unknown, or not read yet | known | `◇ ?` + `▮▮▯▯▯ med` | `partial` |
| unknown | unknown | `◇ ----- ░░░░░ ---` all off | `disabled` |

- **"Off" glyphs:** a hollow diamond `◇` instead of `◆`, cells `░` instead of `▮▯`, and dashes `---`, all in the theme's dim color, never raw ANSI.
- **When it is common:** when a session opens before the first turn (with no stored effort), and in the instant before `$.session.model()` answers.
- **Where it is decided:** in the pure logic (`badgeState` in `hooks/core/`), so every combination is tested.

### 3.2 Large mode (optional, `AbovePrompt`)

An 8-bit sprite per family (Opus, Sonnet, Haiku, Fable, Mythos, unknown) plus a label, lowercase except the model's name: `model Opus 5.5` · `power ▮▮▮▯▯ high`. Original design: no existing character or artwork is reproduced.

- **History:** the band, its options and its fit to the width came in T-004. The current sprites and label came in T-010 (Maintainer's decisions, 2026-11-21), replacing T-004's single-color 4×8 sprites.
- **How it looks with Opus** (on the terminal, each cell carries its own colors):

```text
 ▄▄▄▄▄▄▄▄▄▄
 ██████████
  ▀▀▀██▀▀▀    model Opus 5.5
     ██       power ▮▮▮▯▯ high
    ▀██▀
  ▄██████▄
```

- **Sprites** (`hooks/core/sprite.ts`): 12×12-pixel grids (`GRIDS`), copied verbatim from T-010, with 3 color slots and transparency, NES style. They are drawn as 6 rows of 12 cells.
  - **The motifs:** Opus is a chalice with a ruby, Sonnet a quill, Haiku a mountain under the sun, Fable a Greek papyrus scroll, Mythos a winged helmet, and the unknown model an empty cartridge.
  - **Each family has its palette (`PALETTES`):**
    - **Fixed identity colors** (`#rrggbb`), so the sprite looks as designed in any theme. With themes that follow the terminal's ANSI palette, theme keys collided: `claude` and `error` came out the same, and `warning` came out lime. The Maintainer decided this in the review of #27, on 2026-11-21.
    - **The light detail** (slot 3) keeps the theme key `text`, which is light on dark themes and dark on light ones.
    - **The values:**

      | Family | Slots 1 / 2 / 3 |
      | --- | --- |
      | Opus | `#d77757`, `#f2c94c`, `#e0115f` (the ruby) |
      | Sonnet | `#b1b9f9`, `#f2c94c`, `text` |
      | Haiku | `#4eba65`, `#f2c94c`, `text` |
      | Fable | `#af87ff`, `#d77757`, `text` |
      | Mythos | `#48968c`, `#f2c94c`, `text` |

    - **The footer and the label** keep the theme keys (`familyColor`).
  - **The unknown sprite** is dimmed whole, and also serves the "off" state (§3.1.1).
- **From pixels to cells** (`cellOf`, `spriteRuns`, pure functions): two rows of pixels make one row of cells.
  - Two pixels of different colors give `▀`, with `color` above and `backgroundColor` below; two of the same color give `█`.
  - A single pixel gives `▀` or `▄` with no background; none, a space.
  - The dimmed look never needs a background.
  - Adjacent cells that look alike are joined into a single `Text`.
- **Label** (`hooks/core/band.ts`): two lines beside the sprite's two middle rows, `model ` and `power `, both 6 columns wide so the values line up. It uses the same sanitized parts as the footer badge (`badgeState`, `effortRuns`).
- **Fit to `bodyColumns`:** full → no meter → model only → sprite only → nothing. The largest size that fits is drawn. If dropping the effort frees no room, because the model's line is the longer one, the effort goes with the label. With Opus at `high`: 30, 28, 28 and 12 cells.
- **`AbovePrompt` hook:** it draws only model-meter's own row (`e.plugin`) on the terminal, followed by what lies beneath (`next(e)`). Otherwise it passes. It adds no `$` calls.
- **Mythos** (T-010): `claude-mythos-5` → `Mythos 5`, `claude-mythos-5-1` → `Mythos 5.1` and `claude-mythos-preview` (Bedrock) → `Mythos preview`, in the color `planMode`, in the footer and the band. Any other text stays unknown.

### 3.3 `userConfig`

| Field | Type | Default |
| --- | --- | --- |
| `placement` | `footer` \| `auto` \| `band` | `footer` |
| `autoMinColumns` | number (80–400) | `140` |
| `showEffortMeter` | boolean | `true` (phase 5, optional, not implemented) |
| `palette` | `classic` \| `gameboy` \| `mono` | `classic` (phase 5, optional, not implemented) |

`placement` and `autoMinColumns` have been in `plugin.json` since T-004. They are untrusted input: `parseOptions` (`hooks/core/options.ts`) replaces anything off the list or out of range with the default, without throwing.

### 3.4 Evaluation: `auto` mode (compact at half screen, large at full screen)

**Viable.** Every `ui.render` receives `e.viewport = { columns, rows, isFullscreen? }`. On the terminal, a change of width redraws every hooked site once the resize settles. No timers or polling are needed.

| Signal | Useful? | Why |
| --- | --- | --- |
| `viewport.columns` | **Yes, the main signal** | It reflects the terminal's real width and triggers a redraw. |
| `viewport.rows` | Secondary | Informative: a change of height *alone* does not redraw. |
| `viewport.isFullscreen` | **No**, not as a criterion | It tells Claude Code's alternate-screen mode (fixed per session), not whether the window is maximized. |
| `AbovePrompt.props.bodyColumns` / `maxRows` | Yes, to size the sprite | The band's real usable width (it subtracts a docked `Pane`). |

The rule for `placement: auto`:

- The compact footer **always** shows: it is the essential information.
- The band is added when `columns ≥ autoMinColumns` (140 by default) **and** `maxRows` fits the sprite (≥ 6 rows). T-000 measured 95 columns at half screen and 191 maximized, with `maxRows` 18 in use.
- **Hysteresis,** so a resize does not flicker it: it enters at `≥ autoMinColumns` and leaves at `< autoMinColumns − 20` (140 and 120 by default).
- Terminal only: on `desktop` and `mobile` the mod draws no band, as with the footer.

**Implemented in T-004** (`bandVisibility`, in `hooks/core/band.ts`):

- **When the band shows:**
  - `footer` never shows the band; `band` shows it whenever it fits; `auto` shows it while the terminal counts as wide;
  - in all three cases, only with `maxRows ≥ 6` and no survey (`hasSurvey`).
- **The state between drawings:**
  - the only state carried from one drawing to the next is the width's (`wide`), so a survey or a short band hides the band for a while without resetting it;
  - that state lives in the module's closure, like the hint's width, because the engine does not let a hook write `$.state` while it draws.
- **With `placement: footer`,** the `AbovePrompt` hook is not even registered: the mod asks for no row in the band.

A rough reference: a 1920 px monitor with a 14 px font gives ~200 columns at full screen and ~95–110 at half screen, so 140 separates both cases well.

**Cost:** the band takes rows above the prompt on every turn. It shares that space with the engine's surveys, and the user can fold it with `[-]`. That is why the default is `footer` and `auto` is opt-in.

---

## 4. Architecture

```text
plugins/model-meter/
├── .claude-plugin/plugin.json   # name, version, userConfig (placement, autoMinColumns)
├── hooks/
│   ├── hooks.json
│   ├── register.tsx             # event wiring and drawing only (engine types via validate --strict)
│   ├── register.test.tsx        # mod tests (claude plugin test)
│   └── core/                    # PURE: no `$` and no `claude-code` (tsc + node --test)
│       ├── sanitize.ts          # clean and bound any text that is drawn
│       ├── model.ts             # model id → { family, label }
│       ├── effort.ts            # level → { cells, label }; parseEffortArg
│       ├── state.ts             # cascade step / stored / pending / unknown
│       ├── badge.ts             # badge state, runs, family colors
│       ├── layout.ts            # widths, drawn-hint measures, variant by room
│       ├── options.ts           # parseOptions: userConfig as untrusted input
│       ├── band.ts              # band visibility (hysteresis), rows and fit
│       └── sprite.ts            # 12×12 grids, palettes, pixels → cells
├── types/index.d.ts             # the $.state contract
├── tsconfig.json
└── README.md
.claude-plugin/marketplace.json  # the repository is a marketplace
```

Principles: a **pure, testable core** (no `$`), thin hooks, and no runtime dependencies.

---

## 5. Security (a short STRIDE threat model)

| Threat | Vector | Control |
| --- | --- | --- |
| *Tampering* | A hook that rewrites `model`/`effort`, or blocks a command | The mod **only observes**: always `next(e)` untouched; gating hooks carry a `.catch` that lets the event through. Tests prove it, and `check-capabilities` enforces the `.catch`. |
| *Spoofing / injection* in the UI | A model string with control or ANSI sequences, or a very long one | `sanitize.ts`: an allowlist `[A-Za-z0-9.\-\[\] ]`, length ≤ 32, property tests with `fast-check`. The options are validated with closed lists and ranges, and never drawn verbatim. |
| *Information disclosure* | Persisting sensitive data | Only the **last effort level** is stored (`$.store`). No paths, prompts, tokens or model ids. |
| *Elevation of privilege* | Use of `$.fs`, `$.process`, `$.model`, the network, `$.tool.register`; or a component beside the hooks module (classic command hooks, MCP or LSP servers, `bin`), or a marketplace entry that points installers elsewhere | Forbidden. CI parses the output of `claude plugin validate` (what the module calls, and every component the plugin declares) against an **allowlist**. `check-marketplace` ties the marketplace entry, which installers read, to the folder those checks cover (T-014). |
| *DoS* | Timers or costly renders | No timers; O(1) per render; redraws only when a measured width changes. |
| Supply chain | Compromised dependencies or actions | No runtime dependencies; development dependencies pinned by the lockfile; actions pinned by **SHA**; Dependabot; `npm ci --ignore-scripts`; releases with build provenance (T-012). |

---

## 6. Quality and security gates

Every change enters `main` through a **pull request** under the `main` ruleset; no gate is optional.

| Gate | Tool | Threshold |
| --- | --- | --- |
| Mod validation | `claude plugin validate` (CLI pinned to a version) | 0 errors |
| Capability allowlist | A script that parses `claude plugin validate --json` | See below |
| Marketplace entry | `scripts/check-marketplace.mjs`, in `check:core`: no CLI, no network | Exactly one entry, `model-meter` from `./plugins/model-meter`, with `plugin.json`'s version; closed lists of keys, so no entry-level components, `strict` or `pluginRoot` |
| Types | Pure core: `tsc --strict` (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`). Hooks: `claude plugin validate --strict`, which checks the engine's types without vendoring them | 0 errors |
| Lint | ESLint + `typescript-eslint` *strict-type-checked* + `eslint-plugin-security` | 0 warnings |
| Formatting | Prettier | `--check` |
| Logic tests | `node --test` + `c8` | Coverage ≥ 95% lines/branches of the pure core (it is at 100%) |
| Mod tests | `claude plugin test` on `terminal` and `desktop` | 100% green |
| Property-based | `fast-check` on `sanitize`/`model` | 1,000 cases |
| SAST | CodeQL (JS/TS) | 0 alerts ≥ medium |
| Secrets | GitHub secret scanning + `gitleaks` | 0 findings |
| Dependencies | `npm audit --audit-level=low`, Dependabot, *dependency-review-action* | 0 vulnerabilities |
| Workflows | `zizmor` / `actionlint`; `permissions: contents: read` by default | 0 findings |
| Posture | OpenSSF Scorecard | ≥ 8/10 |
| Commits | Conventional Commits (commitlint); `main` only through squash merges signed by GitHub | Required |
| Releases | SemVer, `CHANGELOG.md`, build provenance (GitHub attestations) | Per tag |

**The capability allowlist** admits:

- `$.session.model`, `$.store.get`/`set`, `$.ui.invalidate`/`resolve` and `$.clock.now`;
- `$.state.get`/`set`, **bounded** to `model-meter`'s own state and to the keys its contract declares (`types/index.d.ts`). The Maintainer decided this on 2026-11-18, in T-003.

It admits **no** environment variable, and every hook that can block an event must carry a `.catch`. Among the components the report's `provides` block lists, the plugin may declare only its hooks module, `hooks/register.tsx`; every other list must be empty (T-014).

### 6.1 Extra controls because the repository is public

- **Repository security features:** secret scanning with **push protection**, and **private vulnerability reporting**.
- **The `main` ruleset:**
  - a pull request is required, with **0 required approvals**;
  - required status checks, squash merge only, linear history, signed commits;
  - no force push and no deletion.
  - **Why no `CODEOWNERS` review:** the pull requests are opened by the Maintainer's account (through the Builder's `gh`), and GitHub does not let anyone approve their own pull request, so it would block every merge. The human approval is recorded as `docs/WORKFLOW.md` §6 describes.
- **A tag ruleset for `v*`** before the first release (`docs/REPO-SETTINGS.md` §4).
- **Workflows:**
  - triggered by `pull_request`, never `pull_request_target` with the pull request checked out;
  - `GITHUB_TOKEN` read-only by default;
  - manual approval for workflows from first-time contributors' forks.
- **Public posture:** the OpenSSF Scorecard result is published as a badge, and the MIT license is present.
- **No personal data** in the code, the fixtures or the history (`gitleaks` also scans the full history).

Governance files: `SECURITY.md`, `CODEOWNERS`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, issue forms, a pull request template with a security checklist, and `.editorconfig`.

---

## 7. Methodology

**Spec-driven + TDD (red → green → refactor)** in short iterations, framed by NIST SSDF:

- **PO (Prepare):** this plan, the gates and CI before the first line of product code.
- **PS (Protect):** branch protection, signatures, actions pinned by SHA, least privilege.
- **PW (Produce):** a pure, testable design, a threat model, and review (`/code-review`, `/security-review`) on every pull request.
- **RV (Respond):** `SECURITY.md`, Dependabot, a periodic Scorecard and a weekly audit.

Each story goes: specification (acceptance criteria) → failing test → minimal implementation → refactor → green gates → pull request.

**The Reviewer–Builder pattern** (detail in `docs/WORKFLOW.md`):

- a Claude Code session in the cloud designs, plans and reviews;
- the Maintainer's local Claude Code session implements and tests in the real environment (terminal, the `claude` CLI);
- the person approves.

The tasks live in `docs/tasks/` with verifiable acceptance criteria, and GitHub (branches and pull requests) is the channel and the audit trail.

---

## 8. Phased plan

| Phase | Deliverable | Exit criterion |
| --- | --- | --- |
| **0. Spikes** ✅ | A throwaway prototype that records `session.model()` and `turn.step` | Documented answers to the unknowns of §2.4 |
| **1. Secure scaffold** ✅ | `package.json` with no runtime dependencies, strict tsconfig, ESLint, Prettier, CI with every gate, `SECURITY.md`, `CODEOWNERS`, Dependabot, CodeQL, Scorecard | CI green on an empty mod that validates |
| **2. Pure core (TDD)** ✅ | `model.ts`, `effort.ts`, `sanitize.ts` and more, with tests and property tests | Coverage ≥ 95% |
| **3. Compact mode** ✅ | `register.tsx`: `turn.step` (observer), `session.*`, a `SessionMode` render composing with what lies beneath | Mod tests on `terminal` and `desktop`; lives alongside `sub-meter` |
| **4. 8-bit large mode** ✅ | The `AbovePrompt` band with sprites (T-004, T-010) | Render and width tests |
| **5. Config and persistence** (**optional, later**) | `placement` and `autoMinColumns` are done (T-004) and the last effort is stored (T-003). Palettes and `showEffortMeter` remain (T-011) | The Maintainer's decision (2026-11-21): it does not block v0.1.0 |
| **6. Hardening and release** (T-012) | Security review, README with screenshots, release workflow with provenance, tag `v0.1.0` | Every gate green; installation with `/plugin marketplace add at0mikd/model-meter` and `/plugin install model-meter@model-meter` |

---

## 9. Risks

| Risk | Mitigation |
| --- | --- |
| The mod API changes between CLI versions | Pin the `claude` CLI in CI; Dependabot proposes CLI bumps as their own reviewed pull requests. |
| Effort unknown until the first turn | Show the last stored value marked as previous, or the "off" look. |
| Room conflicts with other footer mods | Compose with `next(e)`, measure what is drawn, and degrade by width; the band as an alternative. |
| Terminals without 24-bit color or block glyphs | The footer uses theme keys; an ASCII/`mono` fallback is part of the optional phase 5. |

---

## 10. References

- Reference mod: <https://github.com/midudev/better-claude/tree/main/plugins/sub-meter>
- Claude Code plugins: <https://code.claude.com/docs/en/plugins>
- The classic status line: <https://code.claude.com/docs/en/statusline>
- The engine's types (local, v2.1.327): `claude-code.d.ts`: `session.model`, `TurnStepInput.effort`, `SessionMode`/`AbovePrompt`, `PromptHint`, `TraceEntry`
- NIST SSDF SP 800-218: <https://csrc.nist.gov/pubs/sp/800/218/final>
- GitHub Actions hardening: <https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions>
- OpenSSF Scorecard: <https://github.com/ossf/scorecard>
- SLSA / provenance: <https://slsa.dev>
