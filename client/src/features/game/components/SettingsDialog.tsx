import { Globe } from "lucide-react";
import { useTranslation } from "react-i18next";

import { updatePreferences } from "@/shared/api/profile";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { useAuthStore } from "@/shared/stores/authStore";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const LANGUAGES = [
  { code: "en", labelKey: "language.en" },
  { code: "sr", labelKey: "language.sr" },
] as const;

/**
 * In-game settings dialog. Currently exposes only the UI language; the layout
 * is sectioned ("Language" heading) so future settings (sound, table theme,
 * timer preference, etc.) can drop in without rework.
 *
 * The language change persists to the user's profile via `updatePreferences`,
 * mirroring the lobby's [LanguageSelector] behavior — fire-and-forget so the
 * UI doesn't block on the network round-trip.
 */
export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { t, i18n } = useTranslation();

  function handleLanguageChange(lang: string) {
    if (lang === i18n.language) return;

    i18n.changeLanguage(lang);

    const user = useAuthStore.getState().user;
    if (user) {
      updatePreferences(user.id, { languagePreference: lang }).catch(() => {
        // fire-and-forget — revert isn't worth a toast for a settings flip.
      });
      useAuthStore.getState().setUser({ ...user, languagePreference: lang });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="settings-dialog">
        <DialogHeader>
          <DialogTitle>{t("game.settings.title")}</DialogTitle>
          <DialogDescription className="sr-only">
            {t("game.settings.languageHeading")}
          </DialogDescription>
        </DialogHeader>

        <section className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-text-secondary text-xs uppercase tracking-wider">
            <Globe className="h-4 w-4" aria-hidden="true" />
            <span>{t("game.settings.languageHeading")}</span>
          </div>
          <div className="flex flex-col gap-1.5" role="radiogroup">
            {LANGUAGES.map((lang) => {
              const selected = i18n.language === lang.code;
              return (
                <button
                  key={lang.code}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => handleLanguageChange(lang.code)}
                  data-testid={`settings-language-option-${lang.code}`}
                  className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left transition-colors ${
                    selected
                      ? "border-accent bg-accent/10 text-text-primary"
                      : "border-border text-text-secondary hover:text-text-primary hover:border-text-secondary"
                  }`}
                >
                  <span className="font-body text-sm font-medium">{t(lang.labelKey)}</span>
                  {selected && (
                    <span className="text-accent text-xs uppercase tracking-wider" aria-hidden>
                      ✓
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      </DialogContent>
    </Dialog>
  );
}
