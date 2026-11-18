// Loaded with `node --import ./test/resolve-ts.mjs --test …` (npm run test:node).
//
// The pure core (plugins/model-meter/hooks/core/) imports its own modules as
// `./x.js`: the only value specifier that both the engine's TypeScript
// (validate --strict) and its loader accept. Node's type stripping does not
// map `.js` to `.ts`, so this hook does it, and nothing else: a relative
// `.js` specifier, imported from a file under hooks/core/, that resolves
// inside hooks/core/, where the `.js` does not exist and the `.ts` does.
// Everything else goes to Node's own resolution untouched (T-002, deviation
// accepted by the Reviewer on 2026-11-18).

import { existsSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { fileURLToPath } from 'node:url'

/** The pure core's folder, as a file URL ending in a slash. */
export const CORE_URL = new URL('../plugins/model-meter/hooks/core/', import.meta.url).href

/**
 * The `.ts` specifier to load instead of `specifier`, or undefined to leave it to Node.
 *
 * @param {string} specifier
 * @param {string | undefined} parentURL
 * @param {(url: URL) => boolean} exists
 * @returns {string | undefined}
 */
export function rewriteSpecifier(specifier, parentURL, exists) {
  if (!/^\.\.?\//.test(specifier) || !specifier.endsWith('.js')) return undefined
  if (parentURL?.startsWith(CORE_URL) !== true) return undefined
  const js = new URL(specifier, parentURL)
  if (!js.href.startsWith(CORE_URL) || exists(js)) return undefined
  const rewritten = `${specifier.slice(0, -'.js'.length)}.ts`
  return exists(new URL(rewritten, parentURL)) ? rewritten : undefined
}

/* c8 ignore start -- wiring into Node's loader; the rule above is what is tested */
registerHooks({
  resolve(specifier, context, nextResolve) {
    const rewritten = rewriteSpecifier(specifier, context.parentURL, (url) =>
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- rewriteSpecifier only asks about URLs it has confined to hooks/core/
      existsSync(fileURLToPath(url)),
    )
    return nextResolve(rewritten ?? specifier, context)
  },
})
/* c8 ignore stop */
