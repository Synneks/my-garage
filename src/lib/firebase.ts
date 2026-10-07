import { initializeApp } from "firebase/app";
import {
  connectAuthEmulator,
  getAuth,
  GoogleAuthProvider,
  signInWithCredential,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";

const env = import.meta.env;
const config = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};
export const firebaseConfigured = Object.values(config).every(
  (value) => typeof value === "string" && value.trim(),
);
const app = firebaseConfigured ? initializeApp(config) : null;
export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;
// Never connect a production build to a developer's emulator.
export const usingFirebaseEmulators =
  import.meta.env.DEV && env.VITE_USE_FIREBASE_EMULATORS === "true";
if (usingFirebaseEmulators && auth && db) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
}
export async function login() {
  if (!auth)
    throw new Error("Configurează proiectul Firebase pentru autentificare.");
  if (usingFirebaseEmulators) {
    // Official Auth emulator mock credential; unreachable in production builds.
    await signInWithCredential(
      auth,
      GoogleAuthProvider.credential(
        JSON.stringify({
          sub: "bandit-emulator-owner",
          email: "bandit@example.test",
          email_verified: true,
          name: "Cont de test",
        }),
      ),
    );
    return;
  }
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  await signInWithPopup(auth, provider);
}
export async function logout() {
  if (auth) await signOut(auth);
}
export function firebaseMessage(error: unknown) {
  const code = (error as { code?: string })?.code;
  const messages: Record<string, string> = {
    "auth/popup-blocked":
      "Browserul a blocat fereastra Google. Permite ferestrele pentru acest site și încearcă din nou.",
    "auth/popup-closed-by-user":
      "Autentificarea a fost închisă. Carnetul local este păstrat.",
    "auth/cancelled-popup-request": "O altă autentificare este deja în curs.",
    "auth/unauthorized-domain":
      "Adaugă domeniul site-ului la Firebase Authentication → Settings → Authorized domains.",
    "auth/operation-not-allowed":
      "Activează Google în Firebase Authentication → Sign-in method.",
    "auth/invalid-api-key":
      "Configurația Firebase nu este validă. Verifică fișierul .env.local.",
    "auth/network-request-failed":
      "Nu mă pot conecta la Firebase. Verifică conexiunea la internet.",
    "permission-denied":
      "Firebase a refuzat accesul. Verifică autentificarea și publicarea regulilor Firestore.",
    unavailable:
      "Firebase nu este disponibil. Datele afișate sunt păstrate; încearcă din nou când ai conexiune.",
  };
  return (
    messages[code || ""] ||
    (error instanceof Error ? error.message : "A apărut o eroare la salvare.")
  );
}
