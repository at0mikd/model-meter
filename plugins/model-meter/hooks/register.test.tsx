// Mod tests, run against the engine itself: `claude plugin test plugins/model-meter`
import { describe, expect, test } from 'claude-code/testing'
import type { Engine, Plugin } from 'claude-code/testing'
import type { CommandRunInput, ConfigSetInput, On } from 'claude-code'

const OPUS = 'claude-opus-5-5'
const SONNET = 'claude-sonnet-5-5'
// SessionMode's own labels, at the right end of the footer (the permission mode's is at the left).
const MODES = ['focus']
const SHELL = '1 shell · ↓ to manage'
const WORKING = 'esc to interrupt'
const BENEATH = 'x'.repeat(30) // another mod's drawing beneath, 30 columns

interface World {
  /** What `$.session.model()` answers beneath the mod. */
  model: string
  /** Each /model or /effort as it reached the engine. */
  configs: ConfigSetInput[]
  commands: CommandRunInput[]
  /** What the store holds, and every value written to it. */
  store: Map<string, unknown>
  writes: unknown[]
}

/** Everything beneath the mod: the session's model, a store, the engine's footer and commands. */
function world(
  on: On,
  options: { stored?: unknown; beneath?: string; model?: string; modelFails?: boolean } = {},
): World {
  const w: World = {
    model: options.model ?? OPUS,
    configs: [],
    commands: [],
    store: new Map(options.stored === undefined ? [] : [['effort', options.stored]]),
    writes: [],
  }
  on('store.get', ($, e) => ({ value: w.store.get(e.key) }))
  on('store.set', ($, e) => {
    w.writes.push(e.value)
    w.store.set(e.key, e.value)
    return { value: undefined }
  })
  on('session.model', () => {
    if (options.modelFails === true) throw new Error('injected: no model')
    return { value: w.model }
  })
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('classic.SessionStart', () => ({}))
  on('config.set', ($, e) => {
    w.configs.push(e)
    if (e.key === 'model') w.model = SONNET
    return { value: e.value }
  })
  on('command.run', ($, e) => {
    w.commands.push(e)
    return { text: `ran ${e.command} ${e.args}` }
  })
  // A stream event is hooked with a generator; the model call here streams nothing.
  // eslint-disable-next-line require-yield
  on('turn.step', async function* ($, e) {
    return {
      turnId: e.turnId,
      index: e.index,
      answer: '',
      toolUses: [],
      stopReason: 'end_turn',
      usage: null,
    }
  })
  // The engine's own drawing of each site; with `beneath`, another mod's before the modes.
  on('ui.render', ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    if (e.component === 'SessionMode') {
      return (
        <Box key="engine">
          {options.beneath === undefined ? null : <Text>{options.beneath}</Text>}
          {e.props.modes.length === 0 ? null : <Text>{e.props.modes.join(' & ')}</Text>}
        </Box>
      )
    }
    return <Text>{'hint' in e.props ? e.props.hint : ''}</Text>
  })
  return w
}

const start = ($: Engine) =>
  $.session.start({ cwd: '/project', surface: 'terminal', isInteractive: true })

/** One model call, run to its end as the engine runs it. */
async function turn(
  $: Engine,
  effort: 'low' | 'medium' | 'high' | 'xhigh' | 'max' | number | undefined,
  agentId?: string,
) {
  const stream = $.turn.step({
    turnId: 't',
    index: 0,
    model: OPUS,
    messageCount: 1,
    ...(effort === undefined ? {} : { effort }),
    ...(agentId === undefined ? {} : { agentId }),
  })
  for await (const chunk of stream) void chunk
  return stream.result
}

const footer = ($: Engine, columns = 191, surface: 'terminal' | 'desktop' = 'terminal') =>
  $.ui.mount({
    plugin: 'model-meter',
    surface,
    component: 'SessionMode',
    props: { modes: MODES },
    viewport: { columns, rows: 47 },
  })

const hintLine = ($: Engine, hint: string, surface: 'terminal' | 'desktop' = 'terminal') =>
  $.ui.mount({
    plugin: 'model-meter',
    surface,
    component: 'PromptHint',
    props: { isDraft: false, isWorking: hint === WORKING, hint },
    viewport: { columns: 191, rows: 47 },
  })

/** All the text a drawing holds, in order. */
function textOf(node: unknown): string {
  if (typeof node === 'string') return node
  if (typeof node !== 'object' || node === null) return ''
  const { children } = node as { children?: unknown }
  return Array.isArray(children) ? children.map(textOf).join('') : ''
}

