import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useReducedMotion } from "@/shared/hooks/useReducedMotion";
import { type TeamString, teamStringForIndex } from "@/shared/types/gameTypes";
import type { HandScoredPayload } from "@/shared/types/wsEvents";

import { TEAM_GOLD, TEAM_SILVER, type TeamGradient } from "../lib/tableTheme";
import { ButtonTimerRing } from "./overlay/ButtonTimerRing";
import { ClassicButton } from "./overlay/ClassicButton";
import { ClassicPanel } from "./overlay/ClassicPanel";
import { OverlayBackdrop } from "./overlay/OverlayBackdrop";

interface ScoreRevealProps {
  data: HandScoredPayload;
  viewerTeam: TeamString;
  onContinue: () => void;
}

const AUTO_DISMISS_MS = 8000;
const AUTO_DISMISS_MS_REDUCED = 1500;
const ENABLE_DELAY_MS = 2000;
const ENABLE_DELAY_MS_REDUCED = 500;

/**
 * End-of-hand score reveal — felt-panel breakdown of card points + decls
 * + bonuses, ending in a brass-tinted match-score strip.
 *
 * Continue is disabled for the first 2 s so the player can read the breakdown,
 * then enabled. The whole reveal auto-closes after 8 s — the timer ring
 * around Continue makes that explicit.
 */
export function ScoreReveal({ data, viewerTeam, onContinue }: ScoreRevealProps) {
  const { t } = useTranslation();
  const [continueEnabled, setContinueEnabled] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  const enableDelay = prefersReducedMotion ? ENABLE_DELAY_MS_REDUCED : ENABLE_DELAY_MS;
  const dismissAt = prefersReducedMotion ? AUTO_DISMISS_MS_REDUCED : AUTO_DISMISS_MS;

  useEffect(() => {
    const t = setTimeout(() => setContinueEnabled(true), enableDelay);
    return () => clearTimeout(t);
  }, [enableDelay]);

  // Auto-dismiss after the reveal window. Hold onContinue in a ref so the
  // dismiss timer doesn't re-arm if the parent re-creates the callback
  // mid-reveal (e.g. when event:match_end lands and the parent rebuilds its
  // continue closure). Tested by the regression-guard test.
  const onContinueRef = useRef(onContinue);
  useEffect(() => {
    onContinueRef.current = onContinue;
  }, [onContinue]);
  useEffect(() => {
    const t = setTimeout(() => onContinueRef.current(), dismissAt);
    return () => clearTimeout(t);
  }, [dismissAt]);

  const teamName = (team: number) => {
    const teamString = teamStringForIndex(team === 0 ? 0 : 1);
    return teamString === viewerTeam ? t("team.us") : t("team.them");
  };

  const teamAGradient: TeamGradient = viewerTeam === "teamA" ? TEAM_GOLD : TEAM_SILVER;
  const teamBGradient: TeamGradient = viewerTeam === "teamB" ? TEAM_GOLD : TEAM_SILVER;

  const hasDeclarations = data.teamADeclPoints > 0 || data.teamBDeclPoints > 0;

  return (
    <div className="fixed inset-0 z-30" data-testid="score-reveal">
      <OverlayBackdrop dim={0.6}>
        <div
          className={
            prefersReducedMotion
              ? ""
              : "motion-safe:animate-in motion-safe:zoom-in-95 motion-safe:fade-in motion-safe:duration-300"
          }
        >
          <ClassicPanel
            width={520}
            title={<span data-testid="score-reveal-title">{t("game.scoreReveal.title")}</span>}
          >
            {/* Header eyebrow row — Us / Them column labels */}
            <div
              className="grid items-end mb-2"
              style={{ gridTemplateColumns: "1fr 80px 80px", gap: 8 }}
            >
              <span />
              <span
                className="font-display text-[11px] font-bold uppercase tracking-wider text-right"
                style={{ color: teamAGradient[0] }}
              >
                {viewerTeam === "teamA" ? t("team.us") : t("team.them")}
              </span>
              <span
                className="font-display text-[11px] font-bold uppercase tracking-wider text-right"
                style={{ color: teamBGradient[0] }}
              >
                {viewerTeam === "teamB" ? t("team.us") : t("team.them")}
              </span>
            </div>

            <div className="flex flex-col">
              <ScoreRow
                label={t("game.scoreReveal.cardPoints")}
                teamAValue={data.teamACardPoints}
                teamBValue={data.teamBCardPoints}
                testId="row-card-points"
              />
              {hasDeclarations && (
                <ScoreRow
                  label={t("game.scoreReveal.declarationPoints")}
                  teamAValue={data.teamADeclPoints}
                  teamBValue={data.teamBDeclPoints}
                  testId="row-decl-points"
                />
              )}
              {data.lastTrickBonus > 0 && (
                <BonusRow
                  label={t("game.scoreReveal.lastTrickBonus")}
                  amount={data.lastTrickBonus}
                  team={data.lastTrickTeam === 0 ? 0 : 1}
                  teamGradient={data.lastTrickTeam === 0 ? teamAGradient : teamBGradient}
                  testId="row-last-trick"
                />
              )}
              {data.capot && data.capotTeam !== null && (
                <BonusRow
                  label={t("game.scoreReveal.capotBonus")}
                  amount={data.capotBonus}
                  team={data.capotTeam === 0 ? 0 : 1}
                  teamGradient={data.capotTeam === 0 ? teamAGradient : teamBGradient}
                  testId="row-capot-bonus"
                />
              )}
              {data.failedContract && (
                <p
                  className="font-body text-[12.5px] text-center py-2"
                  style={{ color: "rgb(234,179,8)" }}
                  data-testid="row-failed-contract"
                >
                  {t("game.scoreReveal.failedContractDesc", {
                    team: teamName(data.contractingTeam),
                    otherTeam: teamName(1 - data.contractingTeam),
                  })}
                </p>
              )}
              <ScoreRow
                label={t("game.scoreReveal.handTotal")}
                teamAValue={data.teamAHandTotal}
                teamBValue={data.teamBHandTotal}
                testId="row-hand-total"
                bold
                topBorder
              />
            </div>

            {/* Match-score brass strip */}
            <div
              className="rounded-lg px-4 py-3 mt-4"
              style={{
                background: "rgba(201,168,118,0.1)",
                border: "1px solid rgba(201,168,118,0.3)",
              }}
              data-testid="row-match-total"
            >
              <div className="flex items-center justify-between gap-4">
                <span
                  className="font-body text-[10.5px] uppercase tracking-widest"
                  style={{ color: "var(--brass, #c9a876)" }}
                >
                  {t("game.scoreReveal.matchTotal")}
                </span>
                <div className="flex items-center gap-3 font-display text-2xl font-bold tabular-nums">
                  <span style={{ color: teamAGradient[0] }} data-team="teamA">
                    {data.teamAMatchScore}
                  </span>
                  <span style={{ color: "var(--ink-light, #f5f2e8)", opacity: 0.4 }}>·</span>
                  <span style={{ color: teamBGradient[0] }} data-team="teamB">
                    {data.teamBMatchScore}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-5 flex justify-center">
              <ButtonTimerRing
                clientCountdown
                totalDuration={Math.ceil(dismissAt / 1000)}
                hideRing={prefersReducedMotion}
              >
                <ClassicButton
                  variant="primary"
                  onClick={onContinue}
                  disabled={!continueEnabled}
                  data-testid="score-reveal-continue"
                >
                  {t("game.scoreReveal.continue")}
                </ClassicButton>
              </ButtonTimerRing>
            </div>
          </ClassicPanel>
        </div>
      </OverlayBackdrop>
    </div>
  );
}

