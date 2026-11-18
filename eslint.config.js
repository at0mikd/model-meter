import js from '@eslint/js'
import { defineConfig } from 'eslint/config'
import security from 'eslint-plugin-security'
import tseslint from 'typescript-eslint'

export default defineConfig(
  {
    ignores: ['node_modules/', 'coverage/', 'spikes/', '**/.claude-plugin/types/'],
  },
  js.configs.recommended,
  security.configs.recommended,
  {
    // Pure core, its tests and repo scripts: type-aware rules over tsconfig.core.json.
    files: [
      'scripts/**/*.mjs',
      'test/**/*.mjs',
      'test/**/*.ts',
      'plugins/model-meter/hooks/core/**/*.ts',
    ],
    extends: [tseslint.configs.strictTypeChecked, tseslint.configs.stylisticTypeChecked],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.core.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // tsc (checkJs) already reports undefined names, with the real Node globals.
      'no-undef': 'off',
      // node:test runs and reports the promises its test() and describe() return.
      '@typescript-eslint/no-floating-promises': [
        'error',
        {
          allowForKnownSafeCalls: [
            { from: 'package', package: 'node:test', name: ['test', 'describe', 'it', 'suite'] },
          ],
        },
      ],
    },
  },
  {
    // Hooks run against the engine's types, which are not versioned: syntax-level
    // strict rules here, type checking through `claude plugin validate --strict`.
    files: ['plugins/model-meter/hooks/*.tsx'],
    extends: [tseslint.configs.strict, tseslint.configs.stylistic],
  },
  {
    // Config files at the root run in Node.
    files: ['*.js'],
    rules: {
      'no-undef': 'off',
    },
  },
)
