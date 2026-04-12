import { useTranslation } from "react-i18next";

import type { PlayerState } from "@/shared/types/gameTypes";

interface PlayerSeatProps {
  player: PlayerState | null;
  isSelf: boolean;
  isActive: boolean;
  teamColor: "red" | "blue";
  cardCount?: number;
}

export function PlayerSeat({ player, isSelf, isActive, teamColor, cardCount }: PlayerSeatProps) {
  const { t } = useTranslation();

  const borderColor = teamColor === "red" ? "border-team-red" : "border-team-blue";
  const teamLabel = teamColor === "red" ? "Red" : "Blue";

  if (!player) {
    return (
      <div
        className="flex flex-col items-center gap-1 p-2 rounded-lg border-2 border-dashed border-border"
        aria-label={`Empty seat, ${teamLabel} team, waiting`}
      >
        <div className="w-10 h-10 rounded-full bg-surface-elevated border border-border flex items-center justify-center">
          <span className="text-text-secondary text-sm font-body">?</span>
        </div>
        <span className="text-text-secondary text-sm font-body">{t("game.seat.waiting")}</span>
      </div>
    );
  }

  const activeClasses = isActive
    ? "border-accent shadow-[0_0_16px_var(--color-accent-glow)] motion-safe:animate-pulse"
    : borderColor;

  const scaleClass = isSelf ? "scale-110" : "";

  const statusLabel = isActive ? "active" : "waiting";
  const displayName = player.username || `P${player.seat + 1}`;
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div
      className={`flex flex-col items-center gap-1 p-2 rounded-lg border-2 ${activeClasses} ${scaleClass}`}
      aria-label={`${displayName}, ${teamLabel} team, ${statusLabel}`}
    >
      <div className="w-10 h-10 rounded-full bg-surface-elevated flex items-center justify-center">
        <span className="text-text-primary text-sm font-body font-semibold">{initial}</span>
      </div>
      <span className="font-body text-sm text-text-primary">{displayName}</span>
      {isSelf && (
        <span className="font-body text-xs text-accent">{t("game.seat.you")}</span>
      )}
      {!isSelf && cardCount !== undefined && cardCount > 0 && (
        <span className="font-body text-xs text-text-secondary">&times;{cardCount}</span>
      )}
      <div aria-live="polite" className="sr-only">
        {isActive ? "It's this player's turn" : ""}
      </div>
    </div>
  );
}
