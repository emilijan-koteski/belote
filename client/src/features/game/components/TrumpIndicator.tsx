import { useTranslation } from "react-i18next";

import type { Suit, TeamString } from "@/shared/types/gameTypes";

interface TrumpIndicatorProps {
  trumpSuit: Suit;
  trumpCallerSeat?: number | null;
  trumpCallerName?: string | null;
}

const SUIT_SYMBOL: Record<Suit, string> = {
  S: "♠",
  H: "♥",
  D: "♦",
  C: "♣",
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

const TEAM_BORDER: Record<TeamString, string> = {
  teamA: "border-team-a",
  teamB: "border-team-b",
};

const TEAM_TEXT: Record<TeamString, string> = {
  teamA: "text-team-a",
  teamB: "text-team-b",
};

const TEAM_BG: Record<TeamString, string> = {
  teamA: "bg-team-a/10",
  teamB: "bg-team-b/10",
};

const TEAM_NAME_KEY: Record<TeamString, string> = {
  teamA: "team.a",
  teamB: "team.b",
};

function callerTeam(seat: number): TeamString {
  return seat % 2 === 0 ? "teamA" : "teamB";
}

export function TrumpIndicator({
  trumpSuit,
  trumpCallerSeat,
  trumpCallerName,
}: TrumpIndicatorProps) {
  const { t } = useTranslation();

  const team: TeamString | null =
    typeof trumpCallerSeat === "number" ? callerTeam(trumpCallerSeat) : null;

  const callerName = trumpCallerName?.trim() || null;

  const suitName = t(SUIT_NAME_KEY[trumpSuit]);
  const teamName = team ? t(TEAM_NAME_KEY[team]) : null;
  const ariaLabel =
    team && teamName && callerName
      ? t("game.trumpIndicator.labelWithCaller", {
          suit: suitName,
          team: teamName,
          name: callerName,
        })
      : team && teamName
        ? t("game.trumpIndicator.labelWithTeam", { suit: suitName, team: teamName })
        : t("game.trumpIndicator.label", { suit: suitName });

  const containerClass = team
    ? `flex items-center gap-2 rounded-full border-2 ${TEAM_BORDER[team]} ${TEAM_BG[team]} px-3 py-1`
    : "flex items-center gap-2";

  return (
    <div
      className={containerClass}
      aria-live="polite"
      aria-label={ariaLabel}
      data-testid="trump-indicator"
      data-team={team ?? undefined}
    >
      <span className="text-text-secondary font-body text-sm">
        {t("game.trumpIndicator.trump")}
      </span>
      <span className={`${SUIT_COLOR[trumpSuit]} font-display text-lg font-semibold`}>
        {SUIT_SYMBOL[trumpSuit]}
      </span>
      {team && teamName && (
        <>
          <span className="text-text-secondary/40" aria-hidden>
            ·
          </span>
          <span
            className={`${TEAM_TEXT[team]} font-display text-sm font-semibold`}
            data-testid="trump-caller-team"
            data-team={team}
          >
            {teamName}
          </span>
        </>
      )}
      {team && callerName && (
        <>
          <span className="text-text-secondary/40" aria-hidden>
            ·
          </span>
          <span className="text-text-primary font-body text-sm" data-testid="trump-caller-name">
            {callerName}
          </span>
        </>
      )}
    </div>
  );
}
