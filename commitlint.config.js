import { isDependabotBump } from './scripts/commitlint-ignores.mjs'

export default {
  extends: ['@commitlint/config-conventional'],
  // Dependabot's "Bump …" subjects, and nothing else (T-008).
  ignores: [isDependabotBump],
}
