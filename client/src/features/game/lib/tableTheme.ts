/**
 * Viewer-relative team theming for the in-game canvas.
 *
 * The server thinks in absolute teams (teamA = seats 0,2 / teamB = seats 1,3),
 * but the table is drawn from the *viewer's* perspective: the viewer's own team
 * always reads as Gold ("Us"); the other team always reads as Silver ("Them").
 * This module is the single rule that converts (seat, viewerSeat) into the
 * gold/silver visual identity used by avatar frames, score-row dots, name
 * pills, and overlay glows.
 *
 * Lime / urgent-red are independent of team identity — they belong to the
 * "turn / action" channel (active player's countdown ring, timer text,
 * playable card halo, Belot border).
 */

export type SeatTeam = "gold" | "silver";

/**
 * Decide the viewer-relative team color identity for a given seat.
 *
 * Beljot partners sit across the table (`seat % 2`), so any two seats with the
 * same parity belong to the same team. The viewer is always Gold; their
 * partner therefore is also Gold. Both opponents are Silver.
 */
export function seatTeam(seat: number, viewerSeat: number): SeatTeam {
  return seat % 2 === viewerSeat % 2 ? "gold" : "silver";
}

/** Gradient stops for the gold (Us) team — bright → deep. */
export const TEAM_GOLD = ["#e8c25a", "#a07d1a"] as const;

/** Gradient stops for the silver (Them) team — bright → deep. */
export const TEAM_SILVER = ["#d8dde4", "#8b919a"] as const;

/** Gradient stops for the universal turn / action signal. */
export const TURN_LIME = ["#00e5a0", "#00a878"] as const;

/** Gradient stops for the urgent flip on ≤25% timer remaining. */
export const TURN_URGENT = ["#ef4444", "#b91c1c"] as const;

export type TeamGradient = readonly [string, string];

/** Resolve the bright/deep gradient stops for a viewer-relative team. */
export function teamColors(team: SeatTeam): TeamGradient {
  return team === "gold" ? TEAM_GOLD : TEAM_SILVER;
}

/** i18n key for the viewer-relative team label ("Us" / "Them"). */
export function teamLabelKey(team: SeatTeam): "team.us" | "team.them" {
  return team === "gold" ? "team.us" : "team.them";
}
