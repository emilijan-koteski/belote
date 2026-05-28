import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import { applyDayjsLocale } from "@/shared/lib/relativeTime";

import en from "./en.json";
import hr from "./hr.json";
import mk from "./mk.json";
import sr from "./sr.json";

// Same order as the LanguageSelector dropdown: Latin-script
// entries sorted ASC by native name, then Cyrillic-script ASC. Order only
// affects this allowlist's iteration (not display), but is kept aligned so
// future contributors don't see a "second source of truth" with different ordering.
const SUPPORTED_LANGUAGES = ["en", "hr", "sr", "mk"] as const;
type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const LANGUAGE_STORAGE_KEY = "beljot.lang";

function isSupported(code: string | null | undefined): code is SupportedLanguage {
  return !!code && (SUPPORTED_LANGUAGES as readonly string[]).includes(code);
}

// Normalize any value the i18n runtime may emit (`"en"`, `"en-US"`, `"EN"`,
// `null`, `undefined`, junk) down to one of our four supported short codes,
// or `null` if no supported match exists. This is the single guard used at
// PATCH compare, register payload, and the languageChanged listener — so a
// region subtag never leaks into the server contract or localStorage.
export function normalizeLanguage(lng: string | null | undefined): SupportedLanguage | null {
  if (!lng) return null;
  const short = lng.toLowerCase().split("-")[0];
  return isSupported(short) ? short : null;
}

function readStoredLanguage(): SupportedLanguage | null {
  // Guard for non-browser environments (SSR, workers) where `window` is
  // undefined — `typeof` is the only way to probe without throwing.
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return isSupported(stored) ? stored : null;
  } catch {
    return null;
  }
}

const initialLng: SupportedLanguage = readStoredLanguage() ?? "en";

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    sr: { translation: sr },
    mk: { translation: mk },
    hr: { translation: hr },
  },
  lng: initialLng,
  fallbackLng: "en",
  interpolation: {
    escapeValue: false,
  },
});

// Sync dayjs's active locale with i18n at boot so the first <RelativeTime />
// render in the stored language already speaks that language.
applyDayjsLocale(initialLng);

// Single write site for language persistence — fires for both the pre-auth
// selector and the in-lobby LanguageSelector, so a logged-in user's choice
// carries back to /login after logout. Region-tagged codes ("en-US") are
// normalized to the short form before persisting. The same listener keeps
// dayjs's active locale in lock-step so chat + room-age timestamps localize
// on every switch without a refresh.
i18n.on("languageChanged", (lng) => {
  const normalized = normalizeLanguage(lng);
  if (!normalized) return;
  applyDayjsLocale(normalized);
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, normalized);
  } catch {
    // localStorage unavailable (private mode, disabled, quota) — no-op.
  }
});

export { i18n };
