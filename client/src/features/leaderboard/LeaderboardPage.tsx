import { useTranslation } from "react-i18next";

export function LeaderboardPage() {
  const { t } = useTranslation();

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:px-8">
      <h1 className="font-display text-2xl font-semibold text-text-primary">
        {t("leaderboard.title")}
      </h1>
      <p className="mt-4 text-text-secondary">{t("leaderboard.comingSoon")}</p>
    </div>
  );
}
