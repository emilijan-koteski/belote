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
  /**
   * Override the lime halo color used when `state === "playable"`. Default
   * lime; pass a different token (e.g. brass) for prompt previews where the
   * playable highlight needs a different meaning.
   */
  glowColor?: string;
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
  S: "♠",
  H: "♥",
  D: "♦",
  C: "♣",
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

interface CardDimensions {
  width: number;
  height: number;
}

const SIZE_DIMENSIONS: Record<CardSize, CardDimensions> = {
  sm: { width: 44, height: 64 },
  md: { width: 64, height: 92 },
  lg: { width: 88, height: 128 },
};

const SIZE_CLASSES: Record<CardSize, string> = {
  sm: "w-11 h-16",
  md: "w-16 h-[5.75rem]",
  lg: "w-[5.5rem] h-32",
};

function suitColor(suit: Suit): string {
  return suit === "H" || suit === "D" ? "var(--suit-red, #c62828)" : "var(--suit-black, #1a1a1a)";
}

function isFace(rank: Rank): boolean {
  return rank === "J" || rank === "Q" || rank === "K";
}

const DEFAULT_GLOW = "var(--turn-lime, #00e5a0)";

/**
 * Classic casino-style playing card. Three states drive presentation:
 *  • `playable`   — lifted upward with a lime halo (turn / action channel).
 *  • `unplayable` — kept at full opacity (per design "do not make them
 *                    transparent"); cursor flips to not-allowed.
 *  • `face-down`  — parchment-on-wood back with the "B" monogram.
 *
 * Visual chrome (parchment gradient, suit colors, glow) is driven by
 * `.game-table` CSS vars so tests rendering the card standalone fall back to
 * the literal hex values declared in {@link suitColor} / {@link DEFAULT_GLOW}.
 */
export function PlayingCard({
  card,
  state,
  size,
  onClick,
  withTransition = true,
  glowColor = DEFAULT_GLOW,
}: PlayingCardProps) {
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

  const dims = SIZE_DIMENSIONS[size];
  const sizeClass = SIZE_CLASSES[size];

  // State-dependent positioning & cursor — classes the test suite asserts on.
  const stateClasses = isPlayable
    ? "motion-safe:translate-y-[-10px] cursor-pointer motion-safe:hover:translate-y-[-14px] focus-visible:ring-2 focus-visible:ring-[color:var(--turn-lime)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--felt-deep)]"
    : isUnplayable
      ? "motion-safe:translate-y-[4px] cursor-not-allowed"
      : "";

  const transitionClasses = withTransition
    ? "motion-safe:transition-transform motion-safe:duration-150"
    : "";

  const cardId = card ? `${card.rank}${card.suit}` : undefined;
  const role = isPlayable ? "button" : undefined;

  // Lime halo on playable cards. Inline so we can pin the glow stops to the
  // lime token regardless of nesting.
  const playableGlow = isPlayable
    ? `0 10px 22px rgba(0,0,0,0.35), 0 0 0 2px ${glowColor}, 0 0 18px ${glowColor}cc`
    : isFaceDown
      ? "0 4px 10px rgba(0,0,0,0.45)"
      : "0 3px 6px rgba(0,0,0,0.3)";

  if (isFaceDown) {
    return (
      <div
        className={`${sizeClass} relative select-none rounded-md overflow-hidden ${stateClasses} ${transitionClasses}`}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        tabIndex={isPlayable ? 0 : -1}
        role={role}
        aria-label={ariaLabel}
        aria-disabled={isUnplayable ? true : undefined}
        data-testid="playing-card-facedown"
        style={{
          background: "linear-gradient(135deg, #2a1a10 0%, #4a2818 50%, #2a1a10 100%)",
          border: "2px solid var(--brass, #c9a876)",
          boxShadow: `${playableGlow}, inset 0 0 0 1px rgba(201,168,118,0.35)`,
        }}
      >
        <div
          className="absolute rounded-sm"
          style={{
            inset: 4,
            border: "1px solid rgba(201,168,118,0.45)",
            backgroundImage:
              "repeating-linear-gradient(45deg, transparent 0 6px, rgba(201,168,118,0.1) 6px 7px)",
          }}
        />
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            color: "var(--brass, #c9a876)",
            fontFamily: 'Georgia, "Times New Roman", serif',
            fontSize: dims.width * 0.3,
            fontStyle: "italic",
            fontWeight: 700,
            textShadow: "0 1px 2px rgba(0,0,0,0.6)",
          }}
        >
          B
        </div>
      </div>
    );
  }

  const color = suitColor(card!.suit);
  const label = DISPLAY_RANK[card!.rank];
  const glyph = DISPLAY_SUIT[card!.suit];
  const face = isFace(card!.rank);

  return (
    <div
      className={`${sizeClass} relative select-none rounded-md overflow-hidden ${stateClasses} ${transitionClasses}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={isPlayable ? 0 : -1}
      role={role}
      aria-label={ariaLabel}
      aria-disabled={isUnplayable ? true : undefined}
      data-testid={`playing-card-${cardId}`}
      style={{
        background: "linear-gradient(180deg, #fdfaf0 0%, #f4ecd8 100%)",
        border: "1px solid rgba(0,0,0,0.15)",
        boxShadow: playableGlow,
        fontFamily: 'Georgia, "Times New Roman", serif',
      }}
    >
      {/* Top-left rank + suit */}
      <div
        className="absolute leading-none text-center"
        style={{ top: 4, left: 6, color, lineHeight: 1 }}
      >
        <div style={{ fontSize: dims.width * 0.24, fontWeight: 700 }}>{label}</div>
        <div style={{ fontSize: dims.width * 0.22, marginTop: 1 }}>{glyph}</div>
      </div>
      {/* Bottom-right mirrored */}
      <div
        className="absolute leading-none text-center rotate-180"
        style={{ bottom: 4, right: 6, color, lineHeight: 1 }}
      >
        <div style={{ fontSize: dims.width * 0.24, fontWeight: 700 }}>{label}</div>
        <div style={{ fontSize: dims.width * 0.22, marginTop: 1 }}>{glyph}</div>
      </div>
      {/* Center pip — italic letter for face cards, big suit glyph otherwise */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{
          color,
          fontSize: dims.width * (face ? 0.55 : 0.75),
          fontWeight: face ? 600 : 400,
        }}
      >
        {face ? (
          <span style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontStyle: "italic" }}>
            {card!.rank}
          </span>
        ) : (
          glyph
        )}
      </div>
    </div>
  );
}
