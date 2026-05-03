import { Flag } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";

import { HUDButton } from "./HUDButton";

interface SurrenderButtonProps {
  canRequest: boolean;
  isExhausted: boolean;
  isPending: boolean;
  onConfirm: () => void;
}

export function SurrenderButton({
  canRequest,
  isExhausted,
  isPending,
  onConfirm,
}: SurrenderButtonProps) {
  const { t } = useTranslation();
  const [confirmOpen, setConfirmOpen] = useState(false);

  // If a partner's proposal arrives or the player's attempt becomes exhausted
  // while the confirm dialog is open, close it — the action would be doomed.
  useEffect(() => {
    if (isPending || isExhausted) setConfirmOpen(false);
  }, [isPending, isExhausted]);

  // Exhausted state takes priority — once consumed, that's the durable
  // condition; pending only describes a transient partner-side proposal.
  // The aria-label carries the verbose status; the button itself is icon-only.
  const ariaLabel = isExhausted
    ? t("game.surrender.exhausted")
    : isPending
      ? t("game.surrender.pending")
      : t("game.surrender.requestButton");

  const isDisabled = !canRequest;

  const handleConfirm = () => {
    setConfirmOpen(false);
    onConfirm();
  };

  return (
    <>
      <HUDButton
        variant="danger"
        icon={<Flag className="h-4 w-4" aria-hidden="true" />}
        aria-label={ariaLabel}
        title={ariaLabel}
        onClick={() => setConfirmOpen(true)}
        disabled={isDisabled}
        data-testid="surrender-button"
      />

      <Dialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!open) setConfirmOpen(false);
        }}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{t("game.surrender.confirm.title")}</DialogTitle>
            <DialogDescription>{t("game.surrender.confirm.body")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              data-testid="surrender-cancel"
            >
              {t("game.surrender.confirm.cancel")}
            </Button>
            <Button onClick={handleConfirm} data-testid="surrender-confirm">
              {t("game.surrender.confirm.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
