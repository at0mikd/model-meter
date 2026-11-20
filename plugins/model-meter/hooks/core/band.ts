// The 8-bit band above the prompt (docs/PLAN.md §3.2, §3.4): when it shows,
// and how much of it fits. The footer's badge is unaffected by any of it.

import type { Placement } from './options.ts'

/** Rows the band needs: below that it does not show (PLAN §3.4). */
export const BAND_MIN_ROWS = 6
/** In auto, how far under autoMinColumns the terminal may narrow before the band goes. */
export const AUTO_HYSTERESIS = 20

export interface BandRoom {
  placement: Placement
  autoMinColumns: number
  /** `viewport.columns`: the terminal's width, not the band's. */
  columns: number
  /** `AbovePrompt.props.maxRows`. */
  maxRows: number
  /** `AbovePrompt.props.hasSurvey`: a survey holds the band. */
  hasSurvey: boolean
  /** Auto's width state from the last call: whether the terminal counted as wide. */
  wide: boolean
}

export interface BandShow {
  show: boolean
  /** The width state to carry to the next call. */
  wide: boolean
}

/**
 * Whether the band shows. `footer` never, `band` always, `auto` while the
 * terminal is wide: from `autoMinColumns` on, and until it narrows under
 * `autoMinColumns − 20`, so a resize around one width does not flicker it.
 * Only with `maxRows ≥ 6` and no survey, in every placement. The width state
 * is the terminal's alone: a survey or a short band hides the band for a
 * while without resetting it.
 */
export function bandVisibility(room: BandRoom): BandShow {
  const { placement, autoMinColumns, columns, maxRows, hasSurvey } = room
  const floor = room.wide ? autoMinColumns - AUTO_HYSTERESIS : autoMinColumns
  const wide = columns > 0 && columns >= floor
  const fits = maxRows >= BAND_MIN_ROWS && !hasSurvey
  const wanted = placement === 'band' || (placement === 'auto' && wide)
  return { show: fits && wanted, wide }
}
