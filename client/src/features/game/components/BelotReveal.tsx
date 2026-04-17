import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import type { Rank, Suit } from "@/shared/types/gameTypes";

import { PlayingCard } from "./PlayingCard";

interface BelotRevealProps {
  playerSeat: number;
  myPlayerSeat: number;
  cardId: string;
  isKing: boolean;
  onComplete: () => void;
}

const PANEL_POSITIONS: Record<number, string> = {
  0: "bottom-56 left-1/2 -translate-x-1/2", // South (self)
  1: "left-28 top-1/2 -translate-y-1/2", // West
  2: "top-20 left-1/2 -translate-x-1/2", // North
  3: "right-28 top-1/2 -translate-y-1/2", // East
};

function compassOffset(seat: number, myPlayerSeat: number): number {
  return (seat - myPlayerSeat + 4) % 4;
}

function parseCardId(id: string) {
  return { rank: id[0] as Rank, suit: id[1] as Suit };
}

export function BelotReveal({
  playerSeat,
  myPlayerSeat,
  cardId,
  isKing,
  onComplete,
}: BelotRevealProps) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(true);

  const prefersReducedMotion = useMemo(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  useEffect(() => {
    const duration = prefersReducedMotion ? 1500 : 4000;
    const timer = setTimeout(() => {
      setVisible(false);
      onComplete();
    }, duration);
    return () => clearTimeout(timer);
  }, [prefersReducedMotion, onComplete]);

  if (!visible) {
    return null;
  }

  const compass = compassOffset(playerSeat, myPlayerSeat);
  const labelKey = isKing ? "game.belot.reveal.rebelot" : "game.belot.reveal.belot";

  return (
    <div
      className={`absolute ${PANEL_POSITIONS[compass]} pointer-events-none z-20`}
      data-testid="belot-reveal"
    >
      <div
        className={`bg-surface-elevated/95 border border-border rounded-lg px-3 py-2 shadow-lg ${
          prefersReducedMotion
            ? ""
            : "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300"
        }`}
      >
        <p
          className="text-text-primary font-display text-base font-semibold mb-2 text-center"
          data-testid="belot-reveal-label"
        >
          {t(labelKey)}
        </p>
        <div className="flex justify-center">
          <PlayingCard
            card={parseCardId(cardId)}
            state="default"
            size="sm"
            withTransition={false}
          />
        </div>
      </div>
    </div>
  );
}
