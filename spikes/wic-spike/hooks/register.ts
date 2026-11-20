import type { EngineInterface, Register } from 'claude-code'

// One small ring buffer per event kind, so frequent renders never evict
// the rare events (config.set, command.run) the spike exists to catch.
const PER_KIND = 40
const logs = new Map<string, unknown[]>()
const lastRender = new Map<string, string>()
let seq = 0

const push = (kind: string, data: unknown) => {
  const list = logs.get(kind) ?? []
  list.push({ seq: seq++, data })
  if (list.length > PER_KIND) list.shift()
  logs.set(kind, list)
}

// Renders are recorded only when what they report changes.
const pushRender = (kind: string, data: unknown) => {
  const key = JSON.stringify(data)
  if (lastRender.get(kind) === key) return
  lastRender.set(kind, key)
  push(kind, data)
}

async function snapshot ($: EngineInterface, kind: string) {
  const [model, effortSetting, envEffort, envEffort2] = await Promise.all([
    $.session.model().catch(err => `ERR ${String(err)}`),
    $.settings.read({ key: 'effortLevel' }).catch(err => `ERR ${String(err)}`),
    $.env.get('CLAUDE_CODE_EFFORT_LEVEL').catch(err => `ERR ${String(err)}`),
    $.env.get('CLAUDE_EFFORT').catch(err => `ERR ${String(err)}`)
  ])
  push(kind, { model, effortSetting, envEffort, envEffort2 })
}

// T-003b: what a drawing is, read structurally and cut short, so the report
// says whether next(e) is the engine's own node or a tree with text.
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const short = (value: unknown): unknown =>
  typeof value === 'string' ? value.slice(0, 120)
    : Array.isArray(value) ? `array(${value.length})`
      : isRecord(value) ? `object(${Object.keys(value).slice(0, 8).join(',')})`
        : value

function shape (node: unknown, depth = 0): unknown {
  if (typeof node === 'string') return node.slice(0, 120)
  if (!isRecord(node)) return node === undefined ? null : short(node)
  if (depth > 5) return '…'
  const props = isRecord(node.props) ? node.props : {}
  return {
    type: typeof node.type === 'string' ? node.type : typeof node.type,
    keys: Object.keys(node).slice(0, 12),
    props: Object.fromEntries(Object.entries(props).slice(0, 12).map(([key, value]) => [key, short(value)])),
    children: Array.isArray(node.children) ? node.children.slice(0, 12).map(child => shape(child, depth + 1)) : undefined
  }
}

const propsOf = (received: unknown): Record<string, unknown> =>
  isRecord(received) && isRecord(received.props) ? received.props : {}

interface Link { index: number, plugin: string, tier: string, outcome: string, received: unknown, returned: unknown }

// The links beneath this hook, nearest first and the engine last: who they
// are, in which tier, and the props each one received (P1, P2).
const chain = (trace: readonly Link[], pick: (props: Record<string, unknown>) => unknown) =>
  trace.map(link => ({
    index: link.index,
    plugin: link.plugin,
    tier: link.tier,
    outcome: link.outcome,
    received: pick(propsOf(link.received)),
    returned: link.plugin === 'engine' ? undefined : shape(link.returned)
  }))

const hintProps = (props: Record<string, unknown>) =>
  ({ hint: props.hint, tail: props.tail, isDraft: props.isDraft, isWorking: props.isWorking })

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await snapshot($, 'session.start')
    await $.tool.register({
      name: 'report',
      description: 'Spike: returns what the wic-spike mod observed (model, effort, viewport, footer hooks, permission mode).',
      isDeferred: false
    })
    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    await snapshot($, 'prompt.submit')
    return next(e)
  })

  on('turn.step', async function* ($, e, next) {
    push('turn.step', { agentId: e.agentId, model: e.model, effort: e.effort, index: e.index })
    return yield* next(e)
  })

  on('config.set', ($, e, next) => {
    push('config.set', { key: e.key, value: e.value, previous: e.previous })
    return next(e)
  })

  on('command.run', ($, e, next) => {
    push('command.run', { keys: Object.keys(e), command: (e as { command?: unknown }).command })
    return next(e)
  })

  // T-003b P3: which classic events carry permission_mode, and when. Observe
  // only: each one goes on as it came, also when this hook fails.
  on('classic.*', async ($, e, next) => {
    push(String(next.event), { permission_mode: (e as { permission_mode?: unknown }).permission_mode })
    return next(e)
  }).catch(($, e, next) => next(e))

  // T-003b P1, P2: the hint as this hook receives it and as each link beneath
  // received it (the engine's entry is what it draws), and what next(e) is.
  on('ui.render', { component: 'PromptHint' }, async ($, e, next) => {
    const result = await next(e)
    pushRender('render.PromptHint', {
      surface: e.surface,
      columns: e.viewport?.columns,
      own: hintProps(e.props),
      beneath: chain(next.trace as readonly Link[], hintProps),
      result: shape(result)
    })
    return result
  })

  on('ui.render', { component: 'SessionMode' }, async ($, e, next) => {
    const result = await next(e)
    pushRender('render.SessionMode', {
      surface: e.surface,
      viewport: e.viewport,
      modes: e.props.modes,
      beneath: chain(next.trace as readonly Link[], props => ({ modes: props.modes })),
      result: shape(result)
    })
    return result
  })

  on('ui.render', { component: 'AbovePrompt' }, ($, e, next) => {
    pushRender('render.AbovePrompt', { surface: e.surface, viewport: e.viewport, bodyColumns: e.props.bodyColumns, maxRows: e.props.maxRows })
    return next(e)
  })

  on('tool.run', { tool: 'mcp__wic-spike__report' }, async ($, e, next) => {
    await snapshot($, 'report')
    // Whole entries only, so the report is always parseable JSON.
    const text = JSON.stringify(Object.fromEntries(logs))
    return { result: text, text }
  })
}
