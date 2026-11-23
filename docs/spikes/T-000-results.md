# T-000 · Terminal spike results

- **Task:** [`docs/tasks/T-000-spike-terminal.md`](../tasks/T-000-spike-terminal.md)
- **Date:** 2026-11-18
- **Spike:** `spikes/wic-spike` as it is on `main` (3eb881d), unmodified.

## Environment (AC5)

| Item | Value |
| --- | --- |
| Claude Code | 2.1.327 |
| Operating system | Fedora Linux 44 Workstation (x86_64), GNOME on Wayland |
| Terminal emulator | Ghostty 1.4.0 (`TERM=xterm-ghostty`, truecolor), no tmux |
| Default renderer | `fullscreen` (the user's `tui` setting; `/tui` → `Current renderer: fullscreen`) |
| Other mods | `sub-meter@better-claude` |

## Answer to each criterion

| AC | Answer |
| --- | --- |
| **AC1** `/model` | **There is an event before the next turn.** `/model` emits `command.run` and then `config.set` with `{ key: "model", value: "sonnet", previous: "opus" }`, before the next `turn.step`. `value` is the alias, not the id. At the next `prompt.submit`, `$.session.model()` already returns the new id (`claude-sonnet-5-5`). |
| **AC2** `/effort` | **Only `command.run`; no `config.set`.** `$.settings.read({ key: "effortLevel" })` **does not change**: it returns `"medium"` in all three sessions, while `turn.step`'s effective effort is `xhigh` when pass A starts and `high` after `/effort`. The new level is only known at the next `turn.step`. |
| **AC3** viewport | Half screen: **95 × 47**. Maximized window: **191 × 47**. The same values with and without `sub-meter`. `AbovePrompt.bodyColumns` = `columns − 5` (90 / 186); `maxRows` = 47 with the session empty and 18 afterwards. Maximizing records a new render of `SessionMode` and `AbovePrompt` with the new width. |
| **AC4** `isFullscreen` | `true` with the `fullscreen` renderer (passes A and B), at 95 as well as at 191 columns. `false` with the classic renderer (pass C, `CLAUDE_CODE_DISABLE_ALTERNATE_SCREEN=1`). This confirms `docs/PLAN.md` §3.4: it tells the render mode, not whether the window is maximized. |
| **AC5** environment | See the table above. |

## Procedure run

Three `claude --plugin-dir spikes/wic-spike` sessions, with trivial prompts (`responde solo: hola`, "answer only: hello") so as to generate no data.

| Pass | `sub-meter` | Renderer | Sequence |
| --- | --- | --- | --- |
| A | on | fullscreen | `/tui` → prompt → `/model` (Opus 5.5 → Sonnet 5.5) → `/effort` (xhigh → high) → report → maximize → prompt → report |
| B | disabled with `/plugin` | fullscreen | prompt → `/model` (Sonnet 5.5 → Opus 5.5) → `/effort` (high → high) → report → maximize → prompt → report → re-enable `sub-meter` |
| C | on | classic (`CLAUDE_CODE_DISABLE_ALTERNATE_SCREEN=1`) | `/tui` (→ `classic`) → prompt → report |

The `command.run` events carry the keys `command`, `args`, `origin` and `presentation`. The spike only recorded the key **names**, because it read a `name` field that does not exist. So which one was `/tui`, `/model` or `/effort` is deduced from the order and from each command's output in the session.

### Timeline of pass A (by `seq`)

| seq | Event | Relevant data |
| --- | --- | --- |
| 0–1 | render `AbovePrompt` / `SessionMode` | 95 × 47, `isFullscreen: true` |
| 2 | `session.start` | model `claude-opus-5-5`, `effortSetting: "medium"` |
| 3 | `command.run` | `/tui` |
| 4–5 | `prompt.submit` → `turn.step` | `turn.step.effort: "xhigh"` (although the setting says `medium`) |
| 6 | `command.run` | `/model` |
| 7 | `config.set` | `model`: `opus` → `sonnet` |
| 8 | `command.run` | `/effort`, **with no `config.set`** |
| 9–10 | `prompt.submit` → `turn.step` | model `claude-sonnet-5-5`, `effort: "high"`; `effortSetting` still `"medium"` |
| 13–14 | render `AbovePrompt` / `SessionMode` | 191 × 47 after maximizing |

## Findings for the Reviewer

These are proposals, not changes: the Reviewer updates the plan (`T-000`, "Out").

1. **`settings.effortLevel` does not work as the source of the effort.**
   - **What was seen:**
     - in this environment the user setting `effortLevel` is `medium`, but the effective effort when starting with Opus 5.5 was `xhigh`;
     - `/effort high` says "saved as your default for new sessions", and sessions B and C start at `high`, yet `effortLevel` stays `medium`, so `/effort` saves the value elsewhere.
   - **Consequence:** the cascade of `docs/PLAN.md` §2.4 (`settings.effortLevel` → env → `$.store` → `?`) would show a **false** value before the first turn.
   - **Proposal:** before the first `turn.step`, show the last `$.store` value dimmed, or `?`. Use `settings.effortLevel` at most as a hint marked uncertain, or not at all.
2. **Environment variables:** `CLAUDE_CODE_EFFORT_LEVEL` and `CLAUDE_EFFORT` are `undefined` in every read (the keys `envEffort` and `envEffort2` do not appear in the JSON).
3. **`/model` allows refreshing without waiting for the turn:** on `config.set` with `key === "model"`, calling `$.session.model()` is enough (`value` is the alias).
4. **`/effort` is not observable until the next turn,** except perhaps through the `command`/`args` values of `command.run`, which this spike did not record. With the interactive picker (`/effort` without arguments), `args` is probably empty. Options:
   - mark the effort as "pending" (dimmed) after a `command.run` of `/effort`, until the next `turn.step`;
   - or run a mini-spike that records `command` and `args`, including `/effort high` with an argument.
5. **Width next to `sub-meter`:** `SessionMode.props.modes` is `[]` in every pass, and the spike does not measure what `next(e)` returns. The data only say that the viewport is the same with and without `sub-meter`, not how many columns it takes. The width of what `next(e)` returns must be measured (in the product or in a mini-spike) before setting the degradation thresholds.
6. **`turn.step`:** no `agentId` in any case (main thread). A turn with a tool produces `index` 0 and 1.
7. **A side effect of testing:** `/model` and `/effort` save the value as the default for new sessions. Testing the mod with those commands changes the user's settings; future spikes and the mod's README should warn about it.

## Reports (sanitized)

- **What they contain:** only model names, effort levels, event names and sizes; no paths, prompts or personal data.
- **How to read them:**
  - `seq` is the global order of the events;
  - `JSON.stringify` omits `undefined` fields (`envEffort`, `envEffort2`, `agentId`, `name`).
- **Why there is one report per pass:** the first report of passes A and B is an exact prefix of the second (checked), so only each pass's final report is included.

### Pass A — with `sub-meter`, fullscreen renderer

```json
{
 "render.AbovePrompt": [
  {"seq": 0, "data": {"surface": "terminal", "viewport": {"columns": 95, "rows": 47, "isFullscreen": true}, "bodyColumns": 90, "maxRows": 18}},
  {"seq": 13, "data": {"surface": "terminal", "viewport": {"columns": 191, "rows": 47, "isFullscreen": true}, "bodyColumns": 186, "maxRows": 18}}
 ],
 "render.SessionMode": [
  {"seq": 1, "data": {"surface": "terminal", "viewport": {"columns": 95, "rows": 47, "isFullscreen": true}, "modes": []}},
  {"seq": 14, "data": {"surface": "terminal", "viewport": {"columns": 191, "rows": 47, "isFullscreen": true}, "modes": []}}
 ],
 "session.start": [
  {"seq": 2, "data": {"model": "claude-opus-5-5", "effortSetting": "medium"}}
 ],
 "command.run": [
  {"seq": 3, "data": {"keys": ["command", "args", "origin", "presentation"]}},
  {"seq": 6, "data": {"keys": ["command", "args", "origin", "presentation"]}},
  {"seq": 8, "data": {"keys": ["command", "args", "origin", "presentation"]}}
 ],
 "prompt.submit": [
  {"seq": 4, "data": {"model": "claude-opus-5-5", "effortSetting": "medium"}},
  {"seq": 9, "data": {"model": "claude-sonnet-5-5", "effortSetting": "medium"}},
  {"seq": 15, "data": {"model": "claude-sonnet-5-5", "effortSetting": "medium"}},
  {"seq": 17, "data": {"model": "claude-sonnet-5-5", "effortSetting": "medium"}}
 ],
 "turn.step": [
  {"seq": 5, "data": {"model": "claude-opus-5-5", "effort": "xhigh", "index": 0}},
  {"seq": 10, "data": {"model": "claude-sonnet-5-5", "effort": "high", "index": 0}},
  {"seq": 12, "data": {"model": "claude-sonnet-5-5", "effort": "high", "index": 1}},
  {"seq": 16, "data": {"model": "claude-sonnet-5-5", "effort": "high", "index": 0}},
  {"seq": 18, "data": {"model": "claude-sonnet-5-5", "effort": "high", "index": 0}}
 ],
 "config.set": [
  {"seq": 7, "data": {"key": "model", "value": "sonnet", "previous": "opus"}}
 ],
 "report": [
  {"seq": 11, "data": {"model": "claude-sonnet-5-5", "effortSetting": "medium"}},
  {"seq": 19, "data": {"model": "claude-sonnet-5-5", "effortSetting": "medium"}}
 ]
}
```

### Pass B — without `sub-meter`, fullscreen renderer

```json
{
 "render.AbovePrompt": [
  {"seq": 0, "data": {"surface": "terminal", "viewport": {"columns": 95, "rows": 47, "isFullscreen": true}, "bodyColumns": 90, "maxRows": 47}},
  {"seq": 3, "data": {"surface": "terminal", "viewport": {"columns": 95, "rows": 47, "isFullscreen": true}, "bodyColumns": 90, "maxRows": 18}},
  {"seq": 13, "data": {"surface": "terminal", "viewport": {"columns": 191, "rows": 47, "isFullscreen": true}, "bodyColumns": 186, "maxRows": 18}}
 ],
 "render.SessionMode": [
  {"seq": 1, "data": {"surface": "terminal", "viewport": {"columns": 95, "rows": 47, "isFullscreen": true}, "modes": []}},
  {"seq": 14, "data": {"surface": "terminal", "viewport": {"columns": 191, "rows": 47, "isFullscreen": true}, "modes": []}}
 ],
 "session.start": [
  {"seq": 2, "data": {"model": "claude-sonnet-5-5", "effortSetting": "medium"}}
 ],
 "prompt.submit": [
  {"seq": 4, "data": {"model": "claude-sonnet-5-5", "effortSetting": "medium"}},
  {"seq": 9, "data": {"model": "claude-opus-5-5", "effortSetting": "medium"}},
  {"seq": 15, "data": {"model": "claude-opus-5-5", "effortSetting": "medium"}},
  {"seq": 17, "data": {"model": "claude-opus-5-5", "effortSetting": "medium"}}
 ],
 "turn.step": [
  {"seq": 5, "data": {"model": "claude-sonnet-5-5", "effort": "high", "index": 0}},
  {"seq": 10, "data": {"model": "claude-opus-5-5", "effort": "high", "index": 0}},
  {"seq": 12, "data": {"model": "claude-opus-5-5", "effort": "high", "index": 1}},
  {"seq": 16, "data": {"model": "claude-opus-5-5", "effort": "high", "index": 0}},
  {"seq": 18, "data": {"model": "claude-opus-5-5", "effort": "high", "index": 0}}
 ],
 "command.run": [
  {"seq": 6, "data": {"keys": ["command", "args", "origin", "presentation"]}},
  {"seq": 8, "data": {"keys": ["command", "args", "origin", "presentation"]}}
 ],
 "config.set": [
  {"seq": 7, "data": {"key": "model", "value": "opus", "previous": "sonnet"}}
 ],
 "report": [
  {"seq": 11, "data": {"model": "claude-opus-5-5", "effortSetting": "medium"}},
  {"seq": 19, "data": {"model": "claude-opus-5-5", "effortSetting": "medium"}}
 ]
}
```

### Pass C — classic renderer

```json
{
 "render.AbovePrompt": [
  {"seq": 0, "data": {"surface": "terminal", "viewport": {"columns": 95, "rows": 47, "isFullscreen": false}, "bodyColumns": 90, "maxRows": 47}}
 ],
 "render.SessionMode": [
  {"seq": 1, "data": {"surface": "terminal", "viewport": {"columns": 95, "rows": 47, "isFullscreen": false}, "modes": []}}
 ],
 "session.start": [
  {"seq": 2, "data": {"model": "claude-opus-5-5", "effortSetting": "medium"}}
 ],
 "command.run": [
  {"seq": 3, "data": {"keys": ["command", "args", "origin", "presentation"]}}
 ],
 "prompt.submit": [
  {"seq": 4, "data": {"model": "claude-opus-5-5", "effortSetting": "medium"}},
  {"seq": 6, "data": {"model": "claude-opus-5-5", "effortSetting": "medium"}}
 ],
 "turn.step": [
  {"seq": 5, "data": {"model": "claude-opus-5-5", "effort": "high", "index": 0}},
  {"seq": 7, "data": {"model": "claude-opus-5-5", "effort": "high", "index": 0}}
 ],
 "report": [
  {"seq": 8, "data": {"model": "claude-opus-5-5", "effortSetting": "medium"}}
 ]
}
```
