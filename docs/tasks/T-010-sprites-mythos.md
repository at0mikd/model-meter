# T-010 · High-quality 8-bit sprites and the Mythos family

- **Status:** Done ([#27](https://github.com/at0mikd/model-meter/pull/27), `71d4031`)
- **Branch:** `feat/T-010-sprites-mythos`
- **Plan:** `docs/PLAN.md` §3.2; the Maintainer's decisions on T-004's sprites (2026-11-21)

## Goal

Replace T-004's sprites (4×8, one color) with 8-bit sprites of **12×12 pixels with 3 colors and transparency**, in the style of NES sprites. Also, recognize the **Mythos** family in the footer and the band.

**The Maintainer's decisions (2026-11-21):**

- A size of 12×12 (6 terminal rows), chosen over 16×16 so the band takes less height.
- Opus goes from a crown to a **chalice** with a red **ruby** set in gold.
- Fable goes from a book to a **Greek papyrus scroll**, as Aesop's fables were.
- The band's label reads `model Opus 5.5` instead of `player Opus 5.5`; `power` does not change.
- **Mythos** is added, with a sprite inspired by mythology: a **winged helmet**.
- The quality must match that of Claude's mascot, **without copying it or resembling it**: the designs are original.

## Starting data

- **A half cell with two colors.** A terminal cell is `▀` with `color` (the top pixel) and `backgroundColor` (the bottom pixel). `Text` takes both props, according to the CLI 2.1.327 types. A cell with a single pixel uses `▀` or `▄` with no background; an empty one, a space.
- **Colors:** fixed identity colors (hex), and the light detail with the key `text`. The Maintainer decided this on 2026-11-21, because in themes that follow the ANSI palette the theme keys collided.
  - `text` is light on the dark theme and dark on the light one. So the designs use it only for **fine details**: highlights, the snow, the scroll's writing, the helmet's brow.
  - Large surfaces use the family's color or the accent.
  - Preview with both themes: [`docs/assets/sprites-v2-preview.png`](../assets/sprites-v2-preview.png).
- **Mythos.** Model IDs according to Anthropic's documentation:
  - `claude-mythos-5`, the [Mythos 5 overview](https://platform.claude.com/docs/en/models/mythos-5/overview);
  - `claude-mythos-5-1`, the [Mythos 5.1 overview](https://platform.claude.com/docs/en/models/mythos-5-1/overview);
  - on Bedrock there is also `claude-mythos-preview` ([model card](https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-anthropic-claude-mythos-preview.html)).

## Scope

**In:**

1. **The `mythos` family** in the core (`model.ts`):
   - `claude-mythos-5` → `Mythos 5` and `claude-mythos-5-1` → `Mythos 5.1`;
   - `claude-mythos-preview` → `Mythos preview`, lowercase except the name;
   - the family color `planMode`;
   - the glyph `◆`, like the others.
2. **Sprites** in `sprite.ts`, with the grids below copied **verbatim**. Each grid has 12 rows of 12 characters:
   - `.` is transparent;
   - `1`, `2` and `3` are the color slots of the table.
3. **From pixels to cells,** as a pure function: two rows of pixels give one row of cells, each with its character, color and background. The hook only paints.
4. **Label:** `model` instead of `player`. Both labels, `model ` and `power `, have the same width (6), so the values line up.
5. **A band** of 6 rows by 12 columns:
   - `BAND_MIN_ROWS` stays at 6, the sprite's height;
   - the label goes beside the two middle rows;
   - the rest of T-004 (options, hysteresis and the order of the fit) does not change.

**Out:** configurable palettes, animations, and changes to the footer other than recognizing Mythos.

### Palette per sprite (fixed colors and `text`)

The review of #27 (the Maintainer's decision, 2026-11-21): the identity colors are fixed hex values, lowercase, in the form `#rrggbb`. Slot 3 stays the key `text`, except for Opus's ruby.

| Family | Motif | `1` | `2` | `3` |
| --- | --- | --- | --- | --- |
| Opus | chalice with a ruby | `#d77757` (cup) | `#f2c94c` (gold) | `#e0115f` (the ruby) |
| Sonnet | quill | `#b1b9f9` | `#f2c94c` | `text` |
| Haiku | mountain under the sun | `#4eba65` | `#f2c94c` | `text` |
| Fable | Greek papyrus scroll | `#af87ff` (papyrus) | `#d77757` (rollers) | `text` (writing and the rollers' shine) |
| Mythos | winged helmet | `#48968c` | `#f2c94c` | `text` |
| Unknown | empty cartridge | dimmed | dimmed | dimmed |

### Grids

**Opus — chalice with a ruby**

```text
............
.2222222222.
.2112332112.
.2112332112.
..21122112..
...222222...
.....22.....
.....22.....
....2222....
.....22.....
...222222...
..22222222..
```

**Sonnet — quill**

```text
........111.
.......11113
......1.113.
.....11113..
....1.113...
...11113....
...1.13.....
...113......
....3.......
...3........
..22........
.2..........
```

**Haiku — mountain under the sun**

```text
......2..2..
.......22...
......2222..
......2222..
.......22...
....3.2..2..
...333......
..33133.....
..1111113.3.
.11111111313
.11111111111
111111111111
```

**Fable — Greek papyrus scroll**

```text
............
.2........2.
232111111232
231111111132
231313313132
231111111132
231331331132
231111111132
231313133132
232111111232
.2........2.
............
```

**Mythos — winged helmet**

```text
....2222....
...222222...
...111111...
..13333331..
2.11111111.2
221......122
2.111..111.2
.2111..1112.
..111..111..
...11..11...
............
............
```

**Unknown — empty cartridge**

```text
............
.1111111111.
.1333333331.
.13......31.
.13......31.
.1333333331.
.1111111111.
.1.1.11.1.1.
.1111111111.
............
............
............
```

## Acceptance criteria

- **AC1** — Core tests of Mythos:
  - the three IDs with their labels;
  - the family color;
  - a similar but invalid ID stays unknown, for example `claude-mythos-x`.
- **AC2** — Core tests of the sprites:
  - 12×12;
  - at most 3 slots, plus transparency;
  - the six grids all different, and identical to this task's;
  - the unknown one, dimmed.
- **AC3** — Core tests of the conversion to cells: the four combinations of two pixels (empty/empty, color/empty, empty/color and color/color) give the expected character, color and background.
- **AC4** — Mod tests:
  - the band draws 6 rows;
  - with `maxRows` 5 it does not show, and with 6 it does;
  - with Mythos, the footer reads `Mythos 5.1` in `planMode`;
  - the label reads `model Opus 5.5` and `power ▮▮▮▯▯ high`;
  - T-004's tests and the footer's stay green.
- **AC5** — `capabilities` green, with the same `$` calls. `npm run check` green.
- **AC6** — PLAN §3.2, the mod's README and the CHANGELOG up to date.
- **AC7** — Screenshots by the Maintainer of the band at full screen, of at least Opus and Fable (Mythos only with access to it). The Maintainer gives the final approval of the look.

## Security constraints

- The sprites and the palette are constants in the code: fixed hex values and the key `text`, which the engine translates for the terminal. No escape sequences of our own are ever written, and no color depends on any input.
- No new `$` calls and no new dependencies.
- Mythos is recognized with the same strict ID validation as the other families: any other text stays unknown and is sanitized the same way.

## Required evidence

- The output of `npm run check` and `npm run capabilities`.
- A text sample of the band.
- The AC7 screenshots.
