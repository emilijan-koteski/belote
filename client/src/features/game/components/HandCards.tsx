import { useId } from "react";

import { MOTION } from "@/shared/lib/motion";
import type { Card, Rank, Suit } from "@/shared/types/gameTypes";

import type { CardState } from "./PlayingCard";
import { PlayingCard } from "./PlayingCard";

interface HandCardsProps {
  hand: Card[];
  isMyTurn: boolean;
  playableCardIds: string[];
  onPlayCard: (cardId: string) => void;
  /**
   * Card id (e.g. `"KS"`) currently being thrown into the trick. Drives the
   * hand-throw animation: the matching card translates downward + scales
   * down + fades out so the gesture reads as one continuous "pickup → trick"
   * with the receiving TrickArea slot's incoming-card animation.
   */
  flyingId?: string | null;
}

// Display sizing matches the `lg` PlayingCard variant — wider than the previous
// medium fan so the table-edge presentation reads at glance.
const CARD_WIDTH = 88; // matches SIZE_DIMENSIONS.lg.width in PlayingCard
const CARD_HEIGHT = 128;

// Maximum lateral spread between adjacent cards before they start to compress.
const MAX_SPREAD_PX = 54;
// At a normal 8-card hand this lands at ~52 px; for fewer cards we widen so
// the fan still feels balanced.
const SPREAD_BUDGET_PX = 480;

// Fan rotation: the leftmost card tilts slightly counter-clockwise, the
// rightmost slightly clockwise, mid-cards stay almost vertical.
const PER_OFFSET_DEG = 2.2;

// Vertical sag per offset — pure arc visual without an SVG path.
const PER_OFFSET_DROP = 3;

// Alternating-color display order so neighboring suits are visually distinct.
const SUIT_ORDER: Record<Suit, number> = { S: 0, H: 1, C: 2, D: 3 };
const RANK_ORDER: Record<Rank, number> = { "7": 0, "8": 1, "9": 2, T: 3, J: 4, Q: 5, K: 6, A: 7 };

function cardId(card: Card): string {
  return `${card.rank}${card.suit}`;
}

function sortHand(hand: Card[]): Card[] {
  return [...hand].sort((a, b) => {
    const suitDiff = SUIT_ORDER[a.suit] - SUIT_ORDER[b.suit];
    return suitDiff !== 0 ? suitDiff : RANK_ORDER[a.rank] - RANK_ORDER[b.rank];
  });
}

/**
 * Bottom-of-table fan of the local player's hand.
 *
 * Layout: cards are absolutely positioned around a horizontal centerline. Each
 * card pivots from its bottom-center via `transform-origin: 50% 120%` so the
 * rotation reads as a fan rather than a tilt. Outer cards drop a few pixels so
 * the top edge traces a gentle arc.
 *
 * State channel:
 *  • `playable`   — picked up (lifted) with a lime halo (handled inside the
 *                   `PlayingCard`).
 *  • `unplayable` — stays at full opacity per the design's "visible but not
 *                   playable" rule, sits a few pixels lower.
 *  • `default`    — when it's not my turn, every card renders in default state
 *                   so the legality hint never bleeds across turns.
 */
// Hand-throw animation for the played card — short downward slide + fade
// that pairs with TrickArea's incoming-card animation for the same card. The
// card is unmounted from the hand by the WS gameState push (server clears it
// from `players[seat].hand`), so we only need the exit animation here.
const HAND_THROW_MS = MOTION.CARD_THROW;

export function HandCards({
  hand,
  isMyTurn,
  playableCardIds,
  onPlayCard,
  flyingId = null,
}: HandCardsProps) {
  // Stable id used to namespace the per-card hand-throw keyframes so multiple
  // hand instances on the same DOM (Strict-mode double-mount) don't collide.
  const animScope = useId().replace(/:/g, "");

  if (hand.length === 0) {
    return <div className="relative h-36 w-px" data-testid="hand-cards" />;
  }

  const sortedHand = sortHand(hand);
  const total = sortedHand.length;
  const spread = Math.min(MAX_SPREAD_PX, total > 1 ? SPREAD_BUDGET_PX / total : 0);
  // Container width needs to fit the outermost card's centre offset + half a
  // card width on either side. Add 24 px safety for the lift transform halo.
  const containerWidth = spread * Math.max(0, total - 1) + CARD_WIDTH + 24;

  return (
    <div
      className="relative flex items-end justify-center"
      style={{ width: containerWidth, height: CARD_HEIGHT + 32 }}
      data-testid="hand-cards"
    >
      {sortedHand.map((card, index) => {
        const id = cardId(card);
        const offset = index - (total - 1) / 2;
        const rotateDeg = offset * PER_OFFSET_DEG;
        const dropPx = Math.abs(offset) * PER_OFFSET_DROP;
        const isFlying = flyingId === id;

        let state: CardState = "default";
        if (isMyTurn && !isFlying) {
          state = playableCardIds.includes(id) ? "playable" : "unplayable";
        }

        // Per-card keyframe — the rotation has to be baked in so the
        // animation doesn't reset to 0 deg for a single frame.
        const flyKeyframes = isFlying
          ? `@keyframes handThrow_${animScope}_${index} {
              0%   { transform: rotate(${rotateDeg}deg) translate(0, 0) scale(1); opacity: 1; }
              100% { transform: rotate(${rotateDeg}deg) translate(0, 240px) scale(0.92); opacity: 0; }
            }`
          : null;

        return (
          <div
            key={id}
            className="absolute"
            style={{
              left: `calc(50% + ${offset * spread}px - ${CARD_WIDTH / 2}px)`,
              bottom: dropPx,
              transform: `rotate(${rotateDeg}deg)`,
              transformOrigin: "50% 120%",
              zIndex: isFlying ? 999 : index,
              animation: isFlying
                ? `handThrow_${animScope}_${index} ${HAND_THROW_MS}ms cubic-bezier(0.4, 0, 0.7, 1) both`
                : undefined,
              pointerEvents: isFlying ? "none" : "auto",
            }}
          >
            {flyKeyframes && <style>{flyKeyframes}</style>}
            <PlayingCard
              card={card}
              state={state}
              size="lg"
              onClick={state === "playable" ? () => onPlayCard(id) : undefined}
            />
          </div>
        );
      })}
    </div>
  );
}
