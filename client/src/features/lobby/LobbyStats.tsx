import { Activity, Coffee, DoorOpen, Gamepad2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useLobbyStatsQuery } from "@/shared/hooks/queries/useLobbyStats";

interface StatBadgeProps {
  icon: LucideIcon;
  label: string;
  value: number | string;
  testId?: string;
  tone?: "default" | "accent";
}

function StatBadge({ icon: Icon, label, value, testId, tone = "default" }: StatBadgeProps) {
  const toneClass =
    tone === "accent"
      ? "bg-accent-glow text-accent"
      : "bg-surface-elevated text-text-primary";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium ${toneClass}`}
      title={label}
      data-testid={testId}
    >
      <Icon className="h-3 w-3" />
      <span className="text-text-secondary">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </span>
  );
}

export function LobbyStats() {
  const { t } = useTranslation();
  const { data, isLoading } = useLobbyStatsQuery();

  return (
    <div
      className="rounded-lg border border-border bg-surface p-3"
      data-testid="lobby-stats-panel"
    >
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-secondary">
        {t("lobby.stats.title")}
      </h3>

      {isLoading || !data ? (
        <p className="text-xs text-text-secondary">{t("lobby.stats.loading")}</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          <StatBadge
            icon={Coffee}
            label={t("lobby.stats.inLobby")}
            value={data.inLobby}
            testId="stats-in-lobby"
          />
          <StatBadge
            icon={DoorOpen}
            label={t("lobby.stats.inRoom")}
            value={data.inRoom}
            testId="stats-in-room"
          />
          <StatBadge
            icon={Gamepad2}
            label={t("lobby.stats.inGame")}
            value={data.inGame}
            testId="stats-in-game"
            tone="accent"
          />
          <StatBadge
            icon={Activity}
            label={t("lobby.stats.activeRatio")}
            value={t("lobby.stats.activeRatioValue", {
              active: data.online,
              registered: data.registered,
            })}
            testId="stats-active-ratio"
          />
        </div>
      )}
    </div>
  );
}
