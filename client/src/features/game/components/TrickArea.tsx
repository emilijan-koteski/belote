import { useEffect, useId, useRef, useState } from "react";

import { useReducedMotion } from "@/shared/hooks/useReducedMotion";
import { FLAG_LIFETIME, MOTION } from "@/shared/lib/motion";
import type { TrickCard } from "@/shared/types/gameTypes";

import { PlayingCard } from "./PlayingCard";

const EMPTY_TRICK: TrickCard[] = [];

interface TrickAreaProps {
  trick: TrickCard[] | null;
  winnerSeat: number | null;
  myPlayerSeat: number;
}

type Compass = 0 | 1 | 2 | 3;

function compassOffset(seat: number, myPlayerSeat: number): Compass {
  return ((((seat - myPlayerSeat) % 4) + 4) % 4) as Compass;
}

// Tight diamond layout matching the design's 280x240 trick area. Each slot is
// anchored at the container center via translate(-50%, -50%); offsetX/offsetY
// shifts the card outward toward the player who threw it. Rotation is a small
// jitter so cards don't land at perfect angles.
type SlotPosition = {
  offsetX: number;
  offsetY: number;
  rotation: number;
  /** Where the card starts the incoming animation, in trick-area-local
   *  coordinates relative to the diamond center. Self emerges from the
   *  screen's center-bottom (continuing the hand-throw exit); opponents
   *  emerge from their own card stack beside their seat. */
  approachFrom: { x: number; y: number };
  /** Scale at the start of the incoming animation. Self stays at full size —
   *  the gesture is a slide, not a grow — so the card looks like a real card
   *  flicked from the player's hand. Opponents start small (deck-card sized)
   *  and grow to full size as the card reaches the table. */
  approachScale: number;
  /** Where cards translate when sliding to the winner's pile after the trick
   *  resolves. Distances are tuned so cards visibly travel toward the winning
   *  player's seat before fading. */
  collectTo: { x: number; y: number };
};

const SLOT_POSITIONS: Record<Compass, SlotPosition> = {
  // South — self. Hand card slides off-screen-bottom (HandCards' handThrow),
  // then a fresh card enters from the same bottom-center region and slides
  // up to the south slot at full size.
  0: {
    offsetX: 0,
    offsetY: 60,
    rotation: -3,
    approachFrom: { x: 0, y: 460 },
    approachScale: 1,
    collectTo: { x: 0, y: 460 },
  },
  // East — opponent on the right. Card lifts off the small brown deck beside
  // their seat (~420 px right of the trick centre) and grows as it slides.
  1: {
    offsetX: 74,
    offsetY: 0,
    rotation: 8,
    approachFrom: { x: 420, y: 0 },
    approachScale: 0.4,
    collectTo: { x: 540, y: 0 },
  },
  // North — partner.
  2: {
    offsetX: 0,
    offsetY: -60,
    rotation: 4,
    approachFrom: { x: 0, y: -260 },
    approachScale: 0.4,
    collectTo: { x: 0, y: -300 },
  },
  // West — opponent on the left.
  3: {
    offsetX: -74,
    offsetY: 0,
    rotation: -8,
    approachFrom: { x: -420, y: 0 },
    approachScale: 0.4,
    collectTo: { x: -540, y: 0 },
  },
};

const RESOLVE_PAUSE_MS = MOTION.TRICK_RESOLVE_PAUSE;
const COLLECT_SLIDE_MS = MOTION.TRICK_COLLECT;

// Empty-slot ghost dimensions — slightly larger than `md` PlayingCard so the
// placeholder reads as the card's silhouette without dominating the trick.
const PLACEHOLDER_W = 72;
const PLACEHOLDER_H = 104;

