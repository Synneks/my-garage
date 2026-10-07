import { writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { loadEnvironment } from "./load-environment.mjs";
const mode = process.argv[2] || "production";
const env = loadEnvironment(mode, "build");
await writeFile(new URL("../dist/.nojekyll", import.meta.url), "");
await writeFile(
  new URL("../dist/deployment.json", import.meta.url),
  JSON.stringify(
    {
      environment: env.VITE_APP_ENV,
      projectId: env.VITE_FIREBASE_PROJECT_ID,
      sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], {
        encoding: "utf8",
        windowsHide: true,
      }).trim(),
      builtAt: new Date().toISOString(),
      purpose: env.VITE_FIREBASE_API_KEY.startsWith("build-check-")
        ? "verification-only"
        : "deployment",
    },
    null,
    2,
  ) + "\n",
);
