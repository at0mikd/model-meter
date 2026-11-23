# T-003b · Measurement results (phase 1)

- **Task:** [`docs/tasks/T-003b-footer-room.md`](../tasks/T-003b-footer-room.md)
- **Date:** 2026-11-19
- **Spike:** `spikes/wic-spike` with T-003b's observations (54e129a). It calls nothing new on `$`.

## Environment

| Item | Value |
| --- | --- |
| Claude Code | 2.1.328 |
| Operating system | Fedora Linux 44 (x86_64) |
| Terminal | tmux 3.8 with its own server, window fixed at **95 × 47** and **191 × 47** |
| Renderer | `fullscreen` |
| Other mods | `sub-meter` 0.4.4, `context-meter` 0.1.0, `quick-peek` 0.2.0 and `image-preview` 0.2.2 (`better-claude`) |
| Model and effort | Opus 5.5, `xhigh` |

## Method

- **Sessions:** the Builder drives them in tmux with `claude --plugin-dir spikes/wic-spike [--plugin-dir plugins/model-meter]`, without its own session's environment variables. It only sends trivial prompts.
- **Footer:** read as text with `tmux capture-pane`, column by column.
- **The spike's report:** its `report` tool, read from the `toolUseResult` in that session's transcript.
- **Passes:**

| Pass | How model-meter is loaded | What was done |
| --- | --- | --- |
| A | `--plugin-dir` | at rest, one turn, 8 × shift+tab, typing, background shell, `report` |
| C | `--plugin-dir` | one prompt in each mode; `dontAsk` with `--permission-mode` |
| B | the local clone's marketplace | at rest, the cycle, 191 columns, `/reload-plugins`, `prependPlugins` with `--settings` |
| P4 | a local build in a temporary folder, outside the repo | the badge forced to overflow |

## P1 · What the `PromptHint` hook sees and what `next(e)` returns

Pass A: model-meter sits outside `sub-meter`.

| Moment | `e.props.hint` model-meter receives | What the engine receives (what is drawn) |
| --- | --- | --- |
| start-up | `(shift+tab to cycle) · ← for agents` (35) | `← for agents` (12) |
| at rest, auto | `(shift+tab to cycle)` (20) | `''` (0) |
| working | `(shift+tab to cycle) · esc to interrupt` | `''` |
| manual mode | `? for shortcuts` (15) | `? for shortcuts` (15) |
| background shell | `1 shell · ↓ to manage` (21) | the same |
| shell and working | `1 shell · esc to interrupt · ↓ to manage` (40) | `1 shell · ↓ to manage` (21) |

- **It receives the raw hint,** which is why it reserves too much. `sub-meter` (link 4) removes `(shift+tab to cycle)` and `esc to interrupt`, so `context-meter` already receives the trimmed hint.
- **`next(e)` in `PromptHint` is opaque:** `{ type: 'engine', ref }`.
- **`next.trace` does give what is drawn.**
  - After `await next(e)` it lists the links beneath, with the engine last.
  - The engine's `received.props.hint` is the hint as drawn.
  - This holds whether model-meter sits above `sub-meter` or beneath it.
- **Hypothesis confirmed:** at rest, `hint` does **not** include the mode label; the engine draws it separately, followed by ` · `.
- **A transient exception:** right after a shift+tab, one render arrives whose hint carries the **previous** mode's name, for example `auto mode on (shift+tab to cycle)` or `manual mode on · ? for shortcuts`. It goes back to the normal hint right away.

## P2 · The order of hooks across plugins

| Loading | Order (`next.trace`, 0 = the outermost) | Badge | Hint model-meter receives |
| --- | --- | --- | --- |
| `--plugin-dir` (AC7) | 0 wic-spike, 1 model-meter, 2 quick-peek, 3 image-preview, 4 sub-meter, 5 context-meter, 6 engine | left of `sub-meter` | raw |
| marketplace | …, sub-meter, context-meter, **model-meter**, engine | **right** of `sub-meter` | trimmed |

