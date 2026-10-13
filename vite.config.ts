import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";
import { resolveEnvironment } from "./src/lib/environment.js";

export default defineConfig(({ mode }) => {
  resolveEnvironment(loadEnv(mode, process.cwd(), "VITE_"), mode);
  return {
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
