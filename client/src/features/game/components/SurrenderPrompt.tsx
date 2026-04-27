import { useTranslation } from "react-i18next";

import { Button } from "@/shared/components/ui/button";
import { useFocusTrap } from "@/shared/hooks/useFocusTrap";

interface SurrenderPromptProps {
  proposerUsername: string;
  onAccept: () => void;
  onDecline: () => void;
}

export function SurrenderPrompt({ proposerUsername, onAccept, onDecline }: SurrenderPromptProps) {
  const { t } = useTranslation();
  const promptRef = useFocusTrap<HTMLDivElement>();

  return (
    <div
      className="absolute inset-0 flex items-center justify-center z-30"
      data-testid="surrender-prompt"
    >
      <div className="absolute inset-0 bg-black/40" />

      <div
        ref={promptRef}
        className="relative bg-surface-elevated border border-border rounded-lg p-6 max-w-[480px] w-full mx-4 motion-safe:animate-in motion-safe:zoom-in-95 motion-safe:duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="surrender-prompt-title"
      >
        <h2
          id="surrender-prompt-title"
          className="text-text-primary font-display text-lg font-semibold text-center mb-4"
        >
          {t("game.surrender.prompt.title")}
        </h2>

        <p className="text-text-secondary font-body text-sm text-center mb-4">
          {t("game.surrender.prompt.body", { username: proposerUsername })}
        </p>

        <div className="flex gap-3 justify-center">
          <Button onClick={onAccept} data-testid="surrender-prompt-accept">
            {t("game.surrender.prompt.accept")}
          </Button>
          <Button variant="ghost" onClick={onDecline} data-testid="surrender-prompt-decline">
            {t("game.surrender.prompt.decline")}
          </Button>
        </div>
      </div>
    </div>
  );
}
