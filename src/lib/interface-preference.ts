import {
  doc,
  getDocFromServer,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import { isLanguage } from "@/i18n/language.js";
import type { Language } from "@/i18n";
import { AppError } from "./app-error.js";

function reference(uid: string) {
  if (!db) throw new AppError("errors.firebase_missing");
  return doc(db, "users", uid, "preferences", "interface");
}
export function subscribeLanguage(
  uid: string,
  onValue: (language: Language | null) => void,
  onError: (error: unknown) => void,
) {
  return onSnapshot(
    reference(uid),
    { includeMetadataChanges: true },
    (snapshot) => {
      // Missing cached documents are not evidence that the account has no preference.
      if (snapshot.metadata.hasPendingWrites || snapshot.metadata.fromCache)
        return;
      const value = snapshot.data()?.language;
      if (snapshot.exists() && !isLanguage(value)) {
        onError(new AppError("errors.invalid_preference"));
        return;
      }
      onValue(snapshot.exists() ? (value as Language) : null);
    },
    onError,
  );
}
export async function initializeLanguage(
  uid: string,
  language: Language,
): Promise<Language> {
  const target = reference(uid);
  return runTransaction(db!, async (transaction) => {
    const existing = await transaction.get(target);
    if (existing.exists()) {
      const value = existing.data().language;
      if (!isLanguage(value)) throw new AppError("errors.invalid_preference");
      return value as Language;
    }
    transaction.set(target, { language, updatedAt: serverTimestamp() });
    return language;
  });
}
export async function writeLanguage(
  uid: string,
  language: Language,
): Promise<Language> {
  const target = reference(uid);
  await setDoc(target, { language, updatedAt: serverTimestamp() });
  const snapshot = await getDocFromServer(target);
  const value = snapshot.data()?.language;
  if (!isLanguage(value)) throw new AppError("errors.invalid_preference");
  return value as Language;
}
