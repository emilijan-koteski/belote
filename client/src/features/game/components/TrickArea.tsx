import { useEffect, useMemo, useRef, useState } from "react";

import type { TrickCard } from "@/shared/types/gameTypes";

import { PlayingCard } from "./PlayingCard";

interface TrickAreaProps {
  trick: TrickCard[] | null;
  winnerSeat: number | null;
  myPlayerSeat: number;
}

function compassOffset(seat: number, myPlayerSeat: number): number {
  return (seat - myPlayerSeat + 4) % 4;
}

const TRICK_CARD_POSITIONS: Record<number, string> = {
  0: "bottom-0 left-1/2 -translate-x-1/2", // South
  1: "top-1/2 left-0 -translate-y-1/2", // West
  2: "top-0 left-1/2 -translate-x-1/2", // North
  3: "top-1/2 right-0 -translate-y-1/2", // East
};

// Sweep destinations toward winning team's corner
const SWEEP_POSITIONS: Record<number, string> = {
  0: "translate-y-[200%]", // South → off bottom
  1: "-translate-x-[200%]", // West → off left
  2: "-translate-y-[200%]", // North → off top
  3: "translate-x-[200%]", // East → off right
};

export function TrickArea({ trick: rawTrick, winnerSeat, myPlayerSeat }: TrickAreaProps) {
  const trick = rawTrick ?? [];
  const [displayTrick, setDisplayTrick] = useState<TrickCard[]>([]);
  const [resolving, setResolving] = useState(false);
  const [sweeping, setSweeping] = useState(false);
  const displayTrickRef = useRef<TrickCard[]>([]);
  displayTrickRef.current = displayTrick;

  const prefersReducedMotion = useMemo(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  useEffect(() => {
    const prevLen = displayTrickRef.current.length;

    // New card arrived — update display
    if (trick.length > 0 && trick.length > prevLen) {
      setDisplayTrick(trick);
      setResolving(false);
      setSweeping(false);
      return;
    }

    // Force-sync: trick reset from non-4 length (reconnect, missed events)
    if (trick.length === 0 && prevLen > 0 && prevLen < 4) {
      setDisplayTrick([]);
      setResolving(false);
      setSweeping(false);
      return;
    }

    // Trick resolved: server cleared trick after 4 cards were played
    if (trick.length === 0 && prevLen === 4) {
      if (prefersReducedMotion) {
        setDisplayTrick([]);
        return;
      }
      // Phase 1: show winner glow for 1000ms
      setResolving(true);
      const resolveTimer = setTimeout(() => {
        // Phase 2: sweep cards off-screen
        setResolving(false);
        setSweeping(true);
        // Phase 3: clear after sweep transition (150ms)
        const sweepTimer = setTimeout(() => {
          setDisplayTrick([]);
          setSweeping(false);
        }, 150);
        return () => clearTimeout(sweepTimer);
      }, 1000);
      return () => clearTimeout(resolveTimer);
    }

    // Full state replace (reconnect): trick has cards but fewer than display
    if (trick.length > 0 && trick.length <= prevLen) {
      setDisplayTrick(trick);
      setResolving(false);
      setSweeping(false);
    }
  }, [trick, prefersReducedMotion]);

  const winnerCompass = winnerSeat !== null ? compassOffset(winnerSeat, myPlayerSeat) : null;

  return (
    <div className="relative w-[25vw] aspect-square" data-testid="trick-area">
      {displayTrick.length === 0 && !sweeping && (
        <div className="absolute inset-0 border border-border rounded-full opacity-30" />
      )}

      {displayTrick.map((tc) => {
        const compass = compassOffset(tc.playerSeat, myPlayerSeat);
        const isWinner = resolving && compass === winnerCompass;
        const sweepClass = sweeping && winnerCompass !== null ? SWEEP_POSITIONS[winnerCompass] : "";

        return (
          <div
            key={`${tc.card.rank}${tc.card.suit}`}
            className={`absolute ${TRICK_CARD_POSITIONS[compass]} ${isWinner ? "shadow-[0_0_20px_var(--color-accent)]" : ""} ${sweepClass} ${sweeping ? "motion-safe:transition-all motion-safe:duration-150 opacity-0" : ""}`}
          >
            <PlayingCard card={tc.card} state="default" size="sm" withTransition={false} />
          </div>
        );
      })}
    </div>
  );
}
