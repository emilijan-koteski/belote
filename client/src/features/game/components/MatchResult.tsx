import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { type TeamString, teamStringForIndex } from "@/shared/types/gameTypes";
import type { MatchEndPayload } from "@/shared/types/wsEvents";

interface MatchResultProps {
  data: MatchEndPayload;
  viewerTeam: TeamString;
  onReturnToLobby: () => void;
  // Resolved username for data.surrenderedBySeat. Optional — falls back to
  // game.surrender.unknownProposer when undefined and outcomeReason is
  // "surrender" (e.g. a race where gameState was cleared before the overlay
  // mounted). Has no effect for natural match-ends.
  surrenderedByUsername?: string;
}

export function MatchResult({
  data,
  viewerTeam,
  onReturnToLobby,
  surrenderedByUsername,
}: MatchResultProps) {
  const { t } = useTranslation();

  const winnerTeamString = teamStringForIndex(data.winnerTeam === 0 ? 0 : 1);
  const winnerLabel = winnerTeamString === viewerTeam ? t("team.us") : t("team.them");
  const teamColorClass = data.winnerTeam === 0 ? "text-team-a" : "text-team-b";

  const teamAColumnLabel = viewerTeam === "teamA" ? t("team.us") : t("team.them");
  const teamBColumnLabel = viewerTeam === "teamB" ? t("team.us") : t("team.them");

  const formattedDuration = useMemo(() => {
    const totalSec = data.matchDurationSec;
    const minutes = Math.floor(totalSec / 60);
    const seconds = totalSec % 60;
    return `${minutes}m ${seconds}s`;
  }, [data.matchDurationSec]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80"
      data-testid="match-result"
    >
      <div className="bg-surface-elevated border border-border rounded-xl max-w-sm w-full mx-4 p-8 text-center">
        <h2
          className="font-display text-xl font-bold text-text-primary mb-4"
          data-testid="match-result-title"
        >
          {t("game.matchResult.title")}
        </h2>

        <p
          className={`font-display text-3xl font-bold ${teamColorClass} mb-2`}
          data-testid="match-result-winner"
          data-team={winnerTeamString}
        >
          {t("game.matchResult.winner", { team: winnerLabel })}
        </p>

        {data.outcomeReason === "surrender" && (
          <p
            className="text-text-secondary font-body text-sm mb-6"
            data-testid="match-result-surrender-note"
          >
            {t("game.matchResult.surrenderNote", {
              username: surrenderedByUsername ?? t("game.surrender.unknownProposer"),
            })}
          </p>
        )}

        {/* Final Scores */}
        <div className="flex items-center justify-center gap-4 mb-6">
          <div className="text-center" data-testid="match-result-team-a-column" data-team="teamA">
            <p className="text-team-a font-body text-sm font-semibold">{teamAColumnLabel}</p>
            <p
              className="text-team-a font-display text-5xl font-bold tabular-nums"
              data-testid="match-result-team-a-score"
            >
              {data.teamAFinalScore}
            </p>
          </div>
          <span className="text-text-secondary font-display text-3xl">:</span>
          <div className="text-center" data-testid="match-result-team-b-column" data-team="teamB">
            <p className="text-team-b font-body text-sm font-semibold">{teamBColumnLabel}</p>
            <p
              className="text-team-b font-display text-5xl font-bold tabular-nums"
              data-testid="match-result-team-b-score"
            >
              {data.teamBFinalScore}
            </p>
          </div>
        </div>

        {/* Duration */}
        <p
          className="text-text-secondary font-body text-sm mb-6"
          data-testid="match-result-duration"
        >
          {t("game.matchResult.duration")}: {formattedDuration}
        </p>

        {/* Return to lobby button */}
        <button
          className="bg-accent text-background font-body font-medium px-6 py-3 rounded-lg w-full"
          onClick={onReturnToLobby}
          data-testid="match-result-lobby-btn"
        >
          {t("game.matchResult.returnToLobby")}
        </button>
      </div>
    </div>
  );
}
