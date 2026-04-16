import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

interface ScorePanelProps {
  redScore: number;
  blueScore: number;
  redTricks: number;
  blueTricks: number;
  redHandPotential?: number;
  blueHandPotential?: number;
  lastTrickBonus?: number;
  lastTrickTeam?: number;
}

export function ScorePanel({
  redScore,
  blueScore,
  redTricks,
  blueTricks,
  redHandPotential = 0,
  blueHandPotential = 0,
  lastTrickBonus,
  lastTrickTeam,
}: ScorePanelProps) {
  const { t } = useTranslation();
  const prefersReducedMotion = useMemo(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  const [showBonus, setShowBonus] = useState<{ team: "red" | "blue"; amount: number } | null>(null);

  useEffect(() => {
    if (lastTrickBonus !== undefined && lastTrickBonus > 0 && lastTrickTeam !== undefined) {
      setShowBonus({ team: lastTrickTeam === 0 ? "red" : "blue", amount: lastTrickBonus });
    }
  }, [lastTrickBonus, lastTrickTeam]);

  useEffect(() => {
    if (showBonus === null) return;
    const timer = setTimeout(() => setShowBonus(null), prefersReducedMotion ? 300 : 1200);
    return () => clearTimeout(timer);
  }, [showBonus, prefersReducedMotion]);

  return (
    <div
      className="fixed top-4 left-4 z-10 bg-surface/80 border border-border rounded-lg px-4 py-3 min-w-[120px]"
      data-testid="score-panel"
      aria-live="polite"
    >
      {/* Red team block */}
      <div className="mb-1">
        <div className="flex items-center justify-between gap-4">
          <span
            className="text-team-red font-body text-sm font-semibold"
            data-testid="score-label-red"
          >
            {t("game.score.red")}
          </span>
          <span
            className="text-team-red font-display text-3xl font-bold tabular-nums motion-safe:transition-all motion-safe:duration-300"
            data-testid="score-red"
          >
            {redScore}
          </span>
        </div>
        {redHandPotential > 0 && (
          <div
            className="text-text-secondary font-body text-xs text-right tabular-nums"
            data-testid="score-red-potential"
          >
            +{redHandPotential} {t("game.score.thisHand")}
          </div>
        )}
      </div>

      {/* Blue team block */}
      <div className="mb-2">
        <div className="flex items-center justify-between gap-4">
          <span
            className="text-team-blue font-body text-sm font-semibold"
            data-testid="score-label-blue"
          >
            {t("game.score.blue")}
          </span>
          <span
            className="text-team-blue font-display text-3xl font-bold tabular-nums motion-safe:transition-all motion-safe:duration-300"
            data-testid="score-blue"
          >
            {blueScore}
          </span>
        </div>
        {blueHandPotential > 0 && (
          <div
            className="text-text-secondary font-body text-xs text-right tabular-nums"
            data-testid="score-blue-potential"
          >
            +{blueHandPotential} {t("game.score.thisHand")}
          </div>
        )}
      </div>

      {/* Trick count */}
      <div
        className="text-text-secondary font-body text-xs text-center border-t border-border pt-1"
        data-testid="score-tricks"
      >
        {t("game.score.tricks")}: {redTricks} - {blueTricks}
      </div>

      {/* Float-up bonus animation */}
      {showBonus !== null && (
        <div
          className={`absolute -top-2 right-2 font-display text-sm font-bold ${
            showBonus.team === "red" ? "text-team-red" : "text-team-blue"
          } ${prefersReducedMotion ? "" : "motion-safe:animate-float-up"} pointer-events-none`}
          data-testid="score-bonus"
        >
          +{showBonus.amount}
        </div>
      )}
    </div>
  );
}
