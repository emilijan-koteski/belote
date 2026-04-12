import type { Card } from "@/shared/types/gameTypes";

import { PlayingCard } from "./PlayingCard";
import type { CardState } from "./PlayingCard";

interface HandCardsProps {
  hand: Card[];
  isMyTurn: boolean;
  playableCardIds: string[];
  onPlayCard: (cardId: string) => void;
}

const CARD_WIDTH_MD = 56; // w-14 = 3.5rem = 56px

function cardId(card: Card): string {
  return `${card.rank}${card.suit}`;
}

export function HandCards({ hand, isMyTurn, playableCardIds, onPlayCard }: HandCardsProps) {
  if (hand.length === 0) {
    return <div className="relative h-20" data-testid="hand-cards" />;
  }

  const overlap = Math.max(32, 56 - (hand.length - 1) * 4);
  const containerWidth = (hand.length - 1) * overlap + CARD_WIDTH_MD;

  return (
    <div
      className="relative h-20 flex items-end"
      style={{ width: containerWidth }}
      data-testid="hand-cards"
    >
      {hand.map((card, index) => {
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
