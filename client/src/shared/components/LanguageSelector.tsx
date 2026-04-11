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

const languages = [
  { code: "en", labelKey: "language.en" },
  { code: "sr", labelKey: "language.sr" },
] as const;

export function LanguageSelector() {
  const { t, i18n } = useTranslation();

  function handleLanguageChange(lang: string) {
    if (lang === i18n.language) return;

    i18n.changeLanguage(lang);

    const user = useAuthStore.getState().user;
    if (user) {
      updatePreferences(user.id, { languagePreference: lang }).catch(() => {
        // fire-and-forget — revert not needed for UX
      });

      useAuthStore.getState().setUser({ ...user, languagePreference: lang });
    }
  }

  const currentLang = i18n.language === "sr" ? "SR" : "EN";

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
