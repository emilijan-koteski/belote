import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { useReducedMotion } from "@/shared/hooks/useReducedMotion";
import { teamStringForIndex } from "@/shared/types/gameTypes";

interface CapotAnimationProps {
  capotTeam: number;
  onComplete: () => void;
}

export function CapotAnimation({ capotTeam, onComplete }: CapotAnimationProps) {
  const { t } = useTranslation();

  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    const duration = prefersReducedMotion ? 500 : 2500;
    const timer = setTimeout(onComplete, duration);
    return () => clearTimeout(timer);
  }, [onComplete, prefersReducedMotion]);

  const teamColorClass = capotTeam === 0 ? "text-team-a" : "text-team-b";
  const teamString = teamStringForIndex(capotTeam === 0 ? 0 : 1);

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-background/80 pointer-events-none"
      data-testid="capot-animation"
    >
      <div className={prefersReducedMotion ? "" : "motion-safe:animate-capot-scale"}>
        <h1
          className={`font-display text-7xl font-bold ${teamColorClass} drop-shadow-[0_0_40px_currentColor]`}
          data-testid="capot-text"
          data-team={teamString}
        >
          {t("game.capot.title")}
        </h1>
      </div>
    </div>
  );
}
