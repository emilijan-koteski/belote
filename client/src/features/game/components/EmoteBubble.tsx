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

// Local copy of the seat-position class strings used by GamePage. Four lines
// of CSS — duplication is cheaper than introducing a new shared util file.
const SEAT_POSITIONS: Record<0 | 1 | 2 | 3, string> = {
  0: "bottom-44 left-1/2 -translate-x-1/2", // South — above the local player's hand area
  1: "right-24 top-1/2 -translate-y-1/2", // East
  2: "top-24 left-1/2 -translate-x-1/2", // North
  3: "left-24 top-1/2 -translate-y-1/2", // West
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
        className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-border bg-background/95 text-3xl leading-none shadow-lg"
        aria-hidden="true"
      >
        {EMOTE_GLYPHS[emote]}
      </span>
    </div>
  );
}
