import { useTranslation } from "react-i18next";

import { Button } from "@/shared/components/ui/button";
import { useFocusTrap } from "@/shared/hooks/useFocusTrap";
import type { Declaration } from "@/shared/types/gameTypes";

interface DeclarationPromptProps {
  declarations: Declaration[];
  onDeclare: () => void;
  onSkip: () => void;
}

function declarationLabel(
  decl: Declaration,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string {
  if (decl.type === "four_of_a_kind") {
    return t("game.declaration.fourOfAKind", { points: decl.value });
  }
  return t("game.declaration.sequence", { count: decl.cards.length, points: decl.value });
}

export function DeclarationPrompt({ declarations, onDeclare, onSkip }: DeclarationPromptProps) {
  const { t } = useTranslation();
  const promptRef = useFocusTrap<HTMLDivElement>();

  return (
    <div
      className="absolute inset-0 flex items-center justify-center z-30"
      data-testid="declaration-prompt"
    >
      {/* Backdrop — blocks card interaction */}
      <div className="absolute inset-0 bg-black/40" />

      <div
        ref={promptRef}
        className="relative bg-surface-elevated border border-border rounded-lg p-6 max-w-[480px] w-full mx-4 motion-safe:animate-in motion-safe:zoom-in-95 motion-safe:duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="declaration-prompt-title"
      >
        <h2
          id="declaration-prompt-title"
          className="text-text-primary font-display text-lg font-semibold text-center mb-4"
        >
          {t("game.declaration.title")}
        </h2>

        <div className="flex flex-col gap-2 mb-4">
          {declarations.map((decl, i) => (
            <div
              key={i}
              className="flex items-center justify-between bg-surface rounded-md px-3 py-2 border border-border"
            >
              <span className="text-text-primary font-body text-sm">
                {declarationLabel(decl, t)}
              </span>
              <span className="text-accent font-display text-base font-semibold">
                {decl.value} {t("game.declaration.pts")}
              </span>
            </div>
          ))}
        </div>

        <div className="flex gap-3 justify-center">
          <Button onClick={onDeclare} data-testid="declaration-prompt-declare">
            {t("game.declaration.declare")}
          </Button>
          <Button variant="ghost" onClick={onSkip} data-testid="declaration-prompt-skip">
            {t("game.declaration.skip")}
          </Button>
        </div>
      </div>
    </div>
  );
}
