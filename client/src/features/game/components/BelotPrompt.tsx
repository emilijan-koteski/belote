import { useTranslation } from "react-i18next";

import { Button } from "@/shared/components/ui/button";
import { useFocusTrap } from "@/shared/hooks/useFocusTrap";

interface BelotPromptProps {
  onAnnounce: () => void;
  onDecline: () => void;
}

export function BelotPrompt({ onAnnounce, onDecline }: BelotPromptProps) {
  const { t } = useTranslation();
  const promptRef = useFocusTrap<HTMLDivElement>();

  return (
    <div
      className="absolute inset-0 flex items-center justify-center z-30"
      data-testid="belot-prompt"
    >
      <div className="absolute inset-0 bg-black/40" />

      <div
        ref={promptRef}
        className="relative bg-surface-elevated border border-border rounded-lg p-6 max-w-[480px] w-full mx-4 motion-safe:animate-in motion-safe:zoom-in-95 motion-safe:duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="belot-prompt-title"
      >
        <h2
          id="belot-prompt-title"
          className="text-text-primary font-display text-lg font-semibold text-center mb-4"
        >
          {t("game.belot.title")}
        </h2>

        <p className="text-text-secondary font-body text-sm text-center mb-4">
          {t("game.belot.description")}
        </p>

        <div className="flex gap-3 justify-center">
          <Button onClick={onAnnounce} data-testid="belot-prompt-announce">
            {t("game.belot.announce")}
          </Button>
          <Button variant="ghost" onClick={onDecline} data-testid="belot-prompt-decline">
            {t("game.belot.decline")}
          </Button>
        </div>
      </div>
    </div>
  );
}
