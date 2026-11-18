// Mod tests, run against the engine itself: `claude plugin test plugins/model-meter`
import { expect, test } from 'claude-code/testing'

// The skeleton registers no hooks, so what the engine draws in the footer
// reaches the screen untouched on every surface.
test('leaves the footer exactly as the engine draws it', async ($, on) => {
  on('ui.render', ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box key="engine" />
  })
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({
      plugin: 'model-meter',
      surface,
      component: 'SessionMode',
      props: { modes: [] },
    })
    expect(await ui.find({ key: 'engine' })).toBeDefined()
    await ui.unmount()
  }
})