- **All in the `user` tier.** The `--plugin-dir` plugins come first, in the order of the flags. Then the installed ones, in the order of `enabledPlugins`: on install, model-meter was appended to the end of that list.
- **Stability:** the order holds after `/reload-plugins` and across sessions, because the order of `enabledPlugins` persists. Reinstalling was not tried; it would most likely go back to the end.
- **`prependPlugins`:**
  - with `--settings` it has no effect;
  - it was not tried in the user settings, because that would change the Maintainer's settings. According to the mod reference, it moves the plugin to the `prepend` tier.
- **Installed from the marketplace,** model-meter does not see `sub-meter`: it leaves it above.
  - It picks its variant without counting it.
  - `sub-meter`, which does measure what is beneath it, adapts: in manual mode at 95 columns it dropped its bar (`week 19% ↻ 6d 4h`).
  - The footer does not wrap, but the badge wins the room.
  - The padding on the left of the slot shows as a gap after the separator: `98% ↻ 1h 8m ·     ◆ Opus 5.5 ░░░░░ ---`.

## P3 · `permission_mode`

- **Carried by:** `UserPromptSubmit`, `Stop`, `PostToolUse`, `PostToolBatch` and `SubagentStop`.
- **Not carried by:** `SessionStart`, `InstructionsLoaded`, `PreToolUse` and `MessageDisplay`.
- **shift+tab produces no event,** neither classic nor mod: only renders of `PromptHint` and `SessionMode`.
- **The real cycle,** with no bypass flag: `auto` → `default` ("manual mode on") → `acceptEdits` → `plan` → `auto`.
  - `dontAsk` is only reached with `--permission-mode`, and leaves the cycle at the first shift+tab.
  - **bypass was not measured live:** `--allow-dangerously-skip-permissions` asks to accept a warning that is saved in the Maintainer's global settings, so it was not accepted.
- **Each mode's value,** from the transcript's `permissionMode` at each prompt: `auto`, `default`, `acceptEdits`, `plan`.

| `permission_mode` | Label (with ` ·`) | Columns |
| --- | --- | --- |
| `auto` | `⏵⏵ auto mode on ·` | 17 |
| `default` | `⏸ manual mode on ·` | 18 |
| `acceptEdits` | `⏵⏵ accept edits on ·` | 20 |
| `plan` | `⏸ plan mode on ·` | 16 |
| `dontAsk` | `⏵⏵ don't ask on ·` | 17 |
| `bypassPermissions` | `⏵⏵ bypass permissions on ·` | 26 (from T-003, not measured live) |

The widths match the mod's `widthOf` and what shows on screen.

## P4 · Overflow

Tested with a local build that always draws `full` plus 40 columns of padding. **The engine wraps the footer:**

- the hint stays on its row;
- `SessionMode`'s tree moves down to a row of its own;
- if it does not fit there either, the text continues on a third row.

It trims neither the hint nor the tree, so there is no room for a less pessimistic computation that relies on the engine trimming.

```text
  ⏵⏵ auto mode on · ← for agents
      ◆ Opus 5.5 ▮▮▮▮▯ xhi####################################### · 5h ━━━━━━━━━━ 97% ↻ 1h 9m
                          #
```

## The current formula predicts what was observed

The reservation is `4 + 26 + (1 + hint) + 2 + (3 + beneath)`. What is left is compared with the slots of 24 (`full`), 18 (`noMeter`) and 12 (`modelOnly`). At 95 columns, with `sub-meter` (26 or 27 columns) beneath:

| Case | Hint measured today | Left today | Observed | With the drawn hint | With the exact label |
| --- | --- | --- | --- | --- | --- |
| at rest, auto | 20 | 12 | `modelOnly` | 33: `full` | 42: `full` |
| manual mode | 15 | 17–18 | `modelOnly` / `noMeter` | the same | 25–26: `full` |
| shell, auto | 21 | 12 | `modelOnly` | 12: `modelOnly` | 21: `noMeter` |

## Report (sanitized excerpt, pass A)

It contains only plugins, tiers, hints and sizes; no paths, prompts or personal data.