/** The text of a mounted drawing, as the surface draws it now. */
const shown = async (ui: { drawn: () => Promise<unknown> }) => textOf(await ui.drawn())

describe('the badge on the terminal (CA1)', () => {
  test('at session start: the model, and the stored effort dimmed as previous', async ($, on) => {
    world(on, { stored: 'medium' })
    await start($)
    const ui = await footer($)
    expect(await shown(ui)).toContain('◆ Opus 5.5 ▮▮▯▯▯ med · ')
    expect((await ui.find({ type: 'Text', text: '◆ Opus 5.5' }))?.props).toMatchObject({
      color: 'claude',
    })
    expect((await ui.find({ type: 'Text', text: 'med' }))?.props).toMatchObject({ dimColor: true })
  })

  test('a main-thread turn.step lights the effort and keeps it; a subagent turn.step does not', async ($, on) => {
    const w = world(on)
    await start($)
    const ui = await footer($)
    await turn($, 'max', 'agent-1')
    expect(await shown(ui)).toContain('◆ Opus 5.5 ░░░░░ ---')
    await turn($, 'high')
    expect(await shown(ui)).toContain('◆ Opus 5.5 ▮▮▮▯▯ high')
    expect((await ui.find({ type: 'Text', text: 'high' }))?.props.dimColor).toBeUndefined()
    expect(w.store.get('effort')).toBe('high')
  })

  test('/model refreshes the model at once', async ($, on) => {
    world(on)
    await start($)
    const ui = await footer($)
    await $.config.set({
      key: 'model',
      value: 'sonnet',
      previous: 'opus',
      provider: { plugin: 'core', tier: 'core' },
      origin: { kind: 'composer' },
    })
    expect(await shown(ui)).toContain('◆ Sonnet 5.5')
    expect((await ui.find({ type: 'Text', text: '◆ Sonnet 5.5' }))?.props).toMatchObject({
      color: 'suggestion',
    })
  })

  test('/effort high shows as pending, and the next turn.step confirms it', async ($, on) => {
    world(on)
    await start($)
    await turn($, 'low')
    const ui = await footer($)
    await $.command.run({
      command: 'effort',
      args: 'high',
      origin: { kind: 'composer' },
      presentation: { isFullscreen: false, columns: 191 },
    })
    expect(await shown(ui)).toContain('◆ Opus 5.5 ▮▮▮▯▯ high…')
    expect((await ui.find({ type: 'Text', text: 'high…' }))?.props).toMatchObject({
      dimColor: true,
    })
    await turn($, 'high')
    expect(await shown(ui)).toContain('▮▮▮▯▯ high · ')
  })

  test('an unknown model shows as ? and dimmed', async ($, on) => {
    world(on, { model: 'gpt-x' })
    await start($)
    const ui = await footer($)
    expect((await ui.find({ type: 'Text', text: '? gpt-x' }))?.props).toMatchObject({
      dimColor: true,
    })
  })

  test('a /clear forgets the last turn but not the stored level', async ($, on) => {
    world(on)
    await start($)
    await turn($, 'high')
    const ui = await footer($)
    await $.classic.SessionStart({ source: 'clear' })
    expect(await shown(ui)).toContain('◆ Opus 5.5 ▮▮▮▯▯ high')
    expect((await ui.find({ type: 'Text', text: 'high' }))?.props).toMatchObject({ dimColor: true })
  })
})

describe('the off look of what is missing (CA1b, PLAN §3.1.1)', () => {
  test('before the model is read and with no effort, the whole badge is off', async ($, on) => {
    world(on)
    const ui = await footer($)
    expect(await shown(ui)).toContain('◇ ----- ░░░░░ ---')
    expect((await ui.find({ type: 'Text', text: '◇ -----' }))?.props).toMatchObject({
      dimColor: true,
    })
  })

  test('the first badge of a session with nothing stored is partial, then active with the first turn.step', async ($, on) => {
    world(on)
    await start($)
    const ui = await footer($)
    const before = await shown(ui)
    expect(before).toContain('◆ Opus 5.5 ░░░░░ ---')
    await turn($, 'medium')
    const after = await shown(ui)
    expect(after).toContain('◆ Opus 5.5 ▮▮▯▯▯ med')
    // Lighting a part never moves the badge: the same columns before and after.
    expect(after.indexOf(' · ')).toBe(before.indexOf(' · '))
  })
})

