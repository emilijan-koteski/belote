import { useEffect, useRef } from "react";

import { useReducedMotion } from "@/shared/hooks/useReducedMotion";
import type { EmoteID } from "@/shared/types/wsEvents";

const EMOTE_GLYPHS: Record<EmoteID, string> = {
  thumbs_up: "👍",
  clap: "👏",
  laugh: "😂",
  thinking: "🤔",
  facepalm: "🤦",
  heart: "❤️",
};

// Bubble sits on the table-facing side of each seat (between the seat and the
// table center) so the emote reads as coming from that player without
// overlapping their name pill / card stack.
const SEAT_POSITIONS: Record<0 | 1 | 2 | 3, string> = {
  0: "bottom-[22rem] left-1/2 -translate-x-1/2", // South — above the self avatar/name pill
  1: "right-[22rem] top-1/2 -translate-y-1/2", // East — left of the seat (toward table)
  2: "top-[16rem] left-1/2 -translate-x-1/2", // North — below the partner's seat + card stack
  3: "left-[22rem] top-1/2 -translate-y-1/2", // West — right of the seat (toward table)
};

const DURATION_MS = 2000;
const REDUCED_MOTION_DURATION_MS = 1000;

interface EmoteBubbleProps {
  emote: EmoteID;
  compassPosition: 0 | 1 | 2 | 3;
  onDismiss: () => void;
}

export function EmoteBubble({ emote, compassPosition, onDismiss }: EmoteBubbleProps) {
  // Capture latest onDismiss in a ref so the dismiss-timer effect runs once
  // on mount instead of restarting every parent re-render. Parents commonly
  // pass an inline arrow (e.g. `() => setActiveEmote(seat, null)`) whose
  // identity changes on every render — depending on it would clear and
  // reschedule the timer continuously, so the bubble never auto-dismisses
  // during active gameplay.
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const duration = reducedMotion ? REDUCED_MOTION_DURATION_MS : DURATION_MS;
    const handle = window.setTimeout(() => onDismissRef.current(), duration);
    return () => window.clearTimeout(handle);
  }, [reducedMotion]);

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid={`emote-bubble-${compassPosition}`}
      className={`absolute ${SEAT_POSITIONS[compassPosition]} pointer-events-none z-20 motion-safe:animate-in motion-safe:zoom-in-95 motion-safe:duration-150`}
    >
      <span
        className="inline-flex h-12 w-12 items-center justify-center rounded-full text-3xl leading-none"
        style={{
          background: "var(--panel-dark, rgba(20,45,30,0.85))",
          border: "1px solid var(--brass, #c9a876)",
          boxShadow: "0 4px 14px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06)",
        }}
        aria-hidden="true"
      >
        {EMOTE_GLYPHS[emote]}
      </span>
    </div>
  );
}
