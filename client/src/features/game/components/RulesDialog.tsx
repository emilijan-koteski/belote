import { BookOpen } from "lucide-react";
import { useTranslation } from "react-i18next";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";

interface RulesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * In-game rules dialog — placeholder. The full rules reference is on the
 * roadmap; for now this simply tells the player it's coming. Wiring the HUD
 * "?" button to a real dialog up front means the rules content can ship as a
 * pure copy update later, with no GamePage churn.
 */
export function RulesDialog({ open, onOpenChange }: RulesDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="rules-dialog">
        <DialogHeader>
          <DialogTitle>{t("game.rules.title")}</DialogTitle>
          <DialogDescription>{t("game.rules.comingSoon")}</DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-center py-6 text-text-secondary">
          <BookOpen className="h-10 w-10" aria-hidden="true" />
        </div>
      </DialogContent>
    </Dialog>
  );
}
