import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import type { DeclarationsResolvedPayload } from "@/shared/types/wsEvents";

interface DeclarationRevealProps {
  payload: DeclarationsResolvedPayload;
  onComplete: () => void;
}

export function DeclarationReveal({ payload, onComplete }: DeclarationRevealProps) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(true);

  const prefersReducedMotion = useMemo(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  useEffect(() => {
    const duration = prefersReducedMotion ? 500 : 2000;
    const timer = setTimeout(() => {
      setVisible(false);
      onComplete();
    }, duration);
    return () => clearTimeout(timer);
  }, [prefersReducedMotion, onComplete]);

  if (!visible || payload.winnerTeam === null) return null;

  const totalValue = payload.declarations.reduce((sum, d) => sum + d.value, 0);

  return (
    <div
      className="absolute inset-0 flex items-center justify-center pointer-events-none z-20"
      data-testid="declaration-reveal"
    >
      <div
        className={`text-center ${
          prefersReducedMotion
            ? ""
            : "motion-safe:animate-in motion-safe:slide-in-from-bottom-4 motion-safe:fade-in motion-safe:duration-300"
        }`}
      >
        <div className="bg-surface-elevated/90 border border-border rounded-lg px-6 py-4">
          <p className="text-text-secondary font-body text-sm mb-1">
            {t("game.declaration.resolved")}
          </p>
          <p className="text-accent font-display text-3xl font-bold">+{totalValue}</p>
          <p className="text-text-secondary font-body text-xs mt-1">
            {payload.winnerTeam === 0
              ? t("game.declaration.teamRed")
              : t("game.declaration.teamBlue")}
          </p>
        </div>
      </div>
    </div>
  );
}
