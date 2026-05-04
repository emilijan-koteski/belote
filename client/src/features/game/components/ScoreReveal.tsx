import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useReducedMotion } from "@/shared/hooks/useReducedMotion";
import { type Suit, type TeamString, teamStringForIndex } from "@/shared/types/gameTypes";
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
  /** Hand number (1-based) used in the title — "Hand N — results". */
  handNumber?: number;
  /** Trump suit for the just-finished hand (used in the subtitle). */
  trumpSuit?: Suit | null;
  /** Seat that called the trump (used for "your team called X" wording). */
  trumpCallerSeat?: number | null;
}

const SUIT_NAME_KEY: Record<Suit, string> = {
  S: "game.suits.spades",
  H: "game.suits.hearts",
  D: "game.suits.diamonds",
  C: "game.suits.clubs",
};

function callerTeamString(seat: number): TeamString {
  return seat % 2 === 0 ? "teamA" : "teamB";
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
export function ScoreReveal({
  data,
  viewerTeam,
  onContinue,
  handNumber,
  trumpSuit,
  trumpCallerSeat,
}: ScoreRevealProps) {
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

  const teamAGradient: TeamGradient = viewerTeam === "teamA" ? TEAM_GOLD : TEAM_SILVER;
  const teamBGradient: TeamGradient = viewerTeam === "teamB" ? TEAM_GOLD : TEAM_SILVER;

  const hasDeclarations = data.teamADeclPoints > 0 || data.teamBDeclPoints > 0;

  // Title + contract subtitle per design ("Hand N — results / Contract held ·
  // your team called Spades"). When handNumber / trumpSuit aren't passed
  // (legacy callers, test renders) we fall back to a plain "Hand Score".
  const title =
    handNumber !== undefined
      ? t("game.scoreReveal.titleWithHand", {
          hand: handNumber,
          defaultValue: `Hand ${handNumber} — results`,
        })
      : t("game.scoreReveal.title");

  const callerTeam: TeamString | null =
    typeof trumpCallerSeat === "number" ? callerTeamString(trumpCallerSeat) : null;
  const callerWasViewer = callerTeam !== null && callerTeam === viewerTeam;
  const trumpSuitName = trumpSuit ? t(SUIT_NAME_KEY[trumpSuit]) : null;

  // Subtitle carries the contract callout per design. When the contract
  // failed, it also names the beneficiary team so the "all points to Them"
  // message no longer floats awkwardly between the score rows. Held =
  // "Contract held · your team called Spades"; failed = "Contract failed ·
  // all points to Them".
  let subtitle: string | null = null;
  if (data.failedContract) {
    const beneficiary: TeamString = data.contractingTeam === 0 ? "teamB" : "teamA";
    const beneficiaryLabel = beneficiary === viewerTeam ? t("team.us") : t("team.them");
    subtitle = t("game.scoreReveal.subtitleFailed", { team: beneficiaryLabel });
  } else if (trumpSuitName && callerTeam) {
    subtitle = t(
      callerWasViewer ? "game.scoreReveal.subtitleHeldYour" : "game.scoreReveal.subtitleHeldTheir",
      { suit: trumpSuitName },
    );
  }

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
            width={560}
            title={<span data-testid="score-reveal-title">{title}</span>}
            subtitle={subtitle ?? undefined}
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
              <ScoreRow
                label={t("game.scoreReveal.handTotal")}
                teamAValue={data.teamAHandTotal}
                teamBValue={data.teamBHandTotal}
                testId="row-hand-total"
                bold
                topBorder
              />
            </div>

            {/* Match-score brass strip — per design, the strip hosts the
                "Match score" eyebrow + the {Us · Them / 1001} totals on the
                left and the Continue button (with its countdown ring) on the
                right. Combining them keeps the dialog footprint tight. */}
            <div
              className="rounded-lg px-4 py-3 mt-4 flex items-center justify-between gap-4"
              style={{
                background: "rgba(201,168,118,0.1)",
                border: "1px solid rgba(201,168,118,0.3)",
              }}
              data-testid="row-match-total"
            >
              <div className="flex flex-col gap-0.5">
                <span
                  className="font-body text-[10.5px] uppercase tracking-widest"
                  style={{ color: "var(--brass, #c9a876)" }}
                >
                  {t("game.scoreReveal.matchTotal")}
                </span>
                <div className="flex items-baseline gap-2 font-display text-lg font-bold tabular-nums">
                  <span style={{ color: teamAGradient[0] }} data-team="teamA">
                    {data.teamAMatchScore}
                  </span>
                  <span style={{ color: "var(--ink-light, #f5f2e8)", opacity: 0.4 }}>·</span>
                  <span style={{ color: teamBGradient[0] }} data-team="teamB">
                    {data.teamBMatchScore}
                  </span>
                  <span
                    className="text-[12px] font-body font-normal"
                    style={{ color: "var(--ink-light, #f5f2e8)", opacity: 0.5 }}
                  >
                    / 1001
                  </span>
                </div>
              </div>
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
