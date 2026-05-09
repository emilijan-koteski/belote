import { Globe } from "lucide-react";
import { useTranslation } from "react-i18next";

import { updatePreferences } from "@/shared/api/profile";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { useAuthStore } from "@/shared/stores/authStore";

// Order: Latin-script entries sorted ASC by native name (English, Hrvatski,
// Srpski) then Cyrillic-script entries sorted ASC (Македонски). The native
// names in `language.<code>` are immutable, so this ordering is stable.
const languages = [
  { code: "en", labelKey: "language.en" },
  { code: "hr", labelKey: "language.hr" },
  { code: "sr", labelKey: "language.sr" },
  { code: "mk", labelKey: "language.mk" },
] as const;

export function LanguageSelector() {
  const { t, i18n } = useTranslation();

  async function handleLanguageChange(lang: string) {
    if (lang === i18n.language) return;

    await i18n.changeLanguage(lang);

    const user = useAuthStore.getState().user;
    if (!user) return;

    const previousPreference = user.languagePreference;
    useAuthStore.getState().setUser({ ...user, languagePreference: lang });

    try {
      await updatePreferences(user.id, { languagePreference: lang });
    } catch {
      // Revert the optimistic auth-store update so it stays in sync with the
      // server. The visible UI language stays put (i18n already changed) — a
      // refresh would re-pull the persisted preference and reconcile.
      const current = useAuthStore.getState().user;
      if (current?.id === user.id) {
        useAuthStore.getState().setUser({ ...current, languagePreference: previousPreference });
      }
    }
  }

  const currentLang = i18n.language.slice(0, 2).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-text-secondary transition-colors hover:text-text-primary"
        data-testid="language-selector"
      >
        <Globe className="h-4 w-4" />
        <span>{currentLang}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-surface-elevated">
        {languages.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => handleLanguageChange(lang.code)}
            data-testid={`language-option-${lang.code}`}
          >
            {t(lang.labelKey)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