```json
{
 "render.PromptHint": [
  {
   "seq": 7,
   "columns": 95,
   "isWorking": false,
   "beneath": [
    {
     "index": 1,
     "plugin": "model-meter",
     "tier": "user",
     "hint": "(shift+tab to cycle)"
    },
    {
     "index": 2,
     "plugin": "quick-peek",
     "tier": "user",
     "hint": "(shift+tab to cycle)"
    },
    {
     "index": 3,
     "plugin": "image-preview",
     "tier": "user",
     "hint": "(shift+tab to cycle)"
    },
    {
     "index": 4,
     "plugin": "sub-meter",
     "tier": "user",
     "hint": "(shift+tab to cycle)"
    },
    {
     "index": 5,
     "plugin": "context-meter",
     "tier": "user",
     "hint": ""
    },
    {
     "index": 6,
     "plugin": "engine",
     "tier": "core",
     "hint": ""
    }
   ],
   "result": {
    "type": "engine",
    "keys": [
     "type",
     "ref"
    ]
   }
  },
  {
   "seq": 15,
   "columns": 95,
   "isWorking": true,
   "beneath": [
    {
     "index": 1,
     "plugin": "model-meter",
     "tier": "user",
     "hint": "(shift+tab to cycle) · esc to interrupt"
    },
    {
     "index": 2,
     "plugin": "quick-peek",
     "tier": "user",
     "hint": "(shift+tab to cycle) · esc to interrupt"
    },
    {
     "index": 3,
     "plugin": "image-preview",
     "tier": "user",
     "hint": "(shift+tab to cycle) · esc to interrupt"
    },
    {
     "index": 4,
     "plugin": "sub-meter",
     "tier": "user",
     "hint": "(shift+tab to cycle) · esc to interrupt"
    },
    {
     "index": 5,
     "plugin": "context-meter",
     "tier": "user",
     "hint": ""
    },
    {
     "index": 6,
     "plugin": "engine",
     "tier": "core",
     "hint": ""
    }
   ],
   "result": {
    "type": "engine",
    "keys": [
     "type",
     "ref"
    ]
   }
  },
  {
   "seq": 29,
   "columns": 95,
   "isWorking": false,
   "beneath": [
    {
     "index": 1,
     "plugin": "model-meter",
     "tier": "user",
     "hint": "auto mode on (shift+tab to cycle)"
    },
    {
     "index": 2,
     "plugin": "quick-peek",
     "tier": "user",
     "hint": "auto mode on (shift+tab to cycle)"
    },
    {
     "index": 3,
     "plugin": "image-preview",
     "tier": "user",
     "hint": "auto mode on (shift+tab to cycle)"
    },
    {
     "index": 4,
     "plugin": "sub-meter",
     "tier": "user",
     "hint": "auto mode on (shift+tab to cycle)"
    },
    {
     "index": 5,
     "plugin": "context-meter",
     "tier": "user",
     "hint": "auto mode on"
    },
    {
     "index": 6,
     "plugin": "engine",
     "tier": "core",
     "hint": "auto mode on"
    }
   ],
   "result": {
    "type": "engine",
    "keys": [
     "type",
     "ref"
    ]
   }
  },
  {
   "seq": 84,
   "columns": 95,
   "isWorking": true,
   "beneath": [
    {
     "index": 1,
     "plugin": "model-meter",
     "tier": "user",
     "hint": "1 shell · esc to interrupt · ↓ to manage"
    },
    {
     "index": 2,
     "plugin": "quick-peek",
     "tier": "user",
     "hint": "1 shell · esc to interrupt · ↓ to manage"
    },
    {
     "index": 3,
     "plugin": "image-preview",
     "tier": "user",
     "hint": "1 shell · esc to interrupt · ↓ to manage"
    },
    {
     "index": 4,
     "plugin": "sub-meter",
     "tier": "user",
     "hint": "1 shell · esc to interrupt · ↓ to manage"
    },
    {
     "index": 5,
     "plugin": "context-meter",
     "tier": "user",
     "hint": "1 shell · ↓ to manage"
    },
    {
     "index": 6,
     "plugin": "engine",
     "tier": "core",
     "hint": "1 shell · ↓ to manage"
    }
   ],
   "result": {
    "type": "engine",
    "keys": [
     "type",
     "ref"
    ]
   }
  },
  {
   "seq": 89,
   "columns": 95,
   "isWorking": false,
   "beneath": [
    {
     "index": 1,
     "plugin": "model-meter",
     "tier": "user",
     "hint": "1 shell · ↓ to manage"
    },
    {
     "index": 2,
     "plugin": "quick-peek",
     "tier": "user",
     "hint": "1 shell · ↓ to manage"
    },
    {
     "index": 3,
     "plugin": "image-preview",
     "tier": "user",
     "hint": "1 shell · ↓ to manage"
    },
    {
     "index": 4,
     "plugin": "sub-meter",
     "tier": "user",
     "hint": "1 shell · ↓ to manage"
    },
    {
     "index": 5,
     "plugin": "context-meter",
     "tier": "user",
     "hint": "1 shell · ↓ to manage"
    },
    {
     "index": 6,
     "plugin": "engine",
     "tier": "core",
     "hint": "1 shell · ↓ to manage"
    }
   ],
   "result": {
    "type": "engine",
    "keys": [
     "type",
     "ref"
    ]
   }
  }
 ],
 "render.SessionMode": [
  {
   "seq": 100,
   "columns": 95,
   "modes": [],
   "beneath": [
    {
     "index": 1,
     "plugin": "model-meter",
     "tier": "user"
    },
    {
     "index": 2,
     "plugin": "quick-peek",
     "tier": "user"
    },
    {
     "index": 3,
     "plugin": "image-preview",
     "tier": "user"
    },
    {
     "index": 4,
     "plugin": "sub-meter",
     "tier": "user"
    },
    {
     "index": 5,
     "plugin": "context-meter",
     "tier": "user"
    },
    {
     "index": 6,
     "plugin": "engine",
     "tier": "core"
    }
   ]
  }
 ],
 "classic": [
  {
   "seq": 4,
   "event": "classic.InstructionsLoaded"
  },
  {
   "seq": 5,
   "event": "classic.SessionStart"
  },
  {
   "seq": 18,
   "event": "classic.UserPromptSubmit",
   "permission_mode": "auto"
  },
  {
   "seq": 21,
   "event": "classic.MessageDisplay"
  },
  {
   "seq": 22,
   "event": "classic.Stop",
   "permission_mode": "auto"
  },
  {
   "seq": 76,
   "event": "classic.UserPromptSubmit",
   "permission_mode": "auto"
  },
  {
   "seq": 80,
   "event": "classic.PreToolUse"
  },
  {
   "seq": 82,
   "event": "classic.PostToolUse",
   "permission_mode": "auto"
  },
  {
   "seq": 83,
   "event": "classic.PostToolBatch",
   "permission_mode": "auto"
  },
  {
   "seq": 86,
   "event": "classic.MessageDisplay"
  },
  {
   "seq": 87,
   "event": "classic.Stop",
   "permission_mode": "auto"
  },
  {
   "seq": 91,
   "event": "classic.SubagentStop",
   "permission_mode": "auto"
  },
  {
   "seq": 98,
   "event": "classic.UserPromptSubmit",
   "permission_mode": "auto"
  },
  {
   "seq": 101,
   "event": "classic.PreToolUse"
  }
 ]
}
```

