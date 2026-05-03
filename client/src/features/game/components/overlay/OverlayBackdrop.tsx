import type { ReactNode } from "react";

interface OverlayBackdropProps {
  /** 0..1 opacity multiplier for the radial dim layer. Default 0.55. */
  dim?: number;
  children: ReactNode;
}

/**
 * Full-screen radial-dim backdrop used by classic-style overlays. Children are
 * centered horizontally and vertically — the consumer typically renders a
 * `ClassicPanel` (or a toast variant) inside.
 *
 * Pointer events flow through the backdrop to the children only — clicking
 * the dim itself does NOT dismiss the overlay (overlays are dismissed via
 * their own buttons / autoclose rings).
 */
export function OverlayBackdrop({ dim = 0.55, children }: OverlayBackdropProps) {
  const center = dim * 0.8;
  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center"
      style={{
        background: `radial-gradient(ellipse at center, rgba(0,0,0,${center}) 0%, rgba(0,0,0,${dim}) 100%)`,
        backdropFilter: "blur(2px)",
        WebkitBackdropFilter: "blur(2px)",
      }}
    >
      {children}
    </div>
  );
}
