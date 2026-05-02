import { useTranslation } from "react-i18next";

import { Button } from "@/shared/components/ui/button";
import { useFocusTrap } from "@/shared/hooks/useFocusTrap";

import { TimerRing } from "./TimerRing";

interface BelotPromptProps {
  isKing: boolean;
  onAnnounce: () => void;
  onDecline: () => void;
  turnExpiresAt?: string | null;
  timerDurationSec?: number;
  // Defensive component-level invariant: ring renders only when the viewer is
  // the active player. Caller (GamePage) already gates this prompt on
  // pendingBelotSeat === myPlayerSeat, so this defaults true; any future
  // caller that mounts the prompt for a non-active viewer must opt out.
  isActivePlayer?: boolean;
}

export function BelotPrompt({
  isKing,
  onAnnounce,
  onDecline,
  turnExpiresAt,
  timerDurationSec,
  isActivePlayer = true,
}: BelotPromptProps) {
  const { t } = useTranslation();
  // Escape declines the announcement and forfeits the +20 bonus per the rule
  // (D102 / D103). fixed inset-0 prevents leak through scrolled stacking.
  const promptRef = useFocusTrap<HTMLDivElement>({ onEscape: onDecline });
  const showRing = isActivePlayer && Boolean(turnExpiresAt) && (timerDurationSec ?? 0) > 0;

  const titleKey = isKing ? "game.belot.titleRebelot" : "game.belot.titleBelot";
  const announceKey = isKing ? "game.belot.announceRebelot" : "game.belot.announceBelot";

  return (
    <div className="fixed inset-0 flex items-center justify-center z-30" data-testid="belot-prompt">
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
          {t(titleKey)}
        </h2>

        <p className="text-text-secondary font-body text-sm text-center mb-4">
          {t("game.belot.description")}
        </p>

        <div className="flex gap-3 justify-center items-center">
          <Button onClick={onAnnounce} data-testid="belot-prompt-announce">
            {t(announceKey)}
          </Button>
          <Button variant="ghost" onClick={onDecline} data-testid="belot-prompt-decline">
            {t("game.belot.decline")}
          </Button>
          {showRing && (
            <div className="relative w-9 h-9 shrink-0" data-testid="belot-prompt-timer">
              <TimerRing
                turnExpiresAt={turnExpiresAt ?? null}
                totalDuration={timerDurationSec ?? 0}
                size="button"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
