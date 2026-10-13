// @ts-check
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

const nonEmptyString = z.string().trim().min(1);

/** @param {Record<string, string | undefined>} runtimeEnv @param {string} mode */
export function validateEnv(runtimeEnv, mode) {
  const development = mode === "development";
  return createEnv({
    clientPrefix: "VITE_",
    client: {
      VITE_FIREBASE_API_KEY: nonEmptyString,
      VITE_FIREBASE_AUTH_DOMAIN: development
        ? nonEmptyString.pipe(z.literal("my-garage-dev-72659.firebaseapp.com"))
        : nonEmptyString,
      VITE_FIREBASE_PROJECT_ID: development
        ? nonEmptyString.pipe(z.literal("my-garage-dev-72659"))
        : nonEmptyString,
      VITE_FIREBASE_APP_ID: nonEmptyString,
    },
    runtimeEnv,
    emptyStringAsUndefined: true,
  });
}
