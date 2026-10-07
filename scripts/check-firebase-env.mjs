import { loadEnvironment } from "./load-environment.mjs";
const mode = process.argv[2] || "production";
const env = loadEnvironment(mode, "build");
if (env.VITE_FIREBASE_API_KEY.startsWith("build-check-"))
  throw new Error("Verification-only configuration cannot be deployed.");
console.log(`Validated ${mode} Firebase configuration.`);