interface ScoreRowProps {
  label: string;
  teamAValue: number;
  teamBValue: number;
  bold?: boolean;
  topBorder?: boolean;
  testId: string;
}

function ScoreRow({ label, teamAValue, teamBValue, bold, topBorder, testId }: ScoreRowProps) {
  return (
    <div
      className="grid items-center py-2"
      style={{
        gridTemplateColumns: "1fr 80px 80px",
        gap: 8,
        borderTop: topBorder ? "1px solid rgba(255,255,255,0.06)" : undefined,
      }}
      data-testid={testId}
    >
      <span
        className="font-body text-sm"
        style={{
          color: "var(--ink-light, #f5f2e8)",
          opacity: bold ? 1 : 0.85,
          fontWeight: bold ? 700 : 400,
        }}
      >
        {label}
      </span>
      <span
        className="font-display text-right tabular-nums"
        style={{
          color: "var(--ink-light, #f5f2e8)",
          fontSize: bold ? 18 : 15,
          fontWeight: bold ? 700 : 500,
        }}
        data-team="teamA"
      >
        {teamAValue}
      </span>
      <span
        className="font-display text-right tabular-nums"
        style={{
          color: "var(--ink-light, #f5f2e8)",
          fontSize: bold ? 18 : 15,
          fontWeight: bold ? 700 : 500,
        }}
        data-team="teamB"
      >
        {teamBValue}
      </span>
    </div>
  );
}

interface BonusRowProps {
  label: string;
  amount: number;
  team: 0 | 1;
  teamGradient: TeamGradient;
  testId: string;
}

function BonusRow({ label, amount, team, teamGradient, testId }: BonusRowProps) {
  const teamString = teamStringForIndex(team);
  return (
    <div
      className="flex items-center justify-between py-1.5"
      data-testid={testId}
      style={{ color: "var(--ink-light, #f5f2e8)", opacity: 0.85 }}
    >
      <span className="font-body text-sm">{label}</span>
      <span
        className="font-display text-base font-semibold tabular-nums"
        style={{ color: teamGradient[0] }}
        data-team={teamString}
      >
        +{amount}
      </span>
    </div>
  );
}
