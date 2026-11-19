// Turns the model id the engine reports into a family and a short label:
// `claude-opus-5-5` → opus 5.5, in lowercase like the rest of the terminal
// footer. Known shapes are rebuilt from constants and
// digits; anything else is sanitized, so no engine text reaches the screen raw.

import { sanitize } from './sanitize.js'

export type Family = 'opus' | 'sonnet' | 'haiku' | 'fable' | 'unknown'

/** The families the badge knows, without `unknown`. */
export const FAMILIES = Object.freeze(['opus', 'sonnet', 'haiku', 'fable'] as const)

export interface ModelView {
  family: Family
  label: string
}

type Known = (typeof FAMILIES)[number]

const isKnown = (value: string): value is Known => (FAMILIES as readonly string[]).includes(value)
const isVersion = (value: string): boolean => /^\d{1,2}$/.test(value)

/** `[1m]` → `1m`: the context window suffix, when there is one. */
const CONTEXT = /\[(\d{1,3}[km])\]$/
/** Cloud wrappers: Bedrock `us.anthropic.` and `-v1:0`, Vertex `@20250805`, and dates. */
const REGION_PREFIX = /^[a-z]{2,8}\.anthropic\./
const VENDOR_PREFIX = /^anthropic\./
const BEDROCK_REVISION = /-v\d{1,3}:\d{1,3}$/
const BEDROCK_VERSION = /-v\d{1,3}$/
const VERTEX_DATE = /@\d{8}$/
const DATE = /-\d{8}$/

function label(family: Known, version: string[], context: string | undefined): string {
  const number = version.length === 0 ? '' : ` ${version.join('.')}`
  return `${family}${number}${context === undefined ? '' : ` ${context}`}`
}

/** `claude-opus-4-1` (current order) or `claude-3-5-sonnet` (older order) → family and version. */
function familyAndVersion(name: string): { family: Known; version: string[] } | undefined {
  if (isKnown(name)) return { family: name, version: [] }
  const [prefix, ...parts] = name.split('-')
  if (prefix !== 'claude' || parts.length < 2 || parts.length > 3) return undefined
  const [first, ...rest] = parts as [string, ...string[]]
  if (isKnown(first) && rest.every(isVersion)) return { family: first, version: rest }
  const last = parts.slice(-1).join('')
  const numbers = parts.slice(0, -1)
  if (isKnown(last) && numbers.every(isVersion)) return { family: last, version: numbers }
  return undefined
}

function unknown(id: string): ModelView {
  const text = sanitize(id, 16).toLowerCase()
  return { family: 'unknown', label: text === '' ? '?' : text }
}

/**
 * The family and label of a model id; never throws. A known label is at most
 * 18 columns (`sonnet 12.34 123k`); an unknown one, at most 16.
 */
export function parseModel(id: string): ModelView {
  if (typeof id !== 'string') return unknown('')
  let name = id.trim().toLowerCase()
  const context = CONTEXT.exec(name)?.[1]
  name = name
    .replace(CONTEXT, '')
    .replace(REGION_PREFIX, '')
    .replace(VENDOR_PREFIX, '')
    .replace(VERTEX_DATE, '')
    .replace(BEDROCK_REVISION, '')
    .replace(BEDROCK_VERSION, '')
    .replace(DATE, '')
  const known = familyAndVersion(name)
  return known === undefined
    ? unknown(id)
    : { family: known.family, label: label(known.family, known.version, context) }
}
