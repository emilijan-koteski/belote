import type { Card, Rank, Suit } from "@/shared/types/gameTypes";

import type { CardState } from "./PlayingCard";
import { PlayingCard } from "./PlayingCard";

interface HandCardsProps {
  hand: Card[];
  isMyTurn: boolean;
  playableCardIds: string[];
  onPlayCard: (cardId: string) => void;
}

const CARD_WIDTH_MD = 56; // w-14 = 3.5rem = 56px

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

export function HandCards({ hand, isMyTurn, playableCardIds, onPlayCard }: HandCardsProps) {
  if (hand.length === 0) {
    return <div className="relative h-20" data-testid="hand-cards" />;
  }

  const sortedHand = sortHand(hand);
  const overlap = Math.max(32, 56 - (sortedHand.length - 1) * 4);
  const containerWidth = (sortedHand.length - 1) * overlap + CARD_WIDTH_MD;

  return (
    <div
      className="relative h-20 flex items-end"
      style={{ width: containerWidth }}
      data-testid="hand-cards"
    >
      {sortedHand.map((card, index) => {
        const id = cardId(card);
        let state: CardState = "default";
        if (isMyTurn) {
          state = playableCardIds.includes(id) ? "playable" : "unplayable";
        }

        return (
          <div
            key={id}
            className="absolute bottom-0"
            style={{ left: index * overlap, zIndex: index }}
          >
            <PlayingCard
              card={card}
              state={state}
              size="md"
              onClick={state === "playable" ? () => onPlayCard(id) : undefined}
            />
          </div>
        );
      })}
    </div>
  );
}
