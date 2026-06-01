import { useTranslation } from "react-i18next";

interface SurrenderOpponentBannerProps {
  proposerUsername: string;
  /**
   * Compass position of the proposer relative to the local viewer (0=south,
   * 1=east, 2=north, 3=west). Drives the banner's anchor — same per-seat
   * pattern as {@link EmoteBubble} so opponents see WHO is proposing. In
   * practice opponents only ever see compass 1 or 3 (the proposer is on the
   * opposing team, never the viewer or their partner), but all four slots
   * are typed for completeness.
   */
  compassPosition: 0 | 1 | 2 | 3;
}

// Mirrors EmoteBubble's seat-relative positions so the banner reads as
// originating from the proposer's seat, not as a generic top-of-screen toast.
const SEAT_POSITIONS: Record<0 | 1 | 2 | 3, string> = {
  0: "bottom-[22rem] left-1/2 -translate-x-1/2",
  1: "right-[22rem] top-1/2 -translate-y-1/2",
  2: "top-[16rem] left-1/2 -translate-x-1/2",
  3: "left-[22rem] top-1/2 -translate-y-1/2",
};

// Slim non-modal banner shown to opposing-team players while a surrender
// proposal is pending. Intentionally NOT a dialog: opponents must keep
// playing while the proposer's partner accepts/declines. Styling and
// anchoring mirror EmoteBubble — same dark-felt panel + brass border, parked
// next to the proposer's seat — so the in-game chrome stays consistent.
export function SurrenderOpponentBanner({
  proposerUsername,
  compassPosition,
}: SurrenderOpponentBannerProps) {
  const { t } = useTranslation();

  return (
    <div
      className={`absolute ${SEAT_POSITIONS[compassPosition]} z-20 rounded-full px-4 py-1.5 motion-safe:animate-in motion-safe:zoom-in-95 motion-safe:duration-150`}
      style={{
        background: "var(--panel-dark, rgba(20,45,30,0.85))",
        border: "1px solid var(--brass, #c9a876)",
        boxShadow: "0 4px 14px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06)",
      }}
      data-testid="surrender-opponent-banner"
      role="status"
      aria-live="polite"
    >
      <span
        className="font-body text-sm whitespace-nowrap"
        style={{ color: "var(--ink-light, #f5f2e8)" }}
      >
        {t("match.surrender.opponentBanner", { username: proposerUsername })}
      </span>
    </div>
  );
}
