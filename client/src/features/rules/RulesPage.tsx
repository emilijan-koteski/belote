import { useTranslation } from "react-i18next";

export function RulesPage() {
  const { t } = useTranslation();

  return (
    <div className="p-6">
      <h1 className="font-display text-2xl font-semibold text-text-primary">
        {t("rules.title")}
      </h1>
      <p className="mt-4 text-text-secondary">{t("rules.comingSoon")}</p>
    </div>
  );
}
