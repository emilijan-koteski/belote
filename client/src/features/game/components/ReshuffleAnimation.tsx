import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

interface ReshuffleAnimationProps {
  onComplete: () => void;
}

export function ReshuffleAnimation({ onComplete }: ReshuffleAnimationProps) {
  const { t } = useTranslation();
  const [phase, setPhase] = useState<"shuffle" | "done">("shuffle");

  const prefersReducedMotion = useMemo(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  useEffect(() => {
    if (prefersReducedMotion) {
      setPhase("done");
      onComplete();
      return;
    }

    const timer = setTimeout(() => {
      setPhase("done");
      onComplete();
    }, 1200);

    return () => clearTimeout(timer);
  }, [prefersReducedMotion, onComplete]);

  if (phase === "done") return null;

  return (
    <div
      className="absolute inset-0 flex items-center justify-center pointer-events-none z-10"
      data-testid="reshuffle-animation"
    >
      <div className="text-center">
        <div className="flex gap-1 justify-center mb-3">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="w-8 h-12 rounded bg-surface-elevated border border-border motion-safe:animate-pulse"
              style={{ animationDelay: `${i * 100}ms` }}
            />
          ))}
        </div>
        <p className="text-text-secondary font-body text-sm">
          {t("game.reshuffle.message")}
        </p>
      </div>
    </div>
  );
}
