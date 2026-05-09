import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./en.json";
import hr from "./hr.json";
import mk from "./mk.json";
import sr from "./sr.json";

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    sr: { translation: sr },
    mk: { translation: mk },
    hr: { translation: hr },
  },
  lng: "en",
  fallbackLng: "en",
  interpolation: {
    escapeValue: false,
  },
});

export { i18n };
