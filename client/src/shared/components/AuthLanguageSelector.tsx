import { Globe } from "lucide-react";
import { useTranslation } from "react-i18next";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";

// Same four entries and same order as LanguageSelector (Latin-script ASC by
// native name, then Cyrillic-script ASC). Kept in lock-step with that file by
// convention — both arrays change together when adding a future locale.
const languages = [
  { code: "en", labelKey: "language.en" },
  { code: "hr", labelKey: "language.hr" },
  { code: "sr", labelKey: "language.sr" },
  { code: "mk", labelKey: "language.mk" },
] as const;

export function AuthLanguageSelector() {
  const { t, i18n } = useTranslation();

  async function handleLanguageChange(lang: string) {
    if (lang === i18n.language) return;
    await i18n.changeLanguage(lang);
    // localStorage persistence is handled centrally by the
    // `languageChanged` listener in i18n.ts — do not write here.
  }

  const currentLang = i18n.language.slice(0, 2).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-text-secondary transition-colors hover:text-text-primary"
        aria-label={t("auth.languageSelector.label")}
        data-testid="auth-language-selector"
      >
        <Globe className="h-4 w-4" />
        <span>{currentLang}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-surface-elevated">
        {languages.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => handleLanguageChange(lang.code)}
            data-testid={`auth-language-option-${lang.code}`}
          >
            {t(lang.labelKey)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
