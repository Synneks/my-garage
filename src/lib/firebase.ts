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

const env = import.meta.env;
const { environment, config } = resolveEnvironment(env, env.MODE);
export const appEnvironment = environment;
export const firebaseProjectId = config.projectId || "";
export const firebaseConfigured = Boolean(
  config.apiKey && config.authDomain && config.projectId && config.appId,
);
const app = firebaseConfigured ? initializeApp(config) : null;
export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;
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