export function TrickArea({ trick: rawTrick, winnerSeat, myPlayerSeat }: TrickAreaProps) {
  const trick = rawTrick ?? EMPTY_TRICK;
  const [displayTrick, setDisplayTrick] = useState<TrickCard[]>([]);
  const [resolving, setResolving] = useState(false);
  const [collecting, setCollecting] = useState(false);
  const [incomingCompass, setIncomingCompass] = useState<Compass | null>(null);
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
      if (newest) {
        setIncomingCompass(compassOffset(newest.playerSeat, myPlayerSeat));
      }
      const clearTimer = setTimeout(() => setIncomingCompass(null), FLAG_LIFETIME.INCOMING_COMPASS);
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
  const playedByCompass = new Set(
    displayTrick.map((tc) => compassOffset(tc.playerSeat, myPlayerSeat)),
  );

  // Keyframes for incoming card landings — namespaced via animScope so
  // multiple instances don't collide.
  //
  // Self (compass 0) slides up from the screen's center-bottom at full size,
  // pairing with the hand-throw exit: hand card disappears off the bottom,
  // then the trick card enters from the same region and travels up to the
  // south placeholder.
  //
  // Opponents (compass 1/2/3) emerge tiny — like a card lifted off their
  // brown deck beside their seat — and grow to full size as they reach the
  // table. The slight rotation under-shoot adds a "throw" feel.
  const incomingKeyframes = ([0, 1, 2, 3] as const)
    .map((key) => {
      const slot = SLOT_POSITIONS[key];
      const { x: fromX, y: fromY } = slot.approachFrom;
      const startScale = slot.approachScale;
      return `@keyframes trickLand_${animScope}_${key} {
        0%   { transform: translate(calc(-50% + ${fromX}px), calc(-50% + ${fromY}px)) rotate(${slot.rotation - 6}deg) scale(${startScale}); opacity: 0; }
        20%  { opacity: 1; }
        100% { transform: translate(calc(-50% + ${slot.offsetX}px), calc(-50% + ${slot.offsetY}px)) rotate(${slot.rotation}deg) scale(1); opacity: 1; }
      }`;
    })
    .join("\n");

  return (
    <div
      className="relative pointer-events-none"
      style={{ width: 280, height: 240 }}
      data-testid="trick-area"
    >
      {/* Inline keyframe definitions — kept local to the component so we can
          interpolate the per-slot approach offsets without a global stylesheet. */}
      {!prefersReducedMotion && <style>{incomingKeyframes}</style>}

      {/* Empty-slot ghosts — render at every compass that hasn't received a
          card yet (including the active player's slot) so players see where
          the next card will land. Hidden during the winner-collect slide so
          the placeholder doesn't peek out under the moving cards. */}
      {!collecting &&
        ([0, 1, 2, 3] as const).map((compass) => {
          if (playedByCompass.has(compass)) return null;
          const slot = SLOT_POSITIONS[compass];
          return (
            <div
              key={`placeholder-${compass}`}
              className="absolute"
              style={{
                left: "50%",
                top: "50%",
                width: PLACEHOLDER_W,
                height: PLACEHOLDER_H,
                transform: `translate(calc(-50% + ${slot.offsetX}px), calc(-50% + ${slot.offsetY}px)) rotate(${slot.rotation}deg)`,
                borderRadius: 6,
                border: "1.5px dashed rgba(255,255,255,0.14)",
                background: "rgba(255,255,255,0.02)",
              }}
              data-testid={`trick-slot-${compass}`}
              aria-hidden="true"
            />
          );
        })}

      {displayTrick.map((tc) => {
        const compass = compassOffset(tc.playerSeat, myPlayerSeat);
        const slot = SLOT_POSITIONS[compass];
        const isWinner = resolving && compass === winnerCompass;
        const isIncoming = incomingCompass === compass && !prefersReducedMotion;

        const baseTransform = `translate(calc(-50% + ${slot.offsetX}px), calc(-50% + ${slot.offsetY}px)) rotate(${slot.rotation}deg)`;

        // Transition is *always* present so the collect-phase property change
        // (transform + opacity) reliably interpolates instead of snapping —
        // the previous render's lingering `animation` from the incoming phase
        // would otherwise clobber the transition. Both transforms include
        // scale() so the function lists match component-by-component, which
        // avoids the matrix-decomposition snap browsers fall back to when
        // the FROM and TO have different transform-function signatures.
        const collectFadeMs = Math.min(500, Math.round(COLLECT_SLIDE_MS * 0.35));
        const collectFadeDelay = COLLECT_SLIDE_MS - collectFadeMs;
        const baseTransformWithScale = `${baseTransform} scale(1)`;
        const inlineStyle: React.CSSProperties = {
          left: "50%",
          top: "50%",
          transform: baseTransformWithScale,
          transition: `transform ${COLLECT_SLIDE_MS}ms ease-in-out, opacity ${collectFadeMs}ms ease-in ${collectFadeDelay}ms`,
        };
        if (collecting && winnerCompass !== null) {
          const dest = SLOT_POSITIONS[winnerCompass].collectTo;
          // `animation: none` is required: the incoming keyframe runs with
          // `animation-fill-mode: both`, which keeps the end-state transform
          // applied even after the animation completes. That held state wins
          // over any inline transform we set, so the collect transition
          // never paints. Clearing the animation here lets the transition take.
          inlineStyle.animation = "none";
          inlineStyle.transform = `translate(calc(-50% + ${dest.x}px), calc(-50% + ${dest.y}px)) rotate(${slot.rotation}deg) scale(0.45)`;
          inlineStyle.opacity = 0;
        } else if (isIncoming) {
          const landMs = compass === 0 ? MOTION.CARD_LAND_SELF : MOTION.CARD_LAND_OPPONENT;
          inlineStyle.animation = `trickLand_${animScope}_${compass} ${landMs}ms cubic-bezier(0.22, 1, 0.36, 1) both`;
        }

        return (
          <div
            key={`${tc.card.rank}${tc.card.suit}`}
            className={`absolute ${isWinner ? "shadow-[0_0_20px_var(--color-accent)]" : ""}`}
            style={inlineStyle}
          >
            <PlayingCard card={tc.card} state="default" size="md" withTransition={false} />
          </div>
        );
      })}
    </div>
  );
}
