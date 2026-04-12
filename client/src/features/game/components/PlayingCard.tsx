import type { Card, Rank, Suit } from "@/shared/types/gameTypes";

export type CardState = "default" | "playable" | "unplayable" | "face-down";
export type CardSize = "sm" | "md" | "lg";

interface PlayingCardProps {
  card: Card | null;
  state: CardState;
  size: CardSize;
  onClick?: () => void;
  /** When false, suppress transition classes (e.g., cards in TrickArea). Defaults to true. */
  withTransition?: boolean;
}

const DISPLAY_RANK: Record<Rank, string> = {
  "7": "7",
  "8": "8",
  "9": "9",
  T: "10",
  J: "J",
  Q: "Q",
  K: "K",
  A: "A",
};

const DISPLAY_SUIT: Record<Suit, string> = {
  S: "\u2660",
  H: "\u2665",
  D: "\u2666",
  C: "\u2663",
};

const RANK_FULL_NAME: Record<Rank, string> = {
  "7": "Seven",
  "8": "Eight",
  "9": "Nine",
  T: "Ten",
  J: "Jack",
  Q: "Queen",
  K: "King",
  A: "Ace",
};

const SUIT_FULL_NAME: Record<Suit, string> = {
  S: "Spades",
  H: "Hearts",
  D: "Diamonds",
  C: "Clubs",
};

const SIZE_CLASSES: Record<CardSize, string> = {
  sm: "w-10 h-14",
  md: "w-14 h-20",
  lg: "w-20 h-28",
};

function suitColorClass(suit: Suit): string {
  return suit === "H" || suit === "D" ? "text-red-500" : "text-text-primary";
}

export function PlayingCard({ card, state, size, onClick, withTransition = true }: PlayingCardProps) {
  const isFaceDown = state === "face-down" || card === null;
  const isPlayable = state === "playable";
  const isUnplayable = state === "unplayable";

  const handleClick = () => {
    if (isPlayable && onClick) {
      onClick();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === "Enter" || e.key === " ") && isPlayable && onClick) {
      e.preventDefault();
      onClick();
    }
  };

  const ariaLabel = isFaceDown
    ? "face-down card"
    : `${RANK_FULL_NAME[card!.rank]} of ${SUIT_FULL_NAME[card!.suit]}`;

  const baseClasses = `${SIZE_CLASSES[size]} bg-surface rounded-lg border border-border relative select-none`;

  const stateClasses = isPlayable
    ? "motion-safe:translate-y-[-4px] shadow-[0_0_12px_var(--color-accent-glow)] cursor-pointer motion-safe:hover:translate-y-[-6px] focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    : isUnplayable
      ? "opacity-40 cursor-not-allowed"
      : "";

  const transitionClasses = withTransition
    ? "motion-safe:transition-transform motion-safe:duration-150"
    : "";

  const cardId = card ? `${card.rank}${card.suit}` : undefined;

  const role = isPlayable ? "button" : undefined;

  return (
    <div
      className={`${baseClasses} ${stateClasses} ${transitionClasses}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={isPlayable ? 0 : -1}
      role={role}
      aria-label={ariaLabel}
      aria-disabled={isUnplayable ? true : undefined}
      data-testid={cardId ? `playing-card-${cardId}` : "playing-card-facedown"}
    >
      {isFaceDown ? (
        <div className="w-full h-full rounded-lg bg-surface-elevated border border-border" />
      ) : (
        <div className={`w-full h-full flex flex-col justify-between p-1 ${suitColorClass(card!.suit)}`}>
          <div className="text-xs font-body leading-none">
            <span>{DISPLAY_RANK[card!.rank]}</span>
            <span>{DISPLAY_SUIT[card!.suit]}</span>
          </div>
          <div className="flex-1 flex items-center justify-center text-lg">
            {DISPLAY_SUIT[card!.suit]}
          </div>
          <div className="text-xs font-body leading-none self-end rotate-180">
            <span>{DISPLAY_RANK[card!.rank]}</span>
            <span>{DISPLAY_SUIT[card!.suit]}</span>
          </div>
        </div>
      )}
    </div>
  );
}
