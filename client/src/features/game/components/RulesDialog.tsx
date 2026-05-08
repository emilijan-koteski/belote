import { BookOpen } from "lucide-react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

import { useFocusTrap } from "@/shared/hooks/useFocusTrap";

import { ClassicButton } from "./overlay/ClassicButton";
import { ClassicPanel } from "./overlay/ClassicPanel";
import { OverlayBackdrop } from "./overlay/OverlayBackdrop";

interface RulesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const BRASS = "#c9a876";

/**
 * In-game rules dialog — placeholder. The full rules reference is on the
 * roadmap; for now this simply tells the player it's coming. Wiring the HUD
 * "?" button to a real dialog up front means the rules content can ship as a
 * pure copy update later, with no GamePage churn.
 *
 * Renders inside the same classic-felt overlay shell (ClassicPanel +
 * OverlayBackdrop) used by the bidding / belot / surrender prompts so the
 * in-game chrome stays visually consistent. Portaled to document.body so the
 * z-50 backdrop floats above the bidder banner and seat panels.
 */
export function RulesDialog({ open, onOpenChange }: RulesDialogProps) {
  const { t } = useTranslation();
  const dialogRef = useFocusTrap<HTMLDivElement>({ onEscape: () => onOpenChange(false) });

  if (!open) return null;

  const dialog = (
    <div className="fixed inset-0 z-50" data-testid="rules-dialog">
      <OverlayBackdrop dim={0.5}>
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="rules-dialog-title"
          className="motion-safe:animate-in motion-safe:zoom-in-95 motion-safe:duration-150"
        >
          <ClassicPanel
            width={460}
            title={
              <span id="rules-dialog-title" className="inline-flex items-center gap-2.5">
                <BookOpen size={18} style={{ color: BRASS }} aria-hidden="true" />
                {t("game.rules.title")}
              </span>
            }
          >
            {/* Centred BookOpen mark — visual focal echoing the title icon at
                a larger scale; matches the way BelotPrompt anchors itself with
                the Q/K trump cards. */}
            <div className="flex justify-center mb-4 mt-1">
              <div
                className="flex items-center justify-center rounded-full"
                style={{
                  width: 72,
                  height: 72,
                  border: "1px solid rgba(201,168,118,0.45)",
                  background: "linear-gradient(180deg, rgba(20,46,28,0.55), rgba(14,40,24,0.35))",
                  boxShadow: "inset 0 1px 0 rgba(201,168,118,0.18), 0 6px 14px rgba(0,0,0,0.35)",
                }}
              >
                <BookOpen size={32} style={{ color: BRASS }} aria-hidden="true" />
              </div>
            </div>

            <p
              className="font-body text-sm text-center mb-4"
              style={{ color: "var(--ink-light, #f5f2e8)", opacity: 0.82, lineHeight: 1.55 }}
            >
              {t("game.rules.comingSoon")}
            </p>

            {/* Brass accent strip — same family as BelotPrompt's "+20" callout.
                Reinforces the "more to come" framing rather than reading as
                an empty placeholder. */}
            <div
              className="mb-4 px-3 py-2 rounded-lg flex items-center gap-2 font-body"
              style={{
                border: "1px solid rgba(201,168,118,0.32)",
                background: "linear-gradient(90deg, rgba(20,46,28,0.55), rgba(14,40,24,0.35))",
                color: "#e8dfc8",
                fontSize: 12,
                boxShadow: "inset 0 1px 0 rgba(201,168,118,0.12)",
              }}
            >
              <span
                aria-hidden
                className="rounded-full"
                style={{
                  width: 7,
                  height: 7,
                  background: BRASS,
                  boxShadow: "0 0 6px rgba(201,168,118,0.55)",
                  flexShrink: 0,
                }}
              />
              {t("game.rules.statusHint")}
            </div>

            <div className="flex justify-end items-center">
              <ClassicButton
                variant="primary"
                onClick={() => onOpenChange(false)}
                data-testid="rules-dialog-close"
              >
                {t("game.rules.close")}
              </ClassicButton>
            </div>
          </ClassicPanel>
        </div>
      </OverlayBackdrop>
    </div>
  );

  return createPortal(dialog, document.body);
}
