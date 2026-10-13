// @ts-check
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const DEVELOPMENT_PROJECT_ID = "my-garage-dev-72659";

const nonEmptyString = z.string().trim().min(1);
const productionSchema = z.object({
  VITE_FIREBASE_API_KEY: nonEmptyString,
  VITE_FIREBASE_AUTH_DOMAIN: nonEmptyString,
  VITE_FIREBASE_PROJECT_ID: nonEmptyString,
  VITE_FIREBASE_APP_ID: nonEmptyString,
});

/** @param {Record<string, string | undefined>} runtimeEnv @param {boolean} required */
export function validateProductionEnvironment(runtimeEnv, required = true) {
  if (required) {
    return createEnv({
      clientPrefix: "VITE_",
      client: productionSchema.shape,
      runtimeEnv,
      emptyStringAsUndefined: true,
    });
  }
  return createEnv({
    clientPrefix: "VITE_",
    client: productionSchema.partial().shape,
    runtimeEnv,
    emptyStringAsUndefined: true,
  });
}

/** @param {Record<string, string | undefined>} env @param {string} mode */
export function resolveEnvironment(env, mode) {
  if (mode === "development") {
    const validated = createEnv({
      clientPrefix: "VITE_",
      client: {
        VITE_DEV_FIREBASE_API_KEY: nonEmptyString,
        VITE_DEV_FIREBASE_AUTH_DOMAIN: nonEmptyString.pipe(
          z.literal(`${DEVELOPMENT_PROJECT_ID}.firebaseapp.com`),
        ),
        VITE_DEV_FIREBASE_PROJECT_ID: nonEmptyString.pipe(
          z.literal(DEVELOPMENT_PROJECT_ID),
        ),
        VITE_DEV_FIREBASE_APP_ID: nonEmptyString,
      },
      runtimeEnv: env,
      emptyStringAsUndefined: true,
    });
    return {
      environment: "development",
      config: {
        apiKey: validated.VITE_DEV_FIREBASE_API_KEY,
        authDomain: validated.VITE_DEV_FIREBASE_AUTH_DOMAIN,
        projectId: validated.VITE_DEV_FIREBASE_PROJECT_ID,
        appId: validated.VITE_DEV_FIREBASE_APP_ID,
      },
    };
  }

  // Firebase is optional for browser-only builds; deployment requires it.
  const validated = validateProductionEnvironment(env, false);
  return {
    environment: "production",
    config: {
      apiKey: validated.VITE_FIREBASE_API_KEY,
      authDomain: validated.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: validated.VITE_FIREBASE_PROJECT_ID,
      appId: validated.VITE_FIREBASE_APP_ID,
    },
  };
}

/** @param {string} environment @param {string} projectId */
export function notebookStorageKey(environment, projectId) {
  return environment === "production"
    ? "bandit-maintenance-v1"
    : `bandit-maintenance-v1:${environment}:${projectId}`;
}
