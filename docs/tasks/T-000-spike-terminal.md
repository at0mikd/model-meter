# T-000 · Terminal spike: `/model`, `/effort` and the footer's width

- **Status:** Done ([#2](https://github.com/at0mikd/model-meter/pull/2))
- **Branch:** `spike/T-000-terminal`
- **Plan:** `docs/PLAN.md` §2.4

## Goal

Answer, with real data from a terminal, the two unknowns the cloud session cannot observe:

- whether a change with `/model` or `/effort` reaches the mod before the next turn;
- how much width is left in the footer (`SessionMode`) next to other mods such as `sub-meter`.

## Scope

**In:** run the `spikes/wic-spike` spike locally, collect its report and document it.

**Out:**

- product code;
- changes to the plan, which the Reviewer proposes after reading the data;
- new capabilities: the spike may only be touched to add observations, never capabilities beyond those it already uses.

## Procedure

1. Run `claude --plugin-dir spikes/wic-spike` in a terminal **at half screen**, with `sub-meter` active.
2. Send any prompt and wait for the answer.
3. Run `/model` and change the model, then `/effort` and change the level. **Do not send a prompt yet.**
4. Ask "call the report tool of wic-spike". That is a turn, so note that the report includes the events before it.
5. Maximize the terminal to **full screen**, send another prompt, and ask for the report again.
6. For the pass **without** `sub-meter`, disable it temporarily in `/plugin`, repeat steps 1–5, and enable it again afterwards.
7. Claude Code's fullscreen mode: look for it in `/config` or in your version's documentation.
   - If it exists, repeat step 1 in that mode and note `viewport.isFullscreen`.
   - If you cannot find it within 10 minutes, mark AC4 as N/A with what you searched.

The report (`report`) returns complete, parseable JSON, grouped by event type: up to 40 entries per type, and renders are recorded only when they change. So the `/model` and `/effort` events are not lost among redraws.

## Acceptance criteria

- **AC1** — It is known whether `/model` produces any event (`config.set`, `command.run`, `prompt.submit`, a render) before the next `turn.step`, and with which data.
- **AC2** — The same for `/effort`, including whether `$.settings.read({ key: 'effortLevel' })` changes after using it.
- **AC3** — `viewport.columns` and `rows` recorded at half screen and at full screen, with and without `sub-meter`.
- **AC4** — The value of `viewport.isFullscreen` in a normal terminal and in Claude Code's fullscreen mode.
- **AC5** — Claude Code's version and the operating system and terminal emulator recorded.

## Security constraints

- Review the report before publishing it: it may contain only model names, levels, events and sizes. Remove any path, user name, prompt or personal data.
- The spike is never published or imported by the product.

## Required evidence

A pull request with `docs/spikes/T-000-results.md`, containing the sanitized JSON reports and a table with the answer to each AC.
