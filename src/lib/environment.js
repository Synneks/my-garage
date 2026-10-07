export const PRODUCTION_PROJECT_ID = "my-garage-981e8";
export const LOCAL_PROJECT_ID = "demo-my-garage-local";
export const STAGING_PROJECT_ID = "my-garage-staging";
export const LOCAL_ENV = {
  VITE_APP_ENV: "local",
  VITE_FIREBASE_API_KEY: "demo-my-garage-local-public-key",
  VITE_FIREBASE_AUTH_DOMAIN: "demo-my-garage-local.firebaseapp.com",
  VITE_FIREBASE_PROJECT_ID: LOCAL_PROJECT_ID,
  VITE_FIREBASE_APP_ID: "1:123456789:web:demo-my-garage-local",
  VITE_USE_FIREBASE_EMULATORS: "true",
};
const modes = {
  emulator: "local",
  staging: "staging",
  production: "production",
};
/** @param {Record<string, string | undefined>} env @param {{mode: string, command: string}} context */
export function resolveEnvironment(env, { mode, command }) {
  const environment = modes[mode];
  if (!environment || env.VITE_APP_ENV !== environment)
    throw new Error(
      "Choose an explicit emulator, staging, or production mode and matching VITE_APP_ENV.",
    );
  if (environment === "production" && command !== "build")
    throw new Error(
      "Production Firebase is forbidden in development servers. Use npm run dev or npm run dev:staging.",
    );
  if (environment === "local" && command !== "serve")
    throw new Error(
      "Local emulator configuration cannot be used in a distributable build.",
    );
  const config = {
    apiKey: env.VITE_FIREBASE_API_KEY?.trim(),
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN?.trim(),
    projectId: env.VITE_FIREBASE_PROJECT_ID?.trim(),
    appId: env.VITE_FIREBASE_APP_ID?.trim(),
  };
  if (Object.values(config).some((value) => !value))
    throw new Error(
      `Incomplete ${environment} Firebase configuration. Fill in .env.${mode}.local; generic .env.local is not used.`,
    );
  const expected = {
    local: LOCAL_PROJECT_ID,
    staging: STAGING_PROJECT_ID,
    production: PRODUCTION_PROJECT_ID,
  }[environment];
  if (config.projectId !== expected)
    throw new Error(
      `${environment} requires Firebase project ${expected}; received ${config.projectId}.`,
    );
  if (
    env.VITE_USE_FIREBASE_EMULATORS !==
    (environment === "local" ? "true" : "false")
  )
    throw new Error(`${environment} has an invalid emulator setting.`);
  if (
    environment !== "local" &&
    (config.apiKey.startsWith("demo-") ||
      config.authDomain !== `${expected}.firebaseapp.com`)
  )
    throw new Error(`Invalid ${environment} Firebase Web configuration.`);
  return { environment, config, usingEmulators: environment === "local" };
}
/** @param {string} environment @param {string} projectId */
export function notebookStorageKey(environment, projectId) {
  return environment === "production"
    ? "bandit-maintenance-v1"
    : `bandit-maintenance-v1:${environment}:${projectId}`;
}
