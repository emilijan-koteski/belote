import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import type { MatchEndPayload } from "@/shared/types/wsEvents";

interface MatchResultProps {
  data: MatchEndPayload;
  onReturnToLobby: () => void;
}

export function MatchResult({ data, onReturnToLobby }: MatchResultProps) {
  const { t } = useTranslation();

  const teamName = data.winnerTeam === 0 ? t("game.score.red") : t("game.score.blue");
  const teamColorClass = data.winnerTeam === 0 ? "text-team-red" : "text-team-blue";

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
          className={`font-display text-3xl font-bold ${teamColorClass} mb-6`}
          data-testid="match-result-winner"
        >
          {t("game.matchResult.winner", { team: teamName })}
        </p>

        {/* Final Scores */}
        <div className="flex items-center justify-center gap-4 mb-6">
          <div className="text-center">
            <p className="text-team-red font-body text-sm font-semibold">{t("game.score.red")}</p>
            <p
              className="text-team-red font-display text-5xl font-bold tabular-nums"
              data-testid="match-result-red-score"
            >
              {data.redFinalScore}
            </p>
          </div>
          <span className="text-text-secondary font-display text-3xl">:</span>
          <div className="text-center">
            <p className="text-team-blue font-body text-sm font-semibold">{t("game.score.blue")}</p>
            <p
              className="text-team-blue font-display text-5xl font-bold tabular-nums"
              data-testid="match-result-blue-score"
            >
              {data.blueFinalScore}
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
