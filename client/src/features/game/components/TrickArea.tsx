import { useEffect, useId, useRef, useState } from "react";

import { useReducedMotion } from "@/shared/hooks/useReducedMotion";
import type { TrickCard } from "@/shared/types/gameTypes";

import { PlayingCard } from "./PlayingCard";

const EMPTY_TRICK: TrickCard[] = [];

interface TrickAreaProps {
  trick: TrickCard[] | null;
  winnerSeat: number | null;
  myPlayerSeat: number;
}

function compassOffset(seat: number, myPlayerSeat: number): number {
  return (seat - myPlayerSeat + 4) % 4;
}

// Compass slot positions with intentional rotation jitter so cards don't land
// at perfect angles. Mirrors the design's 'imperfect throw' feel — a real
// player isn't a robot.
type SlotPosition = {
  className: string;
  rotation: number;
  /** Direction the card flies in from (matches the player's seat direction). */
  approachFrom: { x: number; y: number };
};

const SLOT_POSITIONS: Record<number, SlotPosition> = {
  // South — self. Self cards "fly up" from below screen, synced with the
  // hand-throw animation so the gesture reads as one continuous pickup.
  0: {
    className: "bottom-0 left-1/2 -translate-x-1/2",
    rotation: -3,
    approachFrom: { x: 0, y: 240 },
  },
  // East — opponent on the right.
  1: {
    className: "top-1/2 right-0 -translate-y-1/2",
    rotation: 8,
    approachFrom: { x: 360, y: 0 },
  },
  // North — partner.
  2: {
    className: "top-0 left-1/2 -translate-x-1/2",
    rotation: 4,
    approachFrom: { x: 0, y: -320 },
  },
  // West — opponent on the left.
  3: {
    className: "top-1/2 left-0 -translate-y-1/2",
    rotation: -8,
    approachFrom: { x: -360, y: 0 },
  },
};

// When the trick resolves, all four cards slide toward the winner's seat
// compass and scale down — the winner "collects" the trick. These translations
// are applied as inline transforms so the destination follows the winner's
// position regardless of which seat they're at.
function winnerCollectTransform(winnerCompass: number, ownRotation: number): string {
  const dest = {
    0: { x: 0, y: 220 }, // collect to self (bottom)
    1: { x: 220, y: 0 }, // collect to right
    2: { x: 0, y: -220 }, // collect to top
    3: { x: -220, y: 0 }, // collect to left
  }[winnerCompass] ?? { x: 0, y: 0 };
  return `translate(${dest.x}px, ${dest.y}px) rotate(${ownRotation}deg) scale(0.5)`;
}

const RESOLVE_PAUSE_MS = 1000;
const COLLECT_SLIDE_MS = 600;

