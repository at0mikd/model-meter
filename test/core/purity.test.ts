// CA1 of T-002: the pure core imports nothing but itself, the engine never sees
// a `.ts` value specifier, and no node:test file sits inside the plugin.

import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { describe, test } from 'node:test'

import ts from 'typescript'

const PLUGIN = new URL('../../plugins/model-meter/', import.meta.url)
const CORE = new URL('hooks/core/', PLUGIN)
const MODULES = ['effort', 'layout', 'model', 'sanitize', 'state']

interface Import {
  specifier: string
  typeOnly: boolean
}

/** Every import, export-from, dynamic import() and require() in a module's source. */
function importsIn(text: string): Import[] {
  const source = ts.createSourceFile('module.ts', text, ts.ScriptTarget.Latest, true)
  const found: Import[] = []
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      found.push({
        specifier: node.moduleSpecifier.text,
        typeOnly: node.importClause?.phaseModifier === ts.SyntaxKind.TypeKeyword,
      })
    } else if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier !== undefined &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      found.push({ specifier: node.moduleSpecifier.text, typeOnly: node.isTypeOnly })
    } else if (ts.isCallExpression(node)) {
      const callee = node.expression
      const isImport = callee.kind === ts.SyntaxKind.ImportKeyword
      const isRequire = ts.isIdentifier(callee) && callee.text === 'require'
      if (isImport || isRequire) {
        const [first] = node.arguments
        const specifier =
          first !== undefined && ts.isStringLiteral(first) ? first.text : '<computed>'
        found.push({ specifier, typeOnly: false })
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return found
}

const importsOf = (file: URL) => importsIn(readFileSync(file, 'utf8'))

/** Why an import of a core module is not allowed, or undefined when it is. */
function coreImportProblem({ specifier, typeOnly }: Import): string | undefined {
  if (!/^\.\/[a-z]+\.(?:js|ts)$/.test(specifier)) return 'only sibling core modules'
  if (!MODULES.includes(specifier.slice(2, -3))) return 'not a core module'
  if (specifier.endsWith('.ts') && !typeOnly) return 'a value import must use .js'
  return undefined
}

describe('the pure core (CA1)', () => {
  test('has the five modules, and nothing else', () => {
    const names = readdirSync(CORE).map((name) => name.replace(/\.ts$/, ''))
    assert.deepEqual(names.sort(), MODULES)
  })

  for (const name of MODULES) {
    test(`${name}.ts imports only sibling core modules, values as ./x.js`, () => {
      for (const found of importsOf(new URL(`${name}.ts`, CORE))) {
        assert.equal(coreImportProblem(found), undefined, `${name}.ts: "${found.specifier}"`)
      }
    })
  }

  test('the scan rejects claude-code, node:*, packages, .ts values and dynamic loads', () => {
    const scanned = importsIn(
      [
        "import type { A } from './effort.ts'",
        "import { b } from './effort.js'",
        "import { c } from './model.ts'",
        "import x from 'node:fs'",
        "export { d } from 'claude-code'",
        "import fc from 'fast-check'",
        "void import('./state.js')",
        "require('./layout.js')",
      ].join('\n'),
    )
    assert.deepEqual(
      scanned.map((found) => [found.specifier, coreImportProblem(found) ?? 'ok']),
      [
        ['./effort.ts', 'ok'],
        ['./effort.js', 'ok'],
        ['./model.ts', 'a value import must use .js'],
        ['node:fs', 'only sibling core modules'],
        ['claude-code', 'only sibling core modules'],
        ['fast-check', 'only sibling core modules'],
        ['./state.js', 'ok'],
        ['./layout.js', 'ok'],
      ],
    )
  })
})

describe('the plugin folder', () => {
  test('holds no file that imports node:*, so claude plugin test never loads a node:test file', () => {
    const files = readdirSync(PLUGIN, { recursive: true, encoding: 'utf8' })
      .filter(
        (path) => /\.[cm]?[jt]sx?$/.test(path) && !/[\\/]\.claude-plugin[\\/]types[\\/]/.test(path),
      )
      .map((path) => new URL(path, PLUGIN))
    assert.ok(files.length >= 7, 'the scan must see the hooks and the core')
    for (const file of files) {
      for (const { specifier } of importsOf(file)) {
        assert.ok(!specifier.startsWith('node:'), `${file.pathname} imports "${specifier}"`)
      }
    }
  })
})
