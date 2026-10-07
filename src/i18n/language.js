export const LANGUAGE_KEY = "bandit-language-v1";
export const isLanguage = (value) => value === "en" || value === "ro";
export const languageKey = (uid) =>
  uid ? `${LANGUAGE_KEY}:${uid}` : LANGUAGE_KEY;
export function browserStorage() {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}
export function detectLanguage(languages = []) {
  for (const value of languages) {
    const language = value.toLowerCase().split("-")[0];
    if (isLanguage(language)) return language;
  }
  return "en";
}
export function readLanguage(storage, languages, uid) {
  try {
    const saved = storage.getItem(languageKey(uid));
    if (isLanguage(saved)) return saved;
  } catch {
    /* Storage can be unavailable in private or restricted browsers. */
  }
  return detectLanguage(languages);
}
export function cacheLanguage(storage, language, uid) {
  try {
    storage.setItem(languageKey(uid), language);
  } catch {
    /* Keep the in-memory choice. */
  }
}
