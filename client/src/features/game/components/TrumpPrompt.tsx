import { useTranslation } from "react-i18next";

import { Button } from "@/shared/components/ui/button";
import { useFocusTrap } from "@/shared/hooks/useFocusTrap";
import type { Card, Suit } from "@/shared/types/gameTypes";

import { PlayingCard } from "./PlayingCard";

interface TrumpPromptProps {
  trumpCandidate: Card | null;
  biddingRound: number;
  isActiveBidder: boolean;
  onPick: (suit?: Suit) => void;
  onPass: () => void;
}

const SUITS: Suit[] = ["S", "H", "D", "C"];

const SUIT_SYMBOL: Record<Suit, string> = {
  S: "\u2660",
  H: "\u2665",
  D: "\u2666",
  C: "\u2663",
};

const SUIT_COLOR: Record<Suit, string> = {
  S: "text-text-primary",
  H: "text-red-500",
  D: "text-red-500",
  C: "text-text-primary",
};

export function TrumpPrompt({
  trumpCandidate,
  biddingRound,
  isActiveBidder,
  onPick,
  onPass,
}: TrumpPromptProps) {
  const { t } = useTranslation();
  const promptRef = useFocusTrap<HTMLDivElement>();

  // Non-active bidders see a non-blocking status indicator, not a dialog
  if (!isActiveBidder) {
    return (
      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none z-20"
        data-testid="trump-prompt"
      >
        <div className="bg-surface-elevated/80 border border-border rounded-lg px-4 py-3">
          <p className="text-text-secondary font-body text-sm text-center">
            {t("game.trumpPrompt.waiting")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="absolute inset-0 flex items-center justify-center z-30"
      data-testid="trump-prompt"
    >
      {/* Backdrop — blocks card interaction */}
      <div className="absolute inset-0 bg-black/40" />

      <div
        ref={promptRef}
        className="relative bg-surface-elevated border border-border rounded-lg p-6 max-w-[480px] w-full mx-4 motion-safe:animate-in motion-safe:zoom-in-95 motion-safe:duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="trump-prompt-title"
      >
        <h2
          id="trump-prompt-title"
          className="text-text-primary font-display text-lg font-semibold text-center mb-4"
        >
          {biddingRound === 1
            ? t("game.trumpPrompt.titleRound1")
            : t("game.trumpPrompt.titleRound2")}
        </h2>

        {/* Trump candidate card — visible in both rounds. In round 2 the
            picker still inherits this card as their 8th card after picking,
            so it stays on screen alongside the suit-selection grid. */}
        {trumpCandidate && (
          <div className="flex justify-center mb-4">
            <PlayingCard card={trumpCandidate} state="default" size="lg" withTransition={false} />
          </div>
        )}

        {/* Round 2: show 4 suit buttons for free selection. The originally
            face-up candidate's suit is locked out (Bitola "spent suit" rule)
            — it stays in the grid but disabled so the layout is stable and
            the player sees which suit is unavailable. */}
        {biddingRound === 2 && (
          <div className="grid grid-cols-4 gap-2 mb-4">
            {SUITS.map((suit) => {
              const isLocked = trumpCandidate?.suit === suit;
              return (
                <Button
                  key={suit}
                  variant="outline"
                  disabled={isLocked}
                  aria-disabled={isLocked}
                  className={`text-2xl font-display py-4 ${SUIT_COLOR[suit]} hover:bg-accent/10 hover:border-accent`}
                  onClick={() => onPick(suit)}
                  data-testid={`trump-prompt-suit-${suit}`}
                >
                  {SUIT_SYMBOL[suit]}
                </Button>
              );
            })}
          </div>
        )}

        <div className="flex gap-3 justify-center">
          {biddingRound === 1 && (
            <Button onClick={() => onPick()} data-testid="trump-prompt-pick">
              {t("game.trumpPrompt.pick")}
            </Button>
          )}
          <Button variant="ghost" onClick={onPass} data-testid="trump-prompt-pass">
            {t("game.trumpPrompt.pass")}
          </Button>
        </div>
      </div>
    </div>
  );
}
