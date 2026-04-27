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
  const caption = isExhausted
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
      <button
        type="button"
        className="border border-border text-text-secondary font-body text-sm px-3 py-1.5 rounded-lg hover:text-text-primary hover:border-text-secondary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        onClick={() => setConfirmOpen(true)}
        disabled={isDisabled}
        data-testid="surrender-button"
      >
        {caption}
      </button>

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
