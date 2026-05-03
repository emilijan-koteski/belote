import { useTranslation } from "react-i18next";

import { useFocusTrap } from "@/shared/hooks/useFocusTrap";

import { ButtonTimerRing } from "./overlay/ButtonTimerRing";
import { ClassicButton } from "./overlay/ClassicButton";
import { ClassicPanel } from "./overlay/ClassicPanel";
import { OverlayBackdrop } from "./overlay/OverlayBackdrop";

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
  // Escape declines the announcement and forfeits the +20 bonus per the rule.
  // fixed inset-0 prevents leak through scrolled stacking.
  const promptRef = useFocusTrap<HTMLDivElement>({ onEscape: onDecline });
  const showRing = isActivePlayer && Boolean(turnExpiresAt) && (timerDurationSec ?? 0) > 0;

  const titleKey = isKing ? "game.belot.titleRebelot" : "game.belot.titleBelot";
  const announceKey = isKing ? "game.belot.announceRebelot" : "game.belot.announceBelot";

  return (
    <div className="fixed inset-0" data-testid="belot-prompt">
      <OverlayBackdrop dim={0.5}>
        <div
          ref={promptRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="belot-prompt-title"
          className="motion-safe:animate-in motion-safe:zoom-in-95 motion-safe:duration-150"
        >
          <ClassicPanel
            width={460}
            title={<span id="belot-prompt-title">{t(titleKey)}</span>}
            subtitle={t("game.belot.description")}
          >
            <div className="flex justify-end items-center gap-3">
              {showRing ? (
                <ButtonTimerRing
                  turnExpiresAt={turnExpiresAt}
                  totalDuration={timerDurationSec ?? 0}
                >
                  <ClassicButton onClick={onDecline} data-testid="belot-prompt-decline">
                    {t("game.belot.decline")}
                  </ClassicButton>
                </ButtonTimerRing>
              ) : (
                <ClassicButton onClick={onDecline} data-testid="belot-prompt-decline">
                  {t("game.belot.decline")}
                </ClassicButton>
              )}
              <ClassicButton
                variant="primary"
                onClick={onAnnounce}
                data-testid="belot-prompt-announce"
              >
                {t(announceKey)}
              </ClassicButton>
            </div>
          </ClassicPanel>
        </div>
      </OverlayBackdrop>
    </div>
  );
}
