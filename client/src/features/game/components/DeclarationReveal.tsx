import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useReducedMotion } from "@/shared/hooks/useReducedMotion";
import type { PlayerState, Rank, Suit } from "@/shared/types/gameTypes";
import { type TeamString, teamStringForIndex } from "@/shared/types/gameTypes";
import type { DeclarationsResolvedPayload } from "@/shared/types/wsEvents";

import { TEAM_GOLD, TEAM_SILVER } from "../lib/tableTheme";
import { AutoCloseRing } from "./overlay/AutoCloseRing";
import { PlayingCard } from "./PlayingCard";

interface DeclarationRevealProps {
  payload: DeclarationsResolvedPayload;
  players: readonly PlayerState[];
  viewerTeam: TeamString;
  onComplete: () => void;
}

function parseCardId(id: string) {
  return { rank: id[0] as Rank, suit: id[1] as Suit };
}

function declarationLabelKey(type: string): "sequenceShort" | "fourOfAKindShort" {
  return type === "four_of_a_kind" ? "fourOfAKindShort" : "sequenceShort";
}

/**
 * Team declarations resolution — full classic-panel reveal showing the
 * winning team's melds. Glow ring follows the winning team's viewer-relative
 * color (Gold = your team won, Silver = opponents). Auto-closes after 8 s
 * or via the X-with-countdown-ring.
 */
export function DeclarationReveal({
  payload,
  players,
  viewerTeam,
  onComplete,
}: DeclarationRevealProps) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(true);

  const prefersReducedMotion = useReducedMotion();

  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const handleClose = () => {
    if (!visible) return;
    setVisible(false);
    onCompleteRef.current();
  };

  const firstDeclaration = payload.declarations[0];
  if (!visible || payload.winnerTeam === null || firstDeclaration === undefined) {
    return null;
  }

  const winnerTeamString = teamStringForIndex(payload.winnerTeam === 0 ? 0 : 1);
  const isUs = winnerTeamString === viewerTeam;
  const teamName = isUs ? t("team.us") : t("team.them");
  const teamGradient = isUs ? TEAM_GOLD : TEAM_SILVER;
  const glowColor = teamGradient[0];

  return (
    <div
      className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 ${
        prefersReducedMotion
          ? ""
          : "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300"
      }`}
      data-testid="declaration-reveal"
    >
      <div
        className="relative rounded-2xl"
        style={{
          width: 460,
          background: "linear-gradient(180deg, rgba(30,60,40,0.98) 0%, rgba(14,40,24,0.98) 100%)",
          border: "1px solid rgba(201,168,118,0.55)",
          boxShadow: `0 12px 32px rgba(0,0,0,0.55), 0 0 0 2px ${glowColor}88, 0 0 24px ${glowColor}77, inset 0 1px 0 rgba(201,168,118,0.22)`,
          color: "var(--ink-light, #f5f2e8)",
          fontFamily: "system-ui, sans-serif",
          padding: "16px 18px",
        }}
        data-team={winnerTeamString}
      >
        <div className="absolute top-2 right-2">
          <AutoCloseRing
            duration={prefersReducedMotion ? 1.5 : 8}
            onClose={handleClose}
            ariaLabel={t("game.declaration.dismiss", { defaultValue: "Dismiss" })}
            testId="declaration-reveal-close"
          />
        </div>

        <div className="flex items-center gap-2 mb-3 pr-10">
          <span
            aria-hidden
            className="rounded-full"
            style={{
              width: 9,
              height: 9,
              background: glowColor,
              boxShadow: `0 0 8px ${glowColor}`,
            }}
          />
          <p
            className="font-display text-sm font-semibold"
            style={{ color: "var(--ink-light, #f5f2e8)", letterSpacing: 0.3 }}
            data-testid="declaration-reveal-team"
            data-team={winnerTeamString}
          >
            {t("game.declaration.teamDeclared", { team: teamName })}
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {payload.declarations.map((decl, i) => {
            const declarer = players.find((p) => p.seat === decl.playerSeat);
            const username = declarer?.username ?? `#${decl.playerSeat}`;
            return (
              <div
                key={i}
                className="flex items-center gap-3 rounded-lg px-3 py-2"
                style={{
                  background: "rgba(0,0,0,0.22)",
                  border: "1px solid rgba(201,168,118,0.25)",
                }}
              >
                <div className="flex shrink-0">
                  {decl.cards.map((cardId, j) => (
                    <div key={cardId} style={{ marginLeft: j === 0 ? 0 : -16, zIndex: j }}>
                      <PlayingCard
                        card={parseCardId(cardId)}
                        state="default"
                        size="sm"
                        withTransition={false}
                      />
                    </div>
                  ))}
                </div>
                <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                  <span
                    className="font-display text-sm font-semibold truncate"
                    style={{ color: "var(--ink-light, #f5f2e8)" }}
                    data-testid="declaration-reveal-declarer"
                    data-seat={decl.playerSeat}
                  >
                    {username}
                  </span>
                  <span
                    className="font-body text-[11px]"
                    style={{ color: "var(--ink-light, #f5f2e8)", opacity: 0.7 }}
                  >
                    {t(`game.declaration.${declarationLabelKey(decl.type)}`, {
                      count: decl.cards.length,
                    })}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
