import { useTranslation } from "react-i18next";

import { useProfileQuery } from "@/shared/hooks/queries/useProfile";
import { useAuthStore } from "@/shared/stores/authStore";

import { MatchHistory } from "./MatchHistory";

function StatTile({
  testId,
  label,
  value,
  dataValue,
  tone = "neutral",
}: {
  testId: string;
  label: string;
  value: string;
  dataValue: string;
  tone?: "neutral" | "success" | "muted";
}) {
  const toneClass =
    tone === "success"
      ? "text-success"
      : tone === "muted"
        ? "text-text-secondary"
        : "text-text-primary";
  return (
    <div data-testid={testId} data-value={dataValue} className="rounded-lg bg-surface-elevated p-4">
      <div className={`font-display text-4xl font-bold ${toneClass}`}>{value}</div>
      <div className="mt-1 text-sm text-text-secondary">{label}</div>
    </div>
  );
}

export function ProfilePage() {
  const { t, i18n } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const { data: profile, isPending, isError } = useProfileQuery(user?.id);

  if (isPending) {
    return (
      <div className="p-6" data-testid="profile-loading">
        <div className="h-8 w-48 animate-pulse rounded bg-surface" />
        <div className="mt-4 h-5 w-32 animate-pulse rounded bg-surface" />
      </div>
    );
  }

  const displayName = profile?.username ?? user?.username ?? "";
  const createdAt = profile?.createdAt ?? user?.createdAt ?? "";
  let formattedDate = "";
  if (createdAt) {
    try {
      const dateLocale = i18n.language === "sr" ? "sr-Latn" : i18n.language;
      formattedDate = new Intl.DateTimeFormat(dateLocale, {
        year: "numeric",
        month: "long",
        day: "numeric",
      }).format(new Date(createdAt));
    } catch {
      // malformed date string — leave empty
    }
  }

  return (
    <div className="p-6" data-testid="profile-page">
      <h1
        className="font-display text-2xl font-semibold text-text-primary"
        data-testid="profile-username"
      >
        {displayName}
      </h1>

      {formattedDate && (
        <p className="mt-1 text-sm text-text-secondary" data-testid="profile-member-since">
          {t("profile.memberSince", { date: formattedDate })}
        </p>
      )}

      <div className="mt-8 space-y-6">
        <section
          className="rounded-lg border border-border bg-surface p-6"
          data-testid="profile-match-history"
        >
          <h2 className="font-display text-lg font-semibold text-text-primary">
            {t("profile.matchHistory.title")}
          </h2>
          <div className="mt-4">
            <MatchHistory userId={user?.id} />
          </div>
        </section>

        <section
          className="rounded-lg border border-border bg-surface p-6"
          data-testid="profile-stats"
        >
          <h2 className="font-display text-lg font-semibold text-text-primary">
            {t("profile.statsHeading")}
          </h2>
          {isError ? (
            <p className="mt-4 text-sm text-destructive" data-testid="profile-stats-error">
              {t("profile.stats.error")}
            </p>
          ) : (
            (() => {
              const wins = profile?.wins ?? 0;
              const losses = profile?.losses ?? 0;
              const totalGamesPlayed = profile?.totalGamesPlayed ?? 0;
              // Denominator includes abandoned so "played" is consistent across all four tiles.
              const rate =
                totalGamesPlayed === 0 ? undefined : Math.round((wins / totalGamesPlayed) * 100);
              const winRateDisplay =
                rate === undefined ? t("profile.stats.winRateEmpty") : `${rate}%`;
              const winRateTone: "success" | "muted" =
                rate !== undefined && rate >= 50 ? "success" : "muted";
              return (
                <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
                  <StatTile
                    testId="profile-stat-games-played"
                    label={t("profile.stats.totalGamesPlayed")}
                    value={String(totalGamesPlayed)}
                    dataValue={String(totalGamesPlayed)}
                  />
                  <StatTile
                    testId="profile-stat-wins"
                    label={t("profile.stats.wins")}
                    value={String(wins)}
                    dataValue={String(wins)}
                    tone="success"
                  />
                  <StatTile
                    testId="profile-stat-losses"
                    label={t("profile.stats.losses")}
                    value={String(losses)}
                    dataValue={String(losses)}
                    tone="muted"
                  />
                  <StatTile
                    testId="profile-stat-win-rate"
                    label={t("profile.stats.winRate")}
                    value={winRateDisplay}
                    dataValue={rate === undefined ? "" : String(rate)}
                    tone={winRateTone}
                  />
                </div>
              );
            })()
          )}
        </section>
      </div>
    </div>
  );
}
