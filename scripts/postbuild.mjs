import { writeFile } from "node:fs/promises";
import { loadEnvironment } from "./load-environment.mjs";
const env = loadEnvironment(process.argv[2] || "production", "build");
await writeFile("dist/.nojekyll", "");
await writeFile(
  "dist/deployment.json",
  JSON.stringify(
    {
      environment: env.VITE_APP_ENV,
      projectId: env.VITE_FIREBASE_PROJECT_ID,
    },
    null,
    2,
  ) + "\n",
);
