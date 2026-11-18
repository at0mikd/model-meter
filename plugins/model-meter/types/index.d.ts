// The mod's `$.state` contract. The skeleton (T-001) keeps no state yet; the
// hooks that add state declare its shape here.
declare module 'claude-code' {
  interface PluginState {
    'model-meter': Record<string, never>
  }
}