describe('other surfaces (CA2)', () => {
  test('on desktop the footer and the hint are exactly what the engine draws', async ($, on) => {
    world(on, { stored: 'high' })
    await start($)
    await turn($, 'high')
    const ui = await footer($, 191, 'desktop')
    expect(await ui.drawn()).toMatchObject({
      type: 'Box',
      children: [{ type: 'Text', children: [MODES[0]] }],
    })
    expect(await shown(ui)).toBe(MODES[0])
    const hint = await hintLine($, SHELL, 'desktop')
    expect(await shown(hint)).toBe(SHELL)
  })
})

describe('/model and /effort reach the engine untouched (CA3)', () => {
  test('/effort high goes on as typed, even when the mod fails to record it', async ($, on) => {
    const w = world(on)
    on('state.set', () => {
      throw new Error('injected: the state cannot be written')
    })
    const result = await $.command.run({
      command: 'effort',
      args: 'high',
      origin: { kind: 'composer' },
      presentation: { isFullscreen: false, columns: 95 },
    })
    expect(result.text).toBe('ran effort high')
    expect(w.commands).toHaveLength(1)
    expect(w.commands[0]).toMatchObject({ command: 'effort', args: 'high' })
  })

  test('/model goes through, even when reading the new model fails', async ($, on) => {
    const w = world(on, { modelFails: true })
    const result = await $.config.set({
      key: 'model',
      value: 'sonnet',
      previous: 'opus',
      provider: { plugin: 'core', tier: 'core' },
      origin: { kind: 'composer' },
    })
    expect(result).toEqual({ value: 'sonnet' })
    expect(w.configs).toHaveLength(1)
    expect(w.configs[0]).toMatchObject({ key: 'model', value: 'sonnet', previous: 'opus' })
  })

  test('the hint line is drawn as the engine drew it', async ($, on) => {
    world(on)
    const hint = await hintLine($, SHELL)
    expect(await shown(hint)).toBe(SHELL)
  })
})

describe('the badge fits the row (CA4)', () => {
  /** Which size of the badge a drawing shows. */
  function variantOf(text: string): string {
    if (!text.includes('◆ Opus 5.5')) return 'none'
    if (/[▮▯░]/.test(text)) return 'full'
    return /high|---/.test(text) ? 'noMeter' : 'modelOnly'
  }

  // The row: 4 of padding, 26 for the permission mode's label, the hint (and a
  // space), 2 of gap, ' · ' and what is beneath ('focus', plus 30 of another mod).
  const cases: [columns: number, hint: string, beneath: string | undefined, expected: string][] = [
    [95, '', undefined, 'full'],
    [95, SHELL, undefined, 'full'],
    [95, WORKING, undefined, 'full'],
    [95, '', BENEATH, 'full'],
    [95, SHELL, BENEATH, 'none'], // 3 columns left: the badge gives way, all the rest stays
    [95, WORKING, BENEATH, 'none'], // 8 left
    [191, '', undefined, 'full'],
    [191, SHELL, BENEATH, 'full'],
    [191, WORKING, BENEATH, 'full'],
  ]
  for (const [columns, hint, beneath, expected] of cases) {
    test(`${String(columns)} columns, hint "${hint}", ${beneath === undefined ? 'nothing' : '30 columns'} beneath → ${expected}`, async ($, on) => {
      world(on, { beneath })
      await start($)
      await turn($, 'high')
      await hintLine($, hint)
      const text = await shown(await footer($, columns))
      expect(variantOf(text)).toBe(expected)
      // What is beneath is never lost.
      expect(text).toContain(MODES[0])
      if (beneath !== undefined) expect(text).toContain(beneath)
    })
  }

  test("leaves room for the permission mode's label at the left, which no site exposes", async ($, on) => {
    world(on)
    await start($)
    await turn($, 'high')
    // Padding 4 + label 26 + gap 2 + ' · focus' 8 = 40: full needs 64 columns, not 38.
    expect(variantOf(await shown(await footer($, 64)))).toBe('full')
    expect(variantOf(await shown(await footer($, 63)))).toBe('noMeter')
    expect(variantOf(await shown(await footer($, 51)))).toBe('none')
  })

  test('narrowing the row gives up the meter, then the effort, then the badge, in that order', async ($, on) => {
    world(on, { beneath: BENEATH })
    await start($)
    await turn($, 'high')
    await hintLine($, SHELL)
    const seen: string[] = []
    for (const columns of [191, 116, 115, 110, 109, 104, 103, 60]) {
      const text = await shown(await footer($, columns))
      seen.push(variantOf(text))
      expect(text).toContain(BENEATH)
      expect(text).toContain(MODES[0])
    }
    expect(seen).toEqual([
      'full',
      'full',
      'noMeter',
      'noMeter',
      'modelOnly',
      'modelOnly',
      'none',
      'none',
    ])
  })
})

