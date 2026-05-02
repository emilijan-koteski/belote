import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { type TeamString, teamStringForIndex } from "@/shared/types/gameTypes";

interface ScorePanelProps {
  viewerTeam: TeamString;
  teamAScore: number;
  teamBScore: number;
  teamATricks: number;
  teamBTricks: number;
  teamAHandPotential?: number;
  teamBHandPotential?: number;
  lastTrickBonus?: number;
  lastTrickTeam?: number;
}

export function ScorePanel({
  viewerTeam,
  teamAScore,
  teamBScore,
  teamATricks,
  teamBTricks,
  teamAHandPotential = 0,
  teamBHandPotential = 0,
  lastTrickBonus,
  lastTrickTeam,
}: ScorePanelProps) {
  const { t } = useTranslation();
  const prefersReducedMotion = useMemo(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  const [showBonus, setShowBonus] = useState<{ team: 0 | 1; amount: number } | null>(null);

  useEffect(() => {
    if (lastTrickBonus !== undefined && lastTrickBonus > 0 && lastTrickTeam !== undefined) {
      setShowBonus({ team: lastTrickTeam === 0 ? 0 : 1, amount: lastTrickBonus });
    }
  }, [lastTrickBonus, lastTrickTeam]);

  useEffect(() => {
    if (showBonus === null) return;
    const timer = setTimeout(() => setShowBonus(null), prefersReducedMotion ? 300 : 1200);
    return () => clearTimeout(timer);
  }, [showBonus, prefersReducedMotion]);

  const teamALabel = viewerTeam === "teamA" ? t("team.us") : t("team.them");
  const teamBLabel = viewerTeam === "teamB" ? t("team.us") : t("team.them");

  const bonusTeamString = showBonus !== null ? teamStringForIndex(showBonus.team) : null;

  return (
    <div
      className="fixed top-4 left-4 z-10 bg-surface/80 border border-border rounded-lg px-4 py-3 min-w-[120px]"
      data-testid="score-panel"
      aria-live="polite"
    >
      {/* Team A block */}
      <div className="mb-1" data-testid="score-row-a" data-team="teamA">
        <div className="flex items-center justify-between gap-4">
          <span className="text-team-a font-body text-sm font-semibold" data-testid="score-label-a">
            {teamALabel}
          </span>
          <span
            className="text-team-a font-display text-3xl font-bold tabular-nums motion-safe:transition-all motion-safe:duration-300"
            data-testid="score-a"
          >
            {teamAScore}
          </span>
        </div>
        {teamAHandPotential > 0 && (
          <div
            className="text-text-secondary font-body text-xs text-right tabular-nums"
            data-testid="score-a-potential"
          >
            +{teamAHandPotential} {t("game.score.thisHand")}
          </div>
        )}
      </div>

      {/* Team B block */}
      <div className="mb-2" data-testid="score-row-b" data-team="teamB">
        <div className="flex items-center justify-between gap-4">
          <span className="text-team-b font-body text-sm font-semibold" data-testid="score-label-b">
            {teamBLabel}
          </span>
          <span
            className="text-team-b font-display text-3xl font-bold tabular-nums motion-safe:transition-all motion-safe:duration-300"
            data-testid="score-b"
          >
            {teamBScore}
          </span>
        </div>
        {teamBHandPotential > 0 && (
          <div
            className="text-text-secondary font-body text-xs text-right tabular-nums"
            data-testid="score-b-potential"
          >
            +{teamBHandPotential} {t("game.score.thisHand")}
          </div>
        )}
      </div>

      {/* Trick count */}
      <div
        className="text-text-secondary font-body text-xs text-center border-t border-border pt-1"
        data-testid="score-tricks"
      >
        {t("game.score.tricks")}: {teamATricks} - {teamBTricks}
      </div>

      {/* Float-up bonus animation */}
      {showBonus !== null && bonusTeamString !== null && (
        <div
          className={`absolute -top-2 right-2 font-display text-sm font-bold ${
            showBonus.team === 0 ? "text-team-a" : "text-team-b"
          } ${prefersReducedMotion ? "" : "motion-safe:animate-float-up"} pointer-events-none`}
          data-testid="score-bonus"
          data-team={bonusTeamString}
        >
          +{showBonus.amount}
        </div>
      )}
    </div>
  );
}