## Check after phase 2

Done at 95 columns with `sub-meter`, with no model turns and with `xhigh` effort stored. The badge shows in this state:

| Mode | Installed from the marketplace (model-meter beneath) | With `--plugin-dir` (above, the AC7 case) |
| --- | --- | --- |
| auto, at rest | `full` | `full` (before: `modelOnly` or nothing) |
| manual | `full` (`sub-meter` shrinks to `5h 13%`) | `modelOnly` |
| accept edits | `full` | `full` |
| plan | `full` | `full` |

- The rows are the footer as read; it never wraps or overlaps.
- In the `--plugin-dir` variant, the installed model-meter was disabled for that session only, with `--settings`.
- In a session's first seconds, while the `← for agents` pill shows, the badge may be smaller or not show, because that pill is measured too.

```text
  ⏵⏵ auto mode on ·                         ◆ Opus 5.5 ▮▮▮▮▯ xhi · 5h ━━━─────── 29% ↻ 4h 42m
  ⏵⏵ auto mode on · ← for agents        5h ━───────── 13% ↻ 4h 43m ·     ◆ Opus 5.5 ▮▮▮▮▯ xhi
```

With the padding at the end of the row when the badge has nothing beneath it (the Reviewer's decision), the second row becomes:

```text
  ⏵⏵ auto mode on ·                    week ━━──────── 24% ↻ 5d 9h · ◆ Opus 5.5 ▮▮▮▮▯ xhi
```
