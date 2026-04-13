import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

interface ReconnectOverlayProps {
  disconnectedPlayerName: string;
  reconnectExpiresAt: string;
}

function formatCountdown(totalSeconds: number): string {
  if (totalSeconds <= 0) return "0:00";
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function ReconnectOverlay({
  disconnectedPlayerName,
  reconnectExpiresAt,
}: ReconnectOverlayProps) {
  const { t } = useTranslation();
  const [remainingSeconds, setRemainingSeconds] = useState(() => {
    const diff = new Date(reconnectExpiresAt).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / 1000));
  });

  useEffect(() => {
    const tick = () => {
      const diff = new Date(reconnectExpiresAt).getTime() - Date.now();
      const seconds = Math.max(0, Math.ceil(diff / 1000));
      setRemainingSeconds(seconds);
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [reconnectExpiresAt]);

  return (
    <div
      className="fixed inset-0 z-20 flex items-center justify-center bg-background/80 backdrop-blur-sm"
      data-testid="reconnect-overlay"
      aria-live="assertive"
    >
      <div className="bg-surface-elevated border border-border rounded-xl max-w-sm w-full mx-4 p-8 text-center">
        <p
          className="font-display text-lg font-semibold text-warning mb-1"
          data-testid="reconnect-player-name"
        >
          {disconnectedPlayerName}
        </p>

        <h2 className="font-display text-2xl font-bold text-text-primary mb-2">
          {t("game.disconnect.reconnecting")}
        </h2>

        <p className="text-text-secondary text-sm mb-6">
          {t("game.disconnect.waitingMessage", {
            player: disconnectedPlayerName,
          })}
        </p>

        <div className="mb-4">
          <p className="text-text-secondary text-xs mb-1">
            {t("game.disconnect.countdownLabel")}
          </p>
          <p
            className="font-mono text-4xl font-bold text-warning"
            data-testid="reconnect-countdown"
          >
            {formatCountdown(remainingSeconds)}
          </p>
        </div>
      </div>
    </div>
  );
}
