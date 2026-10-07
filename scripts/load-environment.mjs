import { readFileSync, existsSync } from "node:fs";
import { loadEnv } from "vite";
import { LOCAL_ENV, resolveEnvironment } from "../src/lib/environment.js";
export function loadEnvironment(mode, command, root = process.cwd()) {
  for (const filename of [".env", ".env.local"]) {
    const path = `${root}/${filename}`;
    if (
      existsSync(path) &&
      /^\s*(?:export\s+)?VITE_(?:APP_ENV|FIREBASE_|USE_FIREBASE_EMULATORS)/m.test(
        readFileSync(path, "utf8"),
      )
    )
      throw new Error(
        `Move Firebase settings out of ${filename} into .env.production.local or .env.staging.local. Generic Firebase configuration is forbidden.`,
      );
  }
  const env = {
    ...(mode === "emulator" ? LOCAL_ENV : {}),
    ...loadEnv(mode, root, "VITE_"),
  };
  resolveEnvironment(env, { mode, command });
  return env;
}
