// Text from the engine or the person never reaches the screen as is: it keeps
// only `[A-Za-z0-9.\-[\] @/_]`, so no control, escape, bidi or wide character
// can move the cursor, restyle the terminal or spoof what is drawn.

const ESC = 0x1b
const CSI_8BIT = 0x9b
const BEL = 0x07

/** Is this code unit allowed on screen? */
function isAllowed(code: number): boolean {
  return (
    (code >= 0x30 && code <= 0x39) || // 0-9
    (code >= 0x41 && code <= 0x5a) || // A-Z
    (code >= 0x61 && code <= 0x7a) || // a-z
    code === 0x20 || // space
    code === 0x2e || // .
    code === 0x2d || // -
    code === 0x5b || // [
    code === 0x5d || // ]
    code === 0x40 || // @
    code === 0x2f || // /
    code === 0x5f // _
  )
}

/**
 * Where an escape sequence that starts at `start` ends (exclusive): CSI runs
 * to its final byte (0x40–0x7e), OSC/DCS/PM/APC to BEL or ESC \, and any other
 * ESC takes one more character. A sequence left open swallows the rest.
 */
function skipEscape(text: string, start: number): number {
  const head = text.charCodeAt(start)
  const next = text.charAt(start + 1)
  if (head === CSI_8BIT || next === '[') {
    let i = start + (head === CSI_8BIT ? 1 : 2)
    while (i < text.length) {
      const code = text.charCodeAt(i)
      i += 1
      if (code >= 0x40 && code <= 0x7e) return i
    }
    return i
  }
  if (next === ']' || next === 'P' || next === '^' || next === '_') {
    let i = start + 2
    while (i < text.length) {
      const code = text.charCodeAt(i)
      if (code === BEL) return i + 1
      if (code === ESC && text.charAt(i + 1) === '\\') return i + 2
      i += 1
    }
    return i
  }
  return Math.min(start + 2, text.length)
}

/**
 * Keeps the allowed characters of `text`, with line breaks and tabs as
 * spaces, runs of spaces collapsed, trimmed, and cut to `max` (whole, at
 * least 0). Never throws: anything that is not a string gives ''.
 */
export function sanitize(text: string, max = 32): string {
  if (typeof text !== 'string') return ''
  const limit = Number.isFinite(max) ? Math.max(0, Math.floor(max)) : 0
  let kept = ''
  let i = 0
  while (i < text.length) {
    const code = text.charCodeAt(i)
    if (code === ESC || code === CSI_8BIT) {
      i = skipEscape(text, i)
      continue
    }
    i += 1
    if (code === 0x0a || code === 0x0d || code === 0x09) kept += ' '
    else if (isAllowed(code)) kept += String.fromCharCode(code)
  }
  return kept.replace(/ {2,}/g, ' ').trim().slice(0, limit).trimEnd()
}
