import { useSyncExternalStore } from "react";

import { ageCompact, fromNow } from "@/shared/lib/relativeTime";
import { getTimeTick, subscribeTimeTick } from "@/shared/lib/timeTick";

type Props = {
  /** ISO timestamp or anything dayjs can parse. */
  iso: string | number | Date;
  /**
   * Display style.
   * - `verbose` (default): "5 minutes ago" / "just now" / falls back to absolute date >7d.
   * - `compact`: "5m" / "2h" / "now" / falls back to absolute date >7d.
   */
  variant?: "verbose" | "compact";
  className?: string;
  /** Override the tooltip; defaults to a full ISO timestamp. */
  title?: string;
};

/**
 * Renders a localized relative timestamp that ticks every 30s via a single
 * shared interval. Drop-in for chat bubble timestamps + room age strips.
 */
export function RelativeTime({ iso, variant = "verbose", className, title }: Props) {
  // Subscribe so this instance re-renders on each shared tick.
  useSyncExternalStore(subscribeTimeTick, getTimeTick, getTimeTick);

  // Defensive: a WS payload missing `createdAt` / `timestamp` (server bug,
  // protocol drift) used to crash the whole subtree via `new Date(undefined)
  // .toISOString()` → RangeError. Render an empty <time> instead so the
  // ErrorBoundary above us doesn't unmount the lobby grid because one card
  // had a malformed timestamp.
  let fullIso = "";
  if (typeof iso === "string") {
    fullIso = iso;
  } else if (iso != null) {
    const d = new Date(iso);
    if (!Number.isNaN(d.getTime())) fullIso = d.toISOString();
  }
  if (!fullIso) {
    return <time className={className} />;
  }

  const text = variant === "compact" ? ageCompact(iso) : fromNow(iso);

  return (
    <time dateTime={fullIso} title={title ?? fullIso} className={className}>
      {text}
    </time>
  );
}
