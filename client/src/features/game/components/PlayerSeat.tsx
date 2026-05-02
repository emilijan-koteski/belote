import { useTranslation } from "react-i18next";

import type { PlayerState, TeamString } from "@/shared/types/gameTypes";

import { TimerRing } from "./TimerRing";

interface PlayerSeatProps {
  player: PlayerState | null;
  isSelf: boolean;
  isActive: boolean;
  team: TeamString;
  cardCount?: number;
  turnExpiresAt?: string | null;
  timerDuration?: number;
}

export function PlayerSeat({
  player,
  isSelf,
  isActive,
  team,
  cardCount,
  turnExpiresAt,
  timerDuration,
}: PlayerSeatProps) {
  const { t } = useTranslation();

  const borderColor = team === "teamA" ? "border-team-a" : "border-team-b";
  const teamLabel = team === "teamA" ? t("team.a") : t("team.b");

  if (!player) {
    return (
      <div
        className="flex flex-col items-center gap-1 p-2 rounded-lg border-2 border-dashed border-border"
        aria-label={`Empty seat, ${teamLabel}, waiting`}
        data-team={team}
      >
        <div className="w-10 h-10 rounded-full bg-surface-elevated border border-border flex items-center justify-center">
          <span className="text-text-secondary text-sm font-body">?</span>
        </div>
        <span className="text-text-secondary text-sm font-body">{t("game.seat.waiting")}</span>
      </div>
    );
  }

  const isDisconnected = player.connected === false;

  const activeClasses =
    isActive && !isDisconnected
      ? "border-accent shadow-[0_0_16px_var(--color-accent-glow)] motion-safe:animate-pulse"
      : borderColor;

  const scaleClass = isSelf ? "scale-110" : "";
  const disconnectedClass = isDisconnected ? "opacity-50 grayscale" : "";

  const statusLabel = isDisconnected ? "disconnected" : isActive ? "active" : "waiting";
  const displayName = player.username || `P${player.seat + 1}`;
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div
      className={`flex flex-col items-center gap-1 p-2 rounded-lg border-2 ${activeClasses} ${scaleClass} ${disconnectedClass}`}
      aria-label={`${displayName}, ${teamLabel}, ${statusLabel}`}
      data-team={team}
    >
      <div className="relative w-12 h-12 flex items-center justify-center">
        <div className="w-10 h-10 rounded-full bg-surface-elevated flex items-center justify-center">
          <span className="text-text-primary text-sm font-body font-semibold">{initial}</span>
        </div>
        {isActive && turnExpiresAt != null && timerDuration !== undefined && timerDuration > 0 && (
          <TimerRing turnExpiresAt={turnExpiresAt} totalDuration={timerDuration} />
        )}
      </div>
      <span className="font-body text-sm text-text-primary">{displayName}</span>
      {isSelf && <span className="font-body text-xs text-accent">{t("game.seat.you")}</span>}
      {!isSelf && cardCount !== undefined && cardCount > 0 && (
        <span className="font-body text-xs text-text-secondary">&times;{cardCount}</span>
      )}
      <div aria-live="polite" className="sr-only">
        {isActive ? "It's this player's turn" : ""}
      </div>
    </div>
  );
}
