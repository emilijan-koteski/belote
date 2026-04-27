import { useTranslation } from "react-i18next";

interface SurrenderOpponentBannerProps {
  proposerUsername: string;
}

// Slim non-modal banner shown to opposing-team players while a surrender
// proposal is pending. Intentionally NOT a dialog: opponents must keep
// playing while the proposer's partner accepts/declines.
export function SurrenderOpponentBanner({ proposerUsername }: SurrenderOpponentBannerProps) {
  const { t } = useTranslation();

  return (
    <div
      className="absolute top-12 left-1/2 -translate-x-1/2 z-30 bg-surface-elevated border border-border rounded-md px-4 py-1.5 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
      data-testid="surrender-opponent-banner"
      role="status"
      aria-live="polite"
    >
      <span className="text-text-primary font-body text-sm">
        {t("game.surrender.opponentBanner", { username: proposerUsername })}
      </span>
    </div>
  );
}
