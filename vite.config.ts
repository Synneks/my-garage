import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";
import { loadEnvironment } from "./scripts/load-environment.mjs";

export default defineConfig(({ mode, command }) => {
  const env = loadEnvironment(mode, command);
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
