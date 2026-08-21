import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import zh from "./locales/zh.json";
import { LS } from "./lib/settings";

const saved = localStorage.getItem(LS.lang);

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    zh: { translation: zh },
  },
  lng: saved || "zh",
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

export default i18n;
