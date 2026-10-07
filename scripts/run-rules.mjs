import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { runtimeEnv, requireFreePorts, runFirebase } from "./runtime.mjs";
try {
  const env = runtimeEnv();
  await requireFreePorts([8081, 9151, 4401, 4501]);
  await mkdir(".runtime/rules", { recursive: true });
  await writeFile(
    ".runtime/rules/firebase.json",
    JSON.stringify({
      firestore: { rules: resolve("firestore.rules") },
      emulators: {
        firestore: { host: "127.0.0.1", port: 8081, websocketPort: 9151 },
        hub: { host: "127.0.0.1", port: 4401 },
        logging: { host: "127.0.0.1", port: 4501 },
        ui: { enabled: false },
        singleProjectMode: true,
      },
    }),
  );
  await runFirebase(
    [
      "emulators:exec",
      "--only",
      "firestore",
      "--project",
      "demo-bandit-rules",
      "--config",
      ".runtime/rules/firebase.json",
      "node --test test/firestore.rules.test.mjs",
    ],
    env,
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
