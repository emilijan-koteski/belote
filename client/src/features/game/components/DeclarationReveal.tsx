import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import type { PlayerState, Rank, Suit } from "@/shared/types/gameTypes";
import type { DeclarationsResolvedPayload } from "@/shared/types/wsEvents";

import { PlayingCard } from "./PlayingCard";

interface DeclarationRevealProps {
  payload: DeclarationsResolvedPayload;
  players: readonly PlayerState[];
  onComplete: () => void;
}

function parseCardId(id: string) {
  return { rank: id[0] as Rank, suit: id[1] as Suit };
}

function declarationLabelKey(type: string): "sequenceShort" | "fourOfAKindShort" {
  return type === "four_of_a_kind" ? "fourOfAKindShort" : "sequenceShort";
}

export function DeclarationReveal({ payload, players, onComplete }: DeclarationRevealProps) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(true);

  const prefersReducedMotion = useMemo(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  useEffect(() => {
    const duration = prefersReducedMotion ? 1500 : 8000;
    const timer = setTimeout(() => {
      setVisible(false);
      onComplete();
    }, duration);
    return () => clearTimeout(timer);
  }, [prefersReducedMotion, onComplete]);

  const firstDeclaration = payload.declarations[0];
  if (!visible || payload.winnerTeam === null || firstDeclaration === undefined) {
    return null;
  }

  const teamName =
    payload.winnerTeam === 0 ? t("game.declaration.teamRed") : t("game.declaration.teamBlue");

  return (
    <div
      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-20"
      data-testid="declaration-reveal"
    >
      <div
        className={`bg-surface-elevated/95 border border-border rounded-lg px-3 py-2 shadow-lg ${
          prefersReducedMotion
            ? ""
            : "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300"
        }`}
      >
        <p
          className="text-text-secondary font-body text-xs mb-2 text-center"
          data-testid="declaration-reveal-team"
          data-team={payload.winnerTeam}
        >
          {t("game.declaration.teamDeclared", { team: teamName })}
        </p>
        <div className="flex flex-col gap-2">
          {payload.declarations.map((decl, i) => {
            const declarer = players.find((p) => p.seat === decl.playerSeat);
            const username = declarer?.username ?? `#${decl.playerSeat}`;
            return (
              <div key={i} className="flex flex-col items-center gap-1">
                <span
                  className="text-text-primary font-display text-xs font-semibold"
                  data-testid="declaration-reveal-declarer"
                  data-seat={decl.playerSeat}
                >
                  {username}
                </span>
                <span className="text-text-secondary font-body text-[11px]">
                  {t(`game.declaration.${declarationLabelKey(decl.type)}`, {
                    count: decl.cards.length,
                  })}
                </span>
                <div className="flex flex-wrap gap-1 justify-center">
                  {decl.cards.map((cardId) => (
                    <PlayingCard
                      key={cardId}
                      card={parseCardId(cardId)}
                      state="default"
                      size="sm"
                      withTransition={false}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
