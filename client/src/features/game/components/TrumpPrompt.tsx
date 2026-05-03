import { useTranslation } from "react-i18next";

import { useFocusTrap } from "@/shared/hooks/useFocusTrap";
import type { Card, Suit } from "@/shared/types/gameTypes";

import { ButtonTimerRing } from "./overlay/ButtonTimerRing";
import { ClassicButton } from "./overlay/ClassicButton";
import { ClassicPanel } from "./overlay/ClassicPanel";
import { OverlayBackdrop } from "./overlay/OverlayBackdrop";
import { PlayingCard } from "./PlayingCard";

interface TrumpPromptProps {
  trumpCandidate: Card | null;
  biddingRound: number;
  isActiveBidder: boolean;
  onPick: (suit?: Suit) => void;
  onPass: () => void;
  turnExpiresAt?: string | null;
  timerDurationSec?: number;
}

const SUITS: Suit[] = ["S", "H", "D", "C"];

const SUIT_SYMBOL: Record<Suit, string> = {
  S: "♠",
  H: "♥",
  D: "♦",
  C: "♣",
};

const SUIT_COLOR: Record<Suit, string> = {
  S: "var(--suit-black, #1a1a1a)",
  H: "var(--suit-red-up, #ff8585)",
  D: "var(--suit-red-up, #ff8585)",
  C: "var(--suit-black, #1a1a1a)",
};

export function TrumpPrompt({
  trumpCandidate,
  biddingRound,
  isActiveBidder,
  onPick,
  onPass,
  turnExpiresAt,
  timerDurationSec,
}: TrumpPromptProps) {
  const { t } = useTranslation();
  const promptRef = useFocusTrap<HTMLDivElement>();
  const showRing = isActiveBidder && Boolean(turnExpiresAt) && (timerDurationSec ?? 0) > 0;

  // Non-active bidders see a non-blocking status indicator, not a dialog.
  if (!isActiveBidder) {
    return (
      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none z-20"
        data-testid="trump-prompt"
      >
        <div
          className="rounded-lg px-4 py-3"
          style={{
            background: "var(--panel-dark, rgba(20,45,30,0.85))",
            border: "1px solid rgba(201,168,118,0.4)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
          }}
        >
          <p
            className="font-body text-sm text-center"
            style={{ color: "var(--ink-light, #f5f2e8)", opacity: 0.85 }}
          >
            {t("game.trumpPrompt.waiting")}
          </p>
        </div>
      </div>
    );
  }

  const title =
    biddingRound === 1 ? t("game.trumpPrompt.titleRound1") : t("game.trumpPrompt.titleRound2");

  return (
    <OverlayBackdrop dim={0.5}>
      <div
        ref={promptRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="trump-prompt-title"
        data-testid="trump-prompt"
        className="motion-safe:animate-in motion-safe:zoom-in-95 motion-safe:duration-150 max-h-[90vh] overflow-y-auto"
      >
        <ClassicPanel width={520} title={<span id="trump-prompt-title">{title}</span>}>
          {/* Trump candidate card — visible in both rounds. In round 2 the
              picker still inherits this card as their 8th card after picking,
              so it stays on-screen alongside the suit-selection grid. */}
          {trumpCandidate && (
            <div className="flex justify-center mb-4">
              <PlayingCard card={trumpCandidate} state="default" size="lg" withTransition={false} />
            </div>
          )}

          {/* Round 2: 4 suit buttons. The originally face-up candidate's suit
              is locked (Bitola "spent suit" rule) — it stays in the grid but
              disabled so the layout is stable and the player sees which suit
              is unavailable. */}
          {biddingRound === 2 && (
            <div className="grid grid-cols-2 gap-2 mb-4">
              {SUITS.map((suit) => {
                const isLocked = trumpCandidate?.suit === suit;
                return (
                  <button
                    key={suit}
                    type="button"
                    disabled={isLocked}
                    aria-disabled={isLocked}
                    onClick={() => onPick(suit)}
                    data-testid={`trump-prompt-suit-${suit}`}
                    className="flex items-center gap-3 px-4 py-3 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer hover:not-disabled:brightness-110 transition-[filter] duration-150"
                    style={{
                      background: "rgba(0,0,0,0.25)",
                      border: "1px solid rgba(201,168,118,0.35)",
                      color: "var(--ink-light, #f5f2e8)",
                      fontFamily: 'Georgia, "Times New Roman", serif',
                      fontSize: 15,
                    }}
                  >
                    <span style={{ fontSize: 22, color: SUIT_COLOR[suit] }}>
                      {SUIT_SYMBOL[suit]}
                    </span>
                    <span className="capitalize">{t(`game.suits.${suitName(suit)}`)}</span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex items-center justify-between gap-3">
            <span
              className="font-body text-[11px]"
              style={{ color: "var(--ink-light, #f5f2e8)", opacity: 0.55 }}
            >
              {t("game.trumpPrompt.roundLabel", {
                round: biddingRound,
                defaultValue: `Round ${biddingRound} / 2`,
              })}
            </span>
            <div className="flex items-center gap-3">
              {showRing ? (
                <ButtonTimerRing
                  turnExpiresAt={turnExpiresAt}
                  totalDuration={timerDurationSec ?? 0}
                >
                  <ClassicButton onClick={onPass} data-testid="trump-prompt-pass">
                    {t("game.trumpPrompt.pass")}
                  </ClassicButton>
                </ButtonTimerRing>
              ) : (
                <ClassicButton onClick={onPass} data-testid="trump-prompt-pass">
                  {t("game.trumpPrompt.pass")}
                </ClassicButton>
              )}
              {biddingRound === 1 && (
                <ClassicButton
                  variant="primary"
                  onClick={() => onPick()}
                  data-testid="trump-prompt-pick"
                >
                  {t("game.trumpPrompt.pick")}
                </ClassicButton>
              )}
            </div>
          </div>
        </ClassicPanel>
      </div>
    </OverlayBackdrop>
  );
}

function suitName(suit: Suit): "spades" | "hearts" | "diamonds" | "clubs" {
  switch (suit) {
    case "S":
      return "spades";
    case "H":
      return "hearts";
    case "D":
      return "diamonds";
    case "C":
      return "clubs";
  }
}
