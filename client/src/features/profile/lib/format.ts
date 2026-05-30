/**
 * Whole days between `iso` and now, floored, never negative. Used for the hero
 * "last played" line and any relative-day labels on the profile.
 */
export function daysSince(iso: string): number {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return 0;
  return Math.max(0, Math.floor((Date.now() - then) / 86_400_000));
}

/**
 * 24-hour HH:MM for an ISO timestamp, locale-neutral (matches the match-row
 * clock in the design). Returns "" for an unparseable input.
 */
export function formatClockTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
