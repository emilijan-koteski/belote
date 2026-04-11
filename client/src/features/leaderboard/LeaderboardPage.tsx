import { useTranslation } from "react-i18next";

export function LeaderboardPage() {
  const { t } = useTranslation();

  return (
    <div className="p-6">
      <h1 className="font-display text-2xl font-semibold text-text-primary">
        {t("leaderboard.title")}
      </h1>
      <p className="mt-4 text-text-secondary">{t("leaderboard.comingSoon")}</p>
    </div>
  );
}