export function TrickArea({ trick: rawTrick, winnerSeat, myPlayerSeat }: TrickAreaProps) {
  const trick = rawTrick ?? EMPTY_TRICK;
  const [displayTrick, setDisplayTrick] = useState<TrickCard[]>([]);
  const [resolving, setResolving] = useState(false);
  const [collecting, setCollecting] = useState(false);
  const [incomingCompass, setIncomingCompass] = useState<number | null>(null);
  const displayTrickRef = useRef<TrickCard[]>([]);
  displayTrickRef.current = displayTrick;

  const prefersReducedMotion = useReducedMotion();
  // Stable, render-scoped id — used to namespace the keyframe animations so
  // multiple TrickArea instances on the same DOM (unlikely, but possible
  // during Strict-mode double-mount) don't share keyframe names.
  const animScope = useId().replace(/:/g, "");

  useEffect(() => {
    const prevLen = displayTrickRef.current.length;

    // New card landed — sync display + flag the latest card's compass so it
    // animates in from the player's seat direction.
    if (trick.length > 0 && trick.length > prevLen) {
      setDisplayTrick(trick);
      setResolving(false);
      setCollecting(false);
      const newest = trick[trick.length - 1];
      const compass = compassOffset(newest.playerSeat, myPlayerSeat);
      setIncomingCompass(compass);
      const clearTimer = setTimeout(() => setIncomingCompass(null), 500);
      return () => clearTimeout(clearTimer);
    }

    // Force-sync: trick reset from non-4 length (reconnect, missed events).
    if (trick.length === 0 && prevLen > 0 && prevLen < 4) {
      setDisplayTrick([]);
      setResolving(false);
      setCollecting(false);
      setIncomingCompass(null);
      return;
    }

    // Trick resolved: server cleared trick after 4 cards were played.
    if (trick.length === 0 && prevLen === 4) {
      if (prefersReducedMotion) {
        setDisplayTrick([]);
        return;
      }
      // Phase 1 — winner glow for 1000 ms.
      setResolving(true);
      const resolveTimer = setTimeout(() => {
        // Phase 2 — slide the four cards toward the winner + scale + fade.
        setResolving(false);
        setCollecting(true);
        const collectTimer = setTimeout(() => {
          setDisplayTrick([]);
          setCollecting(false);
        }, COLLECT_SLIDE_MS);
        return () => clearTimeout(collectTimer);
      }, RESOLVE_PAUSE_MS);
      return () => clearTimeout(resolveTimer);
    }

    // Full state replace (reconnect): trick has cards but fewer than display.
    if (trick.length > 0 && trick.length <= prevLen) {
      setDisplayTrick(trick);
      setResolving(false);
      setCollecting(false);
      setIncomingCompass(null);
    }
  }, [trick, prefersReducedMotion, myPlayerSeat]);

  const winnerCompass = winnerSeat !== null ? compassOffset(winnerSeat, myPlayerSeat) : null;

  // Keyframes for incoming card landings — namespaced via animScope so
  // multiple instances don't collide.
  const incomingKeyframes = (Object.keys(SLOT_POSITIONS) as Array<keyof typeof SLOT_POSITIONS>)
    .map((key) => {
      const slot = SLOT_POSITIONS[Number(key)];
      const fromX = slot.approachFrom.x;
      const fromY = slot.approachFrom.y;
      const isSelf = Number(key) === 0;
      const startOpacity = isSelf ? 1 : 0;
      const startScale = isSelf ? 0.92 : 1.18;
      return `@keyframes trickLand_${animScope}_${key} {
        0%   { transform: translate(${fromX}px, ${fromY}px) rotate(${slot.rotation - 6}deg) scale(${startScale}); opacity: ${startOpacity}; }
        30%  { opacity: 1; }
        100% { transform: translate(0, 0) rotate(${slot.rotation}deg) scale(1); opacity: 1; }
      }`;
    })
    .join("\n");

  return (
    <div className="relative w-[25vw] aspect-square" data-testid="trick-area">
      {/* Inline keyframe definitions — kept local to the component so we can
          interpolate the per-slot approach offsets without a global stylesheet. */}
      {!prefersReducedMotion && <style>{incomingKeyframes}</style>}

      {displayTrick.map((tc) => {
        const compass = compassOffset(tc.playerSeat, myPlayerSeat);
        const slot = SLOT_POSITIONS[compass];
        const isWinner = resolving && compass === winnerCompass;
        const isIncoming = incomingCompass === compass && !prefersReducedMotion;

        const baseTransform = `rotate(${slot.rotation}deg)`;
        const inlineStyle: React.CSSProperties = collecting
          ? {
              transform:
                winnerCompass !== null
                  ? winnerCollectTransform(winnerCompass, slot.rotation)
                  : baseTransform,
              opacity: 0,
              transition: `transform ${COLLECT_SLIDE_MS}ms cubic-bezier(0.45, 0, 0.55, 1), opacity ${COLLECT_SLIDE_MS}ms ease-in`,
            }
          : { transform: baseTransform };
        if (isIncoming) {
          inlineStyle.animation = `trickLand_${animScope}_${compass} ${
            compass === 0 ? 460 : 360
          }ms cubic-bezier(0.22, 1, 0.36, 1) both`;
        }

        return (
          <div
            key={`${tc.card.rank}${tc.card.suit}`}
            className={`absolute ${slot.className} ${
              isWinner ? "shadow-[0_0_20px_var(--color-accent)]" : ""
            }`}
            style={inlineStyle}
          >
            <PlayingCard card={tc.card} state="default" size="sm" withTransition={false} />
          </div>
        );
      })}
    </div>
  );
}
