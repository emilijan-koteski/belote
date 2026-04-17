import { useTranslation } from "react-i18next";

import type { Suit } from "@/shared/types/gameTypes";

interface TrumpIndicatorProps {
  trumpSuit: Suit;
  trumpCallerSeat?: number | null;
}

type Team = "red" | "blue";

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

const TEAM_BORDER: Record<Team, string> = {
  red: "border-team-red",
  blue: "border-team-blue",
};

const TEAM_TEXT: Record<Team, string> = {
  red: "text-team-red",
  blue: "text-team-blue",
};

const TEAM_BG: Record<Team, string> = {
  red: "bg-team-red/10",
  blue: "bg-team-blue/10",
};

const TEAM_NAME_KEY: Record<Team, string> = {
  red: "game.score.red",
  blue: "game.score.blue",
};

function callerTeam(seat: number): Team {
  return seat % 2 === 0 ? "red" : "blue";
}

export function TrumpIndicator({ trumpSuit, trumpCallerSeat }: TrumpIndicatorProps) {
  const { t } = useTranslation();

  const team: Team | null =
    typeof trumpCallerSeat === "number" ? callerTeam(trumpCallerSeat) : null;

  const suitName = t(SUIT_NAME_KEY[trumpSuit]);
  const teamName = team ? t(TEAM_NAME_KEY[team]) : null;
  const ariaLabel =
    team && teamName
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
    </div>
  );
}
