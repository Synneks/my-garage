import { existsSync } from "node:fs";
import { loadEnvironment } from "./load-environment.mjs";
import { runtimeEnv, requireFreePorts, runFirebase } from "./runtime.mjs";
try {
  loadEnvironment("emulator", "serve");
  const env = runtimeEnv();
  await requireFreePorts([4174, 8080, 9199, 4000, 9150, 4410, 4510]);
  const args = [
    "emulators:exec",
    "--only",
    "auth,firestore",
    "--project",
    "demo-my-garage-local",
    "--ui",
    "--export-on-exit=.runtime/emulator-data",
  ];
  if (existsSync(".runtime/emulator-data/firebase-export-metadata.json"))
    args.push("--import=.runtime/emulator-data");
  args.push("node scripts/local-app.mjs");
  await runFirebase(args, env);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
