import type { EngineInterface, Register } from 'claude-code'

const log: unknown[] = []
const push = (kind: string, data: unknown) => {
  log.push({ kind, at: log.length, data })
  if (log.length > 200) log.shift()
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

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await snapshot($, 'session.start')
    await $.tool.register({
      name: 'report',
      description: 'Spike: returns what the wic-spike mod observed (model, effort, viewport).',
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
    push('command.run', { keys: Object.keys(e), name: (e as { name?: unknown }).name })
    return next(e)
  })

  on('ui.render', { component: 'SessionMode' }, ($, e, next) => {
    push('render.SessionMode', { surface: e.surface, viewport: e.viewport, modes: e.props.modes })
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, ($, e, next) => {
    push('render.AbovePrompt', { surface: e.surface, viewport: e.viewport, bodyColumns: e.props.bodyColumns, maxRows: e.props.maxRows })
    return next(e)
  })

  on('tool.run', { tool: 'mcp__wic-spike__report' }, async ($, e, next) => {
    await snapshot($, 'report')
    const text = JSON.stringify(log, null, 1).slice(-20000)
    return { result: text, text }
  })
}
