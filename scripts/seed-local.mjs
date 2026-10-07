import { initializeApp, deleteApp } from "firebase/app";
import {
  getAuth,
  connectAuthEmulator,
  GoogleAuthProvider,
  signInWithCredential,
} from "firebase/auth";
import {
  getFirestore,
  connectFirestoreEmulator,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { loadEnvironment } from "./load-environment.mjs";
import { resolveEnvironment } from "../src/lib/environment.js";
import { mockGoogleToken } from "../src/lib/mock-account.js";
import { mockNotebook } from "./mock-data.mjs";
export async function seedLocal() {
  const env = loadEnvironment("emulator", "serve");
  const { config } = resolveEnvironment(env, {
    mode: "emulator",
    command: "serve",
  });
  const app = initializeApp(config, "local-seed");
  try {
    const auth = getAuth(app);
    const db = getFirestore(app);
    connectAuthEmulator(auth, "http://127.0.0.1:9199", {
      disableWarnings: true,
    });
    connectFirestoreEmulator(db, "127.0.0.1", 8080);
    const user = await signInWithCredential(
      auth,
      GoogleAuthProvider.credential(mockGoogleToken()),
    );
    const ref = doc(db, "users", user.user.uid, "notebooks", "bandit");
    if (!(await getDoc(ref)).exists()) {
      await setDoc(ref, {
        state: mockNotebook(),
        revision: 1,
        updatedAt: serverTimestamp(),
      });
      console.log("Created synthetic notebook for bandit@example.test.");
    } else console.log("Preserved the existing local test notebook.");
  } finally {
    await deleteApp(app);
  }
}
