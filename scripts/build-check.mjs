import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { STAGING_PROJECT_ID } from "../src/lib/environment.js";
// Compile-only artifact: this fake Web key cannot authenticate to Firebase.
const env = {
  ...process.env,
  VITE_APP_ENV: "staging",
  VITE_FIREBASE_PROJECT_ID: STAGING_PROJECT_ID,
  VITE_FIREBASE_API_KEY: "build-check-not-a-real-key",
  VITE_FIREBASE_AUTH_DOMAIN: `${STAGING_PROJECT_ID}.firebaseapp.com`,
  VITE_FIREBASE_APP_ID: "1:123456789:web:build-check",
  VITE_USE_FIREBASE_EMULATORS: "false",
};
for (const [script, args] of [
  ["node_modules/typescript/bin/tsc", ["--noEmit"]],
  ["node_modules/vite/bin/vite.js", ["build", "--mode", "staging"]],
  ["scripts/postbuild.mjs", ["staging"]],
]) {
  const result = spawnSync(process.execPath, [resolve(script), ...args], {
    env,
    stdio: "inherit",
    windowsHide: true,
  });
  if (result.error || result.status !== 0) process.exit(result.status || 1);
}
