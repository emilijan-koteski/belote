import { useTranslation } from "react-i18next";

import { useProfileQuery } from "@/shared/hooks/queries/useProfile";
import { useAuthStore } from "@/shared/stores/authStore";

export function ProfilePage() {
  const { t, i18n } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const { data: profile, isPending } = useProfileQuery(user?.id);

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
            {t("profile.matchHistory")}
          </h2>
          <p className="mt-2 text-sm text-text-secondary">{t("profile.matchHistoryEmpty")}</p>
        </section>

        <section
          className="rounded-lg border border-border bg-surface p-6"
          data-testid="profile-stats"
        >
          <h2 className="font-display text-lg font-semibold text-text-primary">
            {t("profile.stats")}
          </h2>
          <p className="mt-2 text-sm text-text-secondary">{t("profile.statsEmpty")}</p>
        </section>
      </div>
    </div>
  );
}
