import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import ro from "./locales/ro.json";
import { browserStorage, readLanguage } from "./language.js";

export type Language = "en" | "ro";
export const resources = { en: { translation: en }, ro: { translation: ro } };
export type TranslationKey = keyof typeof en;
export const i18n = i18next.createInstance();
export const i18nReady = i18n.use(initReactI18next).init({
  resources,
  lng:
    typeof window === "undefined"
      ? "en"
      : readLanguage(browserStorage(), navigator.languages),
  supportedLngs: ["en", "ro"],
  fallbackLng: "en",
  keySeparator: false,
  interpolation: { escapeValue: false },
});
declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "translation";
    resources: typeof resources.en;
    keySeparator: false;
  }
}
