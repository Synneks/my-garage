import { AppError } from "./app-error.js";
import en from "@/i18n/locales/en.json";
import type { TranslationKey } from "@/i18n";
import { resolveEnvironment } from "./environment.js";
import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const resolved = resolveEnvironment(import.meta.env, {
  mode: import.meta.env.MODE,
  command: import.meta.env.DEV ? "serve" : "build",
});
export const appEnvironment = resolved.environment;
export const firebaseProjectId = resolved.config.projectId!;
export const firebaseConfigured = true;
const app = initializeApp(resolved.config);
export const auth = getAuth(app);
export const db = getFirestore(app);
export async function login() {
  if (!auth) throw new AppError("errors.firebase_configuration");
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  await signInWithPopup(auth, provider);
}
export async function logout() {
  if (auth) await signOut(auth);
}
export function firebaseMessage(error: unknown): TranslationKey {
  const rawCode = (error as { code?: unknown } | null)?.code;
  const code = typeof rawCode === "string" ? rawCode : "";
  const messages: Record<string, TranslationKey> = {
    "auth/popup-blocked": "errors.popup_blocked",
    "auth/popup-closed-by-user": "errors.popup_closed",
    "auth/cancelled-popup-request": "errors.popup_running",
    "auth/unauthorized-domain": "errors.auth_domain",
    "auth/operation-not-allowed": "errors.auth_disabled",
    "auth/invalid-api-key": "errors.api_key",
    "auth/network-request-failed": "errors.network",
    "permission-denied": "errors.permission",
    unavailable: "errors.unavailable",
  };
  if (code?.startsWith("errors.") && Object.hasOwn(en, code))
    return code as TranslationKey;
  return messages[code || ""] || "errors.unexpected";
}