// T-003b: the hint is measured as it is drawn, not as it reaches this mod.
describe('the hint as drawn, wherever another mod trims it (T-003b CA2)', () => {
  // At rest in auto mode the engine hands down `(shift+tab to cycle)` and
  // sub-meter hides it, so nothing of it is drawn (docs/spikes/T-003b-results.md).
  const REST = '(shift+tab to cycle)'
  /** A mod that hides that part of the hint on its way down, as sub-meter does. */
  const trimmer = (tier: 'prepend' | 'append'): Plugin => ({
    name: `trimmer-${tier}`,
    tier,
    register(on) {
      on('ui.render', { component: 'PromptHint' }, ($, e, next) =>
        next({
          ...e,
          props: { ...e.props, hint: e.props.hint.replace('(shift+tab to cycle)', '').trim() },
        }),
      )
    },
  })
  const has = (text: string, size: 'full' | 'none') =>
    size === 'full' ? /◆ Opus 5\.5 ▮▮▮▯▯ high/.test(text) : !text.includes('◆')

  // Padding 4 + label 26 + gap 2 + ' · focus' 8 (+ 30 beneath): drawn, the
  // hint takes nothing; received, 21 more. Only 95 columns with 30 beneath
  // tells them apart: 25 left for the badge, or 4.
  const cases: [
    columns: number,
    beneath: string | undefined,
    tier: 'prepend' | 'append' | undefined,
    expected: 'full' | 'none',
  ][] = [
    [95, undefined, 'append', 'full'],
    [95, undefined, 'prepend', 'full'],
    [95, undefined, undefined, 'full'],
    [95, BENEATH, 'append', 'full'],
    [95, BENEATH, 'prepend', 'full'],
    [95, BENEATH, undefined, 'none'],
    [191, undefined, 'append', 'full'],
    [191, undefined, 'prepend', 'full'],
    [191, undefined, undefined, 'full'],
    [191, BENEATH, 'append', 'full'],
    [191, BENEATH, 'prepend', 'full'],
    [191, BENEATH, undefined, 'full'],
  ]
  for (const [columns, beneath, tier, expected] of cases) {
    const where =
      tier === undefined
        ? 'nobody trims the hint'
        : `a mod ${tier === 'append' ? 'beneath' : 'above'} trims it`
    test(
      `${String(columns)} columns, ${beneath === undefined ? 'nothing' : '30 columns'} beneath, ${where} → ${expected}`,
      { plugins: tier === undefined ? [] : [trimmer(tier)] },
      async ($, on) => {
        world(on, { beneath })
        await start($)
        await turn($, 'high')
        const hint = await hintLine($, REST)
        // The line is drawn as the mods beneath and the engine leave it.
        expect(await shown(hint)).toBe(tier === undefined ? REST : '')
        const text = await shown(await footer($, columns))
        expect(has(text, expected)).toBe(true)
        expect(text).toContain(MODES[0])
        if (beneath !== undefined) expect(text).toContain(beneath)
      },
    )
  }
})

describe('$.store holds a level and nothing else (CA5)', () => {
  test('a level is written only when it changes', async ($, on) => {
    const w = world(on, { stored: 'medium' })
    await start($)
    await turn($, 'medium')
    expect(w.writes).toEqual([])
    await turn($, 'high')
    await turn($, 'high')
    expect(w.writes).toEqual(['high'])
    await turn($, 'max')
    expect(w.writes).toEqual(['high', 'max'])
  })

  test('only levels reach the store: a numeric effort does not', async ($, on) => {
    const w = world(on)
    await start($)
    await turn($, 42)
    await turn($, undefined)
    expect(w.writes).toEqual([])
    await turn($, 'max')
    await turn($, 'low')
    expect(w.writes).toEqual(['max', 'low'])
  })

  test('a corrupt stored value is unknown: the effort shows off', async ($, on) => {
    world(on, { stored: { level: 'high', hack: '\u001b[31m' } })
    await start($)
    const ui = await footer($)
    expect(await shown(ui)).toContain('◆ Opus 5.5 ░░░░░ ---')
  })
})
