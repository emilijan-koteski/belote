import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import type { HandScoredPayload } from "@/shared/types/wsEvents";

interface ScoreRevealProps {
  data: HandScoredPayload;
  onContinue: () => void;
}

export function ScoreReveal({ data, onContinue }: ScoreRevealProps) {
  const { t } = useTranslation();
  const [continueEnabled, setContinueEnabled] = useState(false);

  const prefersReducedMotion = useMemo(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  useEffect(() => {
    const delay = prefersReducedMotion ? 500 : 2000;
    const timer = setTimeout(() => setContinueEnabled(true), delay);
    return () => clearTimeout(timer);
  }, [prefersReducedMotion]);

  const teamName = (team: number) =>
    team === 0 ? t("game.score.red") : t("game.score.blue");

  const hasDeclarations = data.redDeclPoints > 0 || data.blueDeclPoints > 0;
  const stagger = prefersReducedMotion ? 0 : 200;

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-background/70"
      data-testid="score-reveal"
    >
      <div
        className={`bg-surface-elevated border border-border rounded-xl max-w-md w-full mx-4 p-8 ${
          prefersReducedMotion
            ? ""
            : "motion-safe:animate-in motion-safe:zoom-in-95 motion-safe:fade-in motion-safe:duration-300"
        }`}
      >
        <h2
          className="font-display text-xl font-bold text-text-primary text-center mb-6"
          data-testid="score-reveal-title"
        >
          {t("game.scoreReveal.title")}
        </h2>

        <div className="space-y-3">
          {/* Card Points */}
          <ScoreRow
            label={t("game.scoreReveal.cardPoints")}
            red={data.redCardPoints}
            blue={data.blueCardPoints}
            delay={stagger * 0}
            testId="row-card-points"
          />

          {/* Declaration Points */}
          {hasDeclarations && (
            <ScoreRow
              label={t("game.scoreReveal.declarationPoints")}
              red={data.redDeclPoints}
              blue={data.blueDeclPoints}
              delay={stagger * 1}
              testId="row-decl-points"
            />
          )}

          {/* Last Trick Bonus */}
          {data.lastTrickBonus > 0 && (
            <div
              className="flex justify-between text-text-secondary font-body text-sm"
              style={{ animationDelay: `${stagger * (hasDeclarations ? 2 : 1)}ms` }}
              data-testid="row-last-trick"
            >
              <span>{t("game.scoreReveal.lastTrickBonus")}</span>
              <span className={data.lastTrickTeam === 0 ? "text-team-red" : "text-team-blue"}>
                +{data.lastTrickBonus}
              </span>
            </div>
          )}

          {/* Capot Bonus */}
          {data.capot && (
            <div
              className="flex justify-between text-text-secondary font-body text-sm"
              data-testid="row-capot-bonus"
            >
              <span>{t("game.scoreReveal.capotBonus")}</span>
              <span className={data.capotTeam === 0 ? "text-team-red" : "text-team-blue"}>
                +{data.capotBonus}
              </span>
            </div>
          )}

          {/* Divider */}
          <div className="border-t border-border" />

          {/* Failed Contract */}
          {data.failedContract && (
            <div
              className="text-warning font-body text-sm text-center py-1"
              data-testid="row-failed-contract"
            >
              {t("game.scoreReveal.failedContractDesc", {
                team: teamName(data.contractingTeam),
                otherTeam: teamName(1 - data.contractingTeam),
              })}
            </div>
          )}

          {/* Hand Totals */}
          <ScoreRow
            label={t("game.scoreReveal.handTotal")}
            red={data.redHandTotal}
            blue={data.blueHandTotal}
            bold
            testId="row-hand-total"
          />

          {/* Match Totals */}
          <div className="border-t border-border pt-2">
            <ScoreRow
              label={t("game.scoreReveal.matchTotal")}
              red={data.redMatchScore}
              blue={data.blueMatchScore}
              bold
              large
              testId="row-match-total"
            />
          </div>
        </div>

        {/* Continue button */}
        <div className="mt-6 flex justify-center">
          <button
            className="bg-accent text-background font-body font-medium px-6 py-3 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
            onClick={onContinue}
            disabled={!continueEnabled}
            data-testid="score-reveal-continue"
          >
            {t("game.scoreReveal.continue")}
          </button>
        </div>
      </div>
    </div>
  );
}

interface ScoreRowProps {
  label: string;
  red: number;
  blue: number;
  bold?: boolean;
  large?: boolean;
  delay?: number;
  testId: string;
}

function ScoreRow({ label, red, blue, bold, large, delay, testId }: ScoreRowProps) {
  const sizeClass = large ? "text-2xl" : "text-base";
  const weightClass = bold ? "font-bold" : "font-normal";

  return (
    <div
      className="flex items-center justify-between"
      style={delay !== undefined && delay > 0 ? { animationDelay: `${delay}ms` } : undefined}
      data-testid={testId}
    >
      <span className="text-text-secondary font-body text-sm flex-1">{label}</span>
      <span
        className={`text-team-red font-display ${sizeClass} ${weightClass} tabular-nums w-16 text-right`}
      >
        {red}
      </span>
      <span className="text-text-secondary mx-2">-</span>
      <span
        className={`text-team-blue font-display ${sizeClass} ${weightClass} tabular-nums w-16 text-left`}
      >
        {blue}
      </span>
    </div>
  );
}
