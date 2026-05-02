import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useReducedMotion } from "@/shared/hooks/useReducedMotion";
import type { PlayerState, Rank, Suit } from "@/shared/types/gameTypes";

import { PlayingCard } from "./PlayingCard";

interface TrumpRevealProps {
  playerSeat: number;
  cardId: string;
  players: readonly PlayerState[];
  onComplete: () => void;
}

function parseCardId(id: string) {
  return { rank: id[0] as Rank, suit: id[1] as Suit };
}

export function TrumpReveal({ playerSeat, cardId, players, onComplete }: TrumpRevealProps) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(true);

  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    const duration = prefersReducedMotion ? 1500 : 3500;
    const timer = setTimeout(() => {
      setVisible(false);
      onComplete();
    }, duration);
    return () => clearTimeout(timer);
  }, [prefersReducedMotion, onComplete]);

  // Defence in depth: WS dispatch already drops payloads with cardId.length < 2,
  // but parseCardId would silently produce undefined suit/rank if reached with
  // a short string (e.g. via tests or future code paths) — guard at the boundary.
  if (!visible || cardId.length < 2) {
    return null;
  }

  const picker = players.find((p) => p.seat === playerSeat);
  const title = picker?.username
    ? t("game.trumpReveal.title", { name: picker.username })
    : t("game.trumpReveal.unknownPlayer");

  return (
    <div
      className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none"
      data-testid="trump-reveal"
    >
      <div
        className={`bg-surface-elevated/95 border border-border rounded-lg px-4 py-3 shadow-lg flex flex-col items-center gap-2 ${
          prefersReducedMotion
            ? ""
            : "motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:duration-300"
        }`}
      >
        <p
          className="text-text-primary font-display text-base font-semibold"
          data-testid="trump-reveal-title"
          data-seat={playerSeat}
        >
          {title}
        </p>
        <PlayingCard card={parseCardId(cardId)} state="default" size="md" withTransition={false} />
      </div>
    </div>
  );
}
