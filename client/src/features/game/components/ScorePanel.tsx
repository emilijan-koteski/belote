import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useReducedMotion } from "@/shared/hooks/useReducedMotion";
import { type TeamString, teamStringForIndex } from "@/shared/types/gameTypes";

import { TEAM_GOLD, TEAM_SILVER, type TeamGradient } from "../lib/tableTheme";

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
  /** Match target — defaults to 1001 for Bitola. */
  matchTarget?: number;
}

const PANEL_BG = "var(--panel-dark, rgba(20,45,30,0.85))";
const PANEL_BORDER = "1px solid rgba(201,168,118,0.4)";
const INK = "var(--ink-light, #f5f2e8)";
const BRASS_LABEL = "var(--brass, #c9a876)";

interface RowProps {
  label: string;
  rowTestId: string;
  scoreTestId: string;
  potentialTestId: string;
  team: TeamString;
  teamGradient: TeamGradient;
  score: number;
  potential: number;
  tricks: number;
  matchTarget: number;
}

function ScoreRow({
  label,
  rowTestId,
  scoreTestId,
  potentialTestId,
  team,
  teamGradient,
  score,
  potential,
  tricks,
  matchTarget,
}: RowProps) {
  const { t } = useTranslation();
  const showPotential = potential > 0;
  const dot = teamGradient[0];
  // Cap the bar at 100% in the rare case `potential` overshoots the felt-style
  // 162 trick-points cap (declarations + bonuses can push it higher).
  const barPct = Math.max(0, Math.min(100, (potential / 162) * 100));

  return (
    <div className="px-4 py-2.5 flex flex-col gap-1.5" data-testid={rowTestId} data-team={team}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: dot,
              boxShadow: `0 0 8px ${dot}`,
            }}
          />
          <span
            className="font-body text-xs font-semibold uppercase tracking-wide"
            style={{ color: INK, opacity: 0.85 }}
            data-testid={team === "teamA" ? "score-label-a" : "score-label-b"}
          >
            {label}
          </span>
        </div>
        <span
          className="font-display font-bold tabular-nums motion-safe:transition-all motion-safe:duration-300"
          style={{ color: INK, fontSize: 22, letterSpacing: -0.5 }}
          data-testid={scoreTestId}
        >
          {score}
          <span
            className="text-[11px]"
            style={{ opacity: 0.5, marginLeft: 2 }}
          >{` / ${matchTarget}`}</span>
        </span>
      </div>
      {showPotential && (
        <div
          className="flex items-center gap-2 font-body text-[10.5px] tabular-nums"
          style={{ color: INK, opacity: 0.7 }}
          data-testid={potentialTestId}
        >
          <span>
            +{potential} {t("game.score.thisHand")}
          </span>
          <div
            className="flex-1"
            style={{
              height: 4,
              borderRadius: 2,
              background: "rgba(255,255,255,0.1)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${barPct}%`,
                height: "100%",
                background: `linear-gradient(90deg, ${teamGradient[0]}, ${teamGradient[1]})`,
              }}
            />
          </div>
          <span>
            {tricks} {tricks === 1 ? t("game.score.trick") : t("game.score.tricks")}
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * Top-left scoreboard panel — felt-tinted classic chip.
 *
 * Two team rows, each ordered viewer-first: the viewer's row always reads
 * Gold ("Us"); the opposition reads Silver ("Them"). Wire-level data is still
 * keyed by teamA/teamB so existing test selectors and downstream consumers
 * don't drift. A small per-team mini-bar shows hand potential ('this hand'
 * total) so players can read momentum at a glance.
 */
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
  matchTarget = 1001,
}: ScorePanelProps) {
  const { t } = useTranslation();
  const prefersReducedMotion = useReducedMotion();

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

  // Viewer-relative gradients: viewer's own team is always gold; the other
  // team is always silver, regardless of teamA/teamB identity.
  const teamAGradient: TeamGradient = viewerTeam === "teamA" ? TEAM_GOLD : TEAM_SILVER;
  const teamBGradient: TeamGradient = viewerTeam === "teamB" ? TEAM_GOLD : TEAM_SILVER;

  const bonusTeamString = showBonus !== null ? teamStringForIndex(showBonus.team) : null;
  const bonusGradient: TeamGradient | null =
    bonusTeamString === "teamA"
      ? teamAGradient
      : bonusTeamString === "teamB"
        ? teamBGradient
        : null;

  return (
    <div
      className="fixed top-4 left-4 z-10 rounded-xl overflow-hidden"
      style={{
        background: PANEL_BG,
        border: PANEL_BORDER,
        boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        minWidth: 240,
      }}
      data-testid="score-panel"
      aria-live="polite"
    >
      {/* Header eyebrow — brass label on top */}
      <div
        className="flex items-center justify-between px-4 py-2 font-body text-[10.5px] uppercase tracking-wider"
        style={{
          color: BRASS_LABEL,
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <span>{t("game.score.heading", { defaultValue: "Scoreboard" })}</span>
      </div>

      <ScoreRow
        label={teamALabel}
        rowTestId="score-row-a"
        scoreTestId="score-a"
        potentialTestId="score-a-potential"
        team="teamA"
        teamGradient={teamAGradient}
        score={teamAScore}
        potential={teamAHandPotential}
        tricks={teamATricks}
        matchTarget={matchTarget}
      />
      <div style={{ height: 1, background: "rgba(255,255,255,0.06)" }} />
      <ScoreRow
        label={teamBLabel}
        rowTestId="score-row-b"
        scoreTestId="score-b"
        potentialTestId="score-b-potential"
        team="teamB"
        teamGradient={teamBGradient}
        score={teamBScore}
        potential={teamBHandPotential}
        tricks={teamBTricks}
        matchTarget={matchTarget}
      />

      {/* Trick count footer (kept for parity with previous data-testid contract) */}
      <div
        className="px-4 py-1.5 font-body text-[10.5px] text-center tabular-nums"
        style={{
          color: INK,
          opacity: 0.55,
          borderTop: "1px solid rgba(255,255,255,0.06)",
        }}
        data-testid="score-tricks"
      >
        {t("game.score.tricks")}: {teamATricks} - {teamBTricks}
      </div>

      {/* Float-up bonus animation */}
      {showBonus !== null && bonusTeamString !== null && bonusGradient !== null && (
        <div
          className={`absolute -top-2 right-3 font-display text-sm font-bold ${
            prefersReducedMotion ? "" : "motion-safe:animate-float-up"
          } pointer-events-none`}
          style={{ color: bonusGradient[0] }}
          data-testid="score-bonus"
          data-team={bonusTeamString}
        >
          +{showBonus.amount}
        </div>
      )}
    </div>
  );
}
