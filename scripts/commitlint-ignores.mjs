// Commits commitlint leaves out (T-008). Dependabot always writes its subject
// as "Bump …", capitalized, which subject-case refuses, and its prefixes come
// from .github/dependabot.yml: chore(deps), chore(deps-dev) and ci(deps).
// commitlint is a style gate, not a security one: anyone could copy the
// trailer, so a commit is left out only when its subject has Dependabot's
// exact shape AND it carries Dependabot's exact sign-off line.

const SUBJECT = /^(chore|ci)\((deps|deps-dev)\): Bump \S/
const TRAILER = 'Signed-off-by: dependabot[bot] <support@github.com>'

/**
 * Whether a commit message is a Dependabot bump: its first line shaped as
 * Dependabot writes it, and its exact sign-off line. Anything else, a value
 * that is not a string included, is false and is linted as any commit.
 *
 * @param {unknown} message
 * @returns {boolean}
 */
export function isDependabotBump(message) {
  if (typeof message !== 'string') return false
  // Anchored at the start and with no multiline flag, SUBJECT reads the
  // first line only: `\S` never matches the line break.
  return SUBJECT.test(message) && message.split(/\r?\n/).includes(TRAILER)
}
