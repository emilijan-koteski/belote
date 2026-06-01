import type { ReactNode } from "react";

interface OverlayBackdropProps {
  /** 0..1 opacity multiplier for the radial dim layer. Default 0.55. */
  dim?: number;
  children: ReactNode;
}

/**
 * Full-screen radial-dim backdrop used by classic-style overlays. The dim and
 * the centered panel render on two separate z-layers so individual game
 * elements can opt to sit between them — e.g. {@link HandCards} elevates
 * itself to z-50 during the trump prompt so the player can read their cards
 * while everything else is dimmed/blurred.
 *
 *  • dim     → z-40, captures no pointer events (so card clicks reach cards
 *              that opted to elevate above it).
 *  • panel   → z-60, pointer-events-auto on the inner wrapper so the
 *              dialog itself remains interactive.
 *
 * Clicking the dim itself does NOT dismiss the overlay (overlays are
 * dismissed via their own buttons / autoclose rings / Escape handlers).
 */
export function OverlayBackdrop({ dim = 0.55, children }: OverlayBackdropProps) {
  const center = dim * 0.8;
  return (
    <>
      <div
        aria-hidden
        className="absolute inset-0 z-40 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at center, rgba(0,0,0,${center}) 0%, rgba(0,0,0,${dim}) 100%)`,
          backdropFilter: "blur(2px)",
          WebkitBackdropFilter: "blur(2px)",
        }}
      />
      <div className="absolute inset-0 z-60 flex items-center justify-center pointer-events-none">
        <div className="pointer-events-auto">{children}</div>
      </div>
    </>
  );
}
