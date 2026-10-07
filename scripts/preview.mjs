import { readFile } from "node:fs/promises";
import { preview } from "vite";
import { STAGING_PROJECT_ID } from "../src/lib/environment.js";
try {
  const metadata = JSON.parse(await readFile("dist/deployment.json", "utf8"));
  if (
    metadata.purpose !== "deployment" ||
    metadata.environment !== "staging" ||
    metadata.projectId !== STAGING_PROJECT_ID
  )
    throw new Error(
      "Local preview requires a staging artifact. Run npm run build:staging first; production artifacts are for deployment only.",
    );
  const server = await preview({
    mode: "staging",
    preview: { host: "127.0.0.1", port: 4177, strictPort: true },
  });
  server.printUrls();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
