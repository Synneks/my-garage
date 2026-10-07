import { defineConfig } from "vite";
import { readFileSync } from "node:fs";
import { STAGING_PROJECT_ID } from "./src/lib/environment.js";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";
import { loadEnvironment } from "./scripts/load-environment.mjs";

export default defineConfig(({ mode, command, isPreview }) => {
  const env = loadEnvironment(mode, command);
  if (isPreview) {
    const metadata = JSON.parse(readFileSync("dist/deployment.json", "utf8"));
    if (
      metadata.environment !== "staging" ||
      metadata.projectId !== STAGING_PROJECT_ID
    )
      throw new Error(
        "Preview requires a staging build. Run npm run build:staging first.",
      );
  }
  return {
    envDir: false,
    define: Object.fromEntries(
      Object.entries(env).map(([key, value]) => [
        `import.meta.env.${key}`,
        JSON.stringify(value),
      ]),
    ),
    plugins: [react(), tailwindcss()],
    base: "./",
    server: {
      watch: {
        ignored: ["**/.runtime/**", "**/*-debug.log", "**/artifacts/**"],
      },
    },
    resolve: {
      alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
    },
    build: {
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              {
                name: "firestore",
                test: /node_modules[\\/]@firebase[\\/]firestore/,
                priority: 3,
              },
              {
                name: "auth",
                test: /node_modules[\\/]@firebase[\\/]auth/,
                priority: 3,
              },
              { name: "vendor", test: /node_modules/, priority: 1 },
            ],
          },
        },
      },
    },
  };
});
