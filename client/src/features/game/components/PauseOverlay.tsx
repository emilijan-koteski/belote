import { useTranslation } from "react-i18next";

import type { PlayerState } from "@/shared/types/gameTypes";

interface PauseOverlayProps {
  pausedPlayers: [boolean, boolean, boolean, boolean];
  pauseUsed: [boolean, boolean, boolean, boolean];
  players: [PlayerState, PlayerState, PlayerState, PlayerState];
  myPlayerSeat: number;
  isRoomOwner: boolean;
  onResume: () => void;
  onPause: () => void;
  onOwnerResume: () => void;
}

export function PauseOverlay({
  pausedPlayers,
  pauseUsed,
  players,
  myPlayerSeat,
  isRoomOwner,
  onResume,
  onPause,
  onOwnerResume,
}: PauseOverlayProps) {
  const { t } = useTranslation();
  const hasActivePause = pausedPlayers[myPlayerSeat];
  const canStackPause = !hasActivePause && !pauseUsed[myPlayerSeat];

  return (
    <div
      className="fixed inset-0 z-20 flex items-center justify-center bg-background/80 backdrop-blur-sm"
      data-testid="pause-overlay"
      aria-live="polite"
    >
      <div className="bg-surface-elevated border border-border rounded-xl max-w-sm w-full mx-4 p-8 text-center">
        <h2 className="font-display text-2xl font-bold text-text-primary mb-4">
          {t("game.pause.title")}
        </h2>

        <div className="space-y-2 mb-6">
          {pausedPlayers.map(
            (isPaused, seat) =>
              isPaused && (
                <p
                  key={seat}
                  className="text-text-secondary text-sm"
                  data-testid={`pause-player-${seat}`}
                >
                  {t("game.pause.pausedBy", {
                    player: players[seat]?.username ?? `Player ${seat + 1}`,
                  })}
                </p>
              ),
          )}
        </div>

        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center justify-center gap-3">
            {hasActivePause ? (
              <button
                onClick={onResume}
                className="bg-accent text-background font-semibold px-6 py-3 rounded-lg hover:opacity-90 transition-opacity"
                data-testid="pause-resume-button"
              >
                {t("game.pause.resume")}
              </button>
            ) : canStackPause ? (
              <button
                onClick={onPause}
                className="border border-border text-text-secondary font-semibold px-6 py-3 rounded-lg hover:text-text-primary hover:border-text-secondary transition-colors"
                data-testid="pause-stack-button"
              >
                {t("game.pause.pauseButton")}
              </button>
            ) : (
              <p className="text-text-secondary text-sm italic" data-testid="pause-waiting">
                {t("game.pause.waitingToResume")}
              </p>
            )}
          </div>

          {isRoomOwner && (
            <button
              onClick={onOwnerResume}
              className="border border-red-500/50 text-red-400 font-semibold px-6 py-2 rounded-lg hover:bg-red-500/10 transition-colors text-sm"
              data-testid="pause-owner-resume-button"
            >
              {t("game.pause.resumeAll")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
