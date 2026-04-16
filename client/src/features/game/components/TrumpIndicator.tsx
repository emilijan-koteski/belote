import { useTranslation } from "react-i18next";

import type { Suit } from "@/shared/types/gameTypes";

interface TrumpIndicatorProps {
  trumpSuit: Suit;
}

const SUIT_SYMBOL: Record<Suit, string> = {
  S: "\u2660",
  H: "\u2665",
  D: "\u2666",
  C: "\u2663",
};

const SUIT_NAME_KEY: Record<Suit, string> = {
  S: "game.suits.spades",
  H: "game.suits.hearts",
  D: "game.suits.diamonds",
  C: "game.suits.clubs",
};

const SUIT_COLOR: Record<Suit, string> = {
  S: "text-text-primary",
  H: "text-red-500",
  D: "text-red-500",
  C: "text-text-primary",
};

export function TrumpIndicator({ trumpSuit }: TrumpIndicatorProps) {
  const { t } = useTranslation();

  return (
    <div
      className="flex items-center gap-2"
      aria-live="polite"
      aria-label={t("game.trumpIndicator.label", { suit: t(SUIT_NAME_KEY[trumpSuit]) })}
      data-testid="trump-indicator"
    >
      <span className="text-text-secondary font-body text-sm">
        {t("game.trumpIndicator.trump")}
      </span>
      <span className={`${SUIT_COLOR[trumpSuit]} font-display text-lg font-semibold`}>
        {SUIT_SYMBOL[trumpSuit]}
      </span>
    </div>
  );
}
