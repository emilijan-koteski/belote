import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { MOTION } from "@/shared/lib/motion";
import type { TeamString } from "@/shared/types/gameTypes";
import type { MatchAbandonedPayload } from "@/shared/types/wsEvents";

import { TEAM_GOLD, TEAM_SILVER, type TeamGradient } from "../lib/tableTheme";
import { ClassicPanel } from "./overlay/ClassicPanel";
import { OverlayBackdrop } from "./overlay/OverlayBackdrop";

interface ReconnectOverlayProps {
  /** Name of the primary disconnected player (the one whose reconnect timer is
   *  active). Used for the abandoned-state title and for the countdown subtitle
   *  copy. Also used as a fallback chip name when `disconnectedPlayerNames` is
   *  not provided. */
  disconnectedPlayerName: string;
  /** Names of every currently-disconnected player to render as chips during
   *  the countdown. The server tracks only one active reconnect timer, but
   *  multiple seats can be flagged Connected=false in the concurrent-disconnect
   *  edge case (handleConcurrentDisconnectLocked). When omitted, falls back to
   *  a single chip for `disconnectedPlayerName`. */
  disconnectedPlayerNames?: string[];
  reconnectExpiresAt: string;
  abandonedData?: MatchAbandonedPayload | null;
  // Viewer team — required whenever `abandonedData` is supplied so the
  // final-score columns can render Us/Them. When the overlay shows only the
  // reconnect countdown (no abandonedData), this prop is unused and may be
  // omitted.
  viewerTeam?: TeamString | null;
  onReturnToLobby?: () => void;
  /** Total reconnect window in seconds — used to drive the progress ring's
   *  sweep. Defaults to 120 (server default). Custom rooms with a different
   *  window can pass it explicitly so the ring still reads "fills full → empty"
   *  rather than starting partially-full. */
  totalSeconds?: number;
}

const RECONNECT_TOTAL_SECONDS_DEFAULT = 120;
// Color tokens lifted from the design's classic-states.jsx countdown rings.
const RING_PARCHMENT = "#d4d0c4";
const RING_DANGER = "#e85a5a";
// Switch the ring + countdown text to the urgent color when ≤25% of the
// reconnect window remains — mirrors the threshold used by ButtonTimerRing.
const URGENT_PCT_THRESHOLD = 0.25;
// Felt panel background tokens — mirrors ClassicPanel internal gradient so the
// ring track sits on a matching field instead of a default surface.
const FELT_DARK = "#0e2818";

