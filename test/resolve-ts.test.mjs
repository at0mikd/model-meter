import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { pathToFileURL } from 'node:url'

import { CORE_URL, rewriteSpecifier } from './resolve-ts.mjs'

const core = (/** @type {string} */ file) => new URL(file, CORE_URL).href
const outside = pathToFileURL('/elsewhere/project/src/index.ts').href

/**
 * A file system holding exactly these core files.
 *
 * @param {string[]} files names under hooks/core/
 */
const holding = (files) => {
  const urls = new Set(files.map((file) => new URL(file, CORE_URL).href))
  return (/** @type {URL} */ url) => urls.has(url.href)
}

describe('rewriteSpecifier', () => {
  test('rewrites ./x.js to ./x.ts inside core when only the .ts exists', () => {
    const exists = holding(['state.ts', 'effort.ts'])
    assert.equal(rewriteSpecifier('./effort.js', core('state.ts'), exists), './effort.ts')
  })

  test('leaves a .js that exists alone', () => {
    const exists = holding(['state.ts', 'effort.ts', 'effort.js'])
    assert.equal(rewriteSpecifier('./effort.js', core('state.ts'), exists), undefined)
  })

  test('leaves a .js with no .ts beside it alone', () => {
    assert.equal(rewriteSpecifier('./missing.js', core('state.ts'), holding([])), undefined)
  })

  test('only acts for importers under hooks/core/', () => {
    const exists = () => true
    assert.equal(rewriteSpecifier('./effort.js', outside, exists), undefined)
    assert.equal(
      rewriteSpecifier('./effort.js', new URL('../register.tsx', CORE_URL).href, exists),
      undefined,
    )
    assert.equal(rewriteSpecifier('./effort.js', undefined, exists), undefined)
  })

  test('only rewrites relative specifiers that end in .js and stay inside core', () => {
    const exists = () => false
    const importer = core('state.ts')
    for (const specifier of [
      'node:fs',
      'fast-check',
      'claude-code',
      './effort.ts',
      './effort',
      '/abs/effort.js',
    ]) {
      assert.equal(
        rewriteSpecifier(specifier, importer, () => true),
        undefined,
        specifier,
      )
    }
    assert.equal(rewriteSpecifier('./effort.js', importer, exists), undefined)
    assert.equal(
      rewriteSpecifier('../register.js', importer, () => true),
      undefined,
    )
  })
})
