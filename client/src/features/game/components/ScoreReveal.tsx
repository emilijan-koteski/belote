import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useReducedMotion } from "@/shared/hooks/useReducedMotion";
import { type TeamString, teamStringForIndex } from "@/shared/types/gameTypes";
import type { HandScoredPayload } from "@/shared/types/wsEvents";

interface ScoreRevealProps {
  data: HandScoredPayload;
  viewerTeam: TeamString;
  onContinue: () => void;
}

export function ScoreReveal({ data, viewerTeam, onContinue }: ScoreRevealProps) {
  const { t } = useTranslation();
  const [continueEnabled, setContinueEnabled] = useState(false);

  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    const delay = prefersReducedMotion ? 500 : 2000;
    const timer = setTimeout(() => setContinueEnabled(true), delay);
    return () => clearTimeout(timer);
  }, [prefersReducedMotion]);

  // Auto-dismiss after a fixed window so an AFK player doesn't get stuck on
  // the reveal after the server has already advanced. Mirrors DeclarationReveal
  // (8000/1500 ms). The 2s "Continue disabled" cushion above is independent.
  // Hold onContinue in a ref so the timer is NOT reset when the parent
  // re-creates the callback mid-reveal (e.g. when event:match_end lands and
  // GamePage's handleScoreRevealContinue closure changes identity).
  const onContinueRef = useRef(onContinue);
  useEffect(() => {
    onContinueRef.current = onContinue;
  }, [onContinue]);
  useEffect(() => {
    const dismissAt = prefersReducedMotion ? 1500 : 8000;
    const timer = setTimeout(() => onContinueRef.current(), dismissAt);
    return () => clearTimeout(timer);
  }, [prefersReducedMotion]);

  // teamName: viewer-relative — Us when this team is the viewer's team, else
  // Them. Caller passes the team-index integer (0/1) and we convert via
  // the canonical helper to compare against viewerTeam.
  const teamName = (team: number) => {
    const teamString = teamStringForIndex(team === 0 ? 0 : 1);
    return teamString === viewerTeam ? t("team.us") : t("team.them");
  };

  const hasDeclarations = data.teamADeclPoints > 0 || data.teamBDeclPoints > 0;
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
            teamAValue={data.teamACardPoints}
            teamBValue={data.teamBCardPoints}
            delay={stagger * 0}
            testId="row-card-points"
          />

          {/* Declaration Points */}
          {hasDeclarations && (
            <ScoreRow
              label={t("game.scoreReveal.declarationPoints")}
              teamAValue={data.teamADeclPoints}
              teamBValue={data.teamBDeclPoints}
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
              <span
                className={data.lastTrickTeam === 0 ? "text-team-a" : "text-team-b"}
                data-team={teamStringForIndex(data.lastTrickTeam === 0 ? 0 : 1)}
              >
                +{data.lastTrickBonus}
              </span>
            </div>
          )}

          {/* Capot Bonus */}
          {data.capot && data.capotTeam !== null && (
            <div
              className="flex justify-between text-text-secondary font-body text-sm"
              data-testid="row-capot-bonus"
            >
              <span>{t("game.scoreReveal.capotBonus")}</span>
              <span
                className={data.capotTeam === 0 ? "text-team-a" : "text-team-b"}
                data-team={teamStringForIndex(data.capotTeam === 0 ? 0 : 1)}
              >
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
            teamAValue={data.teamAHandTotal}
            teamBValue={data.teamBHandTotal}
            bold
            testId="row-hand-total"
          />

          {/* Match Totals */}
          <div className="border-t border-border pt-2">
            <ScoreRow
              label={t("game.scoreReveal.matchTotal")}
              teamAValue={data.teamAMatchScore}
              teamBValue={data.teamBMatchScore}
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
  teamAValue: number;
  teamBValue: number;
  bold?: boolean;
  large?: boolean;
  delay?: number;
  testId: string;
}

function ScoreRow({ label, teamAValue, teamBValue, bold, large, delay, testId }: ScoreRowProps) {
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
        className={`text-team-a font-display ${sizeClass} ${weightClass} tabular-nums w-16 text-right`}
        data-team="teamA"
      >
        {teamAValue}
      </span>
      <span className="text-text-secondary mx-2">-</span>
      <span
        className={`text-team-b font-display ${sizeClass} ${weightClass} tabular-nums w-16 text-left`}
        data-team="teamB"
      >
        {teamBValue}
      </span>
    </div>
  );
}