function formatCountdown(totalSeconds: number): string {
  if (totalSeconds <= 0) return "0:00";
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function ReconnectOverlay({
  disconnectedPlayerName,
  disconnectedPlayerNames,
  reconnectExpiresAt,
  abandonedData,
  viewerTeam = null,
  onReturnToLobby,
  totalSeconds = RECONNECT_TOTAL_SECONDS_DEFAULT,
}: ReconnectOverlayProps) {
  const chipNames =
    disconnectedPlayerNames && disconnectedPlayerNames.length > 0
      ? disconnectedPlayerNames
      : [disconnectedPlayerName];
  const { t } = useTranslation();
  const [remainingSeconds, setRemainingSeconds] = useState(() => {
    const diff = new Date(reconnectExpiresAt).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / 1000));
  });

  useEffect(() => {
    if (abandonedData) return; // Stop countdown when abandoned
    const tick = () => {
      const diff = new Date(reconnectExpiresAt).getTime() - Date.now();
      const seconds = Math.max(0, Math.ceil(diff / 1000));
      setRemainingSeconds(seconds);
    };

    tick();
    const interval = setInterval(tick, MOTION.COUNTDOWN_TICK);
    return () => clearInterval(interval);
  }, [reconnectExpiresAt, abandonedData]);

  // Auto-redirect to lobby after match abandonment
  useEffect(() => {
    if (!abandonedData || !onReturnToLobby) return;
    const timer = setTimeout(() => {
      onReturnToLobby();
    }, MOTION.RECONNECT_REDIRECT);
    return () => clearTimeout(timer);
  }, [abandonedData, onReturnToLobby]);

  // Expired-window fallback redirect — covers the case where the disconnected
  // player's WS reconnects *after* the server already abandoned the match. The
  // session is gone server-side, so HandleReconnect returns silently and the
  // client never receives event:match_abandoned. Without this fallback the
  // overlay would freeze at 0:00 forever. We give the abandon event a brief
  // grace window (RECONNECT_REDIRECT) to arrive in case the server is just
  // slightly slower than the client wallclock, then navigate.
  const isExpiredWithoutAbandon = !abandonedData && remainingSeconds <= 0;
  useEffect(() => {
    if (!isExpiredWithoutAbandon || !onReturnToLobby) return;
    const timer = setTimeout(() => {
      onReturnToLobby();
    }, MOTION.RECONNECT_REDIRECT);
    return () => clearTimeout(timer);
  }, [isExpiredWithoutAbandon, onReturnToLobby]);

  // Abandoned state — gold/silver glow tied to the surviving team would be
  // misleading (no one *won* — the match was abandoned), so the panel uses a
  // red glow consistent with the urgent-state palette in the design system.
  if (abandonedData) {
    const teamAValue = abandonedData.teamAFinalScore;
    const teamBValue = abandonedData.teamBFinalScore;
    const usValue = viewerTeam === "teamA" ? teamAValue : teamBValue;
    const themValue = viewerTeam === "teamA" ? teamBValue : teamAValue;

    return (
      <div
        className="fixed inset-0 z-50"
        data-testid="reconnect-overlay"
        aria-live="assertive"
      >
        <OverlayBackdrop dim={0.7}>
          <ClassicPanel width={520} glowColor={RING_DANGER}>
            <div className="flex flex-col items-center text-center gap-3">
              <span
                className="font-body text-[11px] uppercase tracking-[0.25em]"
                style={{ color: "var(--ink-light, #f5f2e8)", opacity: 0.55 }}
              >
                {t("game.matchResult.title")}
              </span>

              <h2
                className="font-display text-2xl font-semibold"
                style={{ color: RING_DANGER, letterSpacing: -0.3 }}
                data-testid="abandon-title"
              >
                {t("game.disconnect.matchAbandoned", {
                  player: disconnectedPlayerName,
                })}
              </h2>

              {/* Final-score columns — viewer-first ordering. The
                  matchAbandonedScores translation is also rendered (visually
                  hidden) inside the abandon-scores wrapper so screen readers
                  and tests get a single readable string. */}
              <div className="flex items-center justify-center gap-6 mt-1 mb-1" data-testid="abandon-scores">
                <ScoreColumn label={t("team.us")} value={usValue} gradient={TEAM_GOLD} />
                <span
                  className="font-display text-3xl"
                  style={{ color: "var(--ink-light, #f5f2e8)", opacity: 0.4 }}
                  aria-hidden
                >
                  ·
                </span>
                <ScoreColumn label={t("team.them")} value={themValue} gradient={TEAM_SILVER} />
                <span className="sr-only">
                  {t("game.disconnect.matchAbandonedScores", {
                    us: usValue,
                    them: themValue,
                  })}
                </span>
              </div>

              <p
                className="font-body text-xs mt-1 animate-pulse"
                style={{ color: "var(--ink-light, #f5f2e8)", opacity: 0.7 }}
              >
                {t("game.disconnect.returningToLobby")}
              </p>
            </div>
          </ClassicPanel>
        </OverlayBackdrop>
      </div>
    );
  }

  // Expired-without-abandon fallback — render a generic "match ended" panel
  // so the player isn't stuck staring at 0:00. The redirect effect above will
  // fire onReturnToLobby after RECONNECT_REDIRECT ms.
  if (isExpiredWithoutAbandon) {
    return (
      <div
        className="fixed inset-0 z-50"
        data-testid="reconnect-overlay"
        aria-live="assertive"
      >
        <OverlayBackdrop dim={0.7}>
          <ClassicPanel width={440} glowColor={RING_DANGER}>
            <div className="flex flex-col items-center text-center gap-3">
              <span
                className="font-body text-[11px] uppercase tracking-[0.25em]"
                style={{ color: "var(--ink-light, #f5f2e8)", opacity: 0.55 }}
              >
                {t("game.matchResult.title")}
              </span>

              <h2
                className="font-display text-2xl font-semibold"
                style={{ color: RING_DANGER, letterSpacing: -0.3 }}
                data-testid="match-ended-title"
              >
                {t("game.disconnect.matchEnded", { defaultValue: "Match has ended" })}
              </h2>

              <p
                className="font-body text-sm"
                style={{ color: "var(--ink-light, #f5f2e8)", opacity: 0.7 }}
              >
                {t("game.disconnect.reconnectFailed")}
              </p>

              <p
                className="font-body text-xs mt-1 animate-pulse"
                style={{ color: "var(--ink-light, #f5f2e8)", opacity: 0.7 }}
              >
                {t("game.disconnect.returningToLobby")}
              </p>
            </div>
          </ClassicPanel>
        </OverlayBackdrop>
      </div>
    );
  }

  // Countdown state — felt panel with title/subtitle header, centered ring
  // wrapping the m:ss countdown. Ring sweeps full → empty over the reconnect
  // window; both the ring stroke and the countdown text flip to the urgent
  // red palette when ≤25% of the window remains.
  const pct = Math.max(0, Math.min(1, remainingSeconds / totalSeconds));
  const isUrgent = pct <= URGENT_PCT_THRESHOLD;
  const ringColor = isUrgent ? RING_DANGER : RING_PARCHMENT;
  const ringSize = 132;
  const ringRadius = (ringSize - 4) / 2; // 2 px stroke inset on each side
  const ringCirc = 2 * Math.PI * ringRadius;

  return (
    <div
      className="fixed inset-0 z-30"
      data-testid="reconnect-overlay"
      aria-live="assertive"
    >
      <OverlayBackdrop dim={0.65}>
        <ClassicPanel
          width={440}
          title={t("game.disconnect.reconnecting")}
          subtitle={t("game.disconnect.waitingMessage", {
            player: disconnectedPlayerName,
          })}
        >
          <div className="flex flex-col items-center gap-4">
            {/* Disconnected player chip(s) — pulsing red status dot + brass
                name. Renders one chip per offline player so the concurrent-
                disconnect path (handleConcurrentDisconnectLocked) names every
                seat we're waiting on, not just the primary timer holder. */}
            <div
              className="flex flex-wrap items-center justify-center gap-2"
              data-testid="reconnect-player-name"
            >
              {chipNames.map((name, idx) => (
                <div
                  key={`${idx}-${name}`}
                  className="flex items-center gap-3 px-4 py-2 rounded-full"
                  style={{
                    background: "rgba(232,90,90,0.14)",
                    border: `1px solid ${RING_DANGER}55`,
                    boxShadow: "inset 0 1px 0 rgba(232,90,90,0.18)",
                  }}
                >
                  <span
                    aria-hidden
                    className="rounded-full animate-pulse"
                    style={{
                      width: 8,
                      height: 8,
                      background: RING_DANGER,
                      boxShadow: `0 0 8px ${RING_DANGER}cc`,
                    }}
                  />
                  <span
                    className="font-display font-semibold"
                    style={{
                      fontSize: 16,
                      letterSpacing: 0.2,
                      color: "var(--brass, #c9a876)",
                    }}
                  >
                    {name}
                  </span>
                  <span
                    className="font-body text-[11px] uppercase tracking-[0.18em]"
                    style={{ color: RING_DANGER, opacity: 0.85 }}
                  >
                    {t("game.disconnect.statusBadge", { defaultValue: "disconnected" })}
                  </span>
                </div>
              ))}
            </div>

            <div
              className="relative"
              style={{ width: ringSize, height: ringSize }}
            >
              <svg
                width={ringSize}
                height={ringSize}
                viewBox={`0 0 ${ringSize} ${ringSize}`}
                aria-hidden
                style={{ transform: "rotate(-90deg)" }}
              >
                <circle
                  cx={ringSize / 2}
                  cy={ringSize / 2}
                  r={ringRadius}
                  fill={FELT_DARK}
                  stroke="rgba(255,255,255,0.08)"
                  strokeWidth={2}
                />
                <circle
                  cx={ringSize / 2}
                  cy={ringSize / 2}
                  r={ringRadius}
                  fill="none"
                  stroke={ringColor}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeDasharray={ringCirc}
                  strokeDashoffset={ringCirc * (1 - pct)}
                  style={{
                    transition: `stroke-dashoffset ${MOTION.COUNTDOWN_TICK}ms linear, stroke ${MOTION.RING_COLOR_FLIP}ms ease-out`,
                  }}
                />
              </svg>
              <div
                className="absolute inset-0 flex items-center justify-center"
                style={{ pointerEvents: "none" }}
              >
                <span
                  className="font-display font-semibold tabular-nums"
                  style={{
                    fontSize: 36,
                    letterSpacing: 0.5,
                    color: isUrgent ? RING_DANGER : "var(--ink-light, #f5f2e8)",
                    transition: `color ${MOTION.RING_COLOR_FLIP}ms ease-out`,
                  }}
                  data-testid="reconnect-countdown"
                >
                  {formatCountdown(remainingSeconds)}
                </span>
              </div>
            </div>

            <p
              className="font-body text-[11px] uppercase tracking-[0.18em]"
              style={{ color: "var(--ink-light, #f5f2e8)", opacity: 0.55 }}
            >
              {t("game.disconnect.countdownLabel")}
            </p>
          </div>
        </ClassicPanel>
      </OverlayBackdrop>
    </div>
  );
}

interface ScoreColumnProps {
  label: string;
  value: number;
  gradient: TeamGradient;
}

function ScoreColumn({ label, value, gradient }: ScoreColumnProps) {
  return (
    <div className="text-center">
      <p
        className="font-body text-xs font-semibold uppercase tracking-wider"
        style={{ color: gradient[0] }}
      >
        {label}
      </p>
      <p
        className="font-display text-4xl font-bold tabular-nums"
        style={{ color: gradient[0] }}
      >
        {value}
      </p>
    </div>
  );
}
