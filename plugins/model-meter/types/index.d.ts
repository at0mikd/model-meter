// The mod's `$.state` contract: exactly the keys it reads and writes, all its
// own (check-capabilities rejects any other, and any other plugin's state). The
// hint line's width is not here: it is measured while drawing, when the engine
// refuses state writes, so register.tsx keeps it in its own closure.
// Nothing here is drawn as is: ids and typed text go through parseModel,
// parseLevel or effortState first.
declare module 'claude-code' {
  interface PluginState {
    'model-meter': {
      /** The session's model id, as `$.session.model()` or the last main-thread `turn.step` gave it; null until read. */
      model: string | null
      /** `effort` of the last main-thread `turn.step`: a level, or a number in internal builds; null before any. */
      step: string | number | null
      /** The level `$.store` kept from an earlier session, validated with parseLevel; null when none. */
      stored: string | null
      /** What was typed after /effort, sanitized, until the next `turn.step`; null when nothing is pending. */
      pending: { args: string } | null
    }
  }
}
