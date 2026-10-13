export const DEVELOPMENT_PROJECT_ID = "my-garage-dev-72659";

/** @param {Record<string, string | undefined>} env @param {string} mode */
export function resolveEnvironment(env, mode) {
  const testing = mode === "development";
  const prefix = testing ? "VITE_DEV_FIREBASE_" : "VITE_FIREBASE_";
  const config = {
    apiKey: env[`${prefix}API_KEY`]?.trim(),
    authDomain: env[`${prefix}AUTH_DOMAIN`]?.trim(),
    projectId: env[`${prefix}PROJECT_ID`]?.trim(),
    appId: env[`${prefix}APP_ID`]?.trim(),
  };
  if (testing && Object.values(config).some((value) => !value))
    throw new Error("Set all four VITE_DEV_FIREBASE_* settings in .env.local.");
  if (
    testing &&
    (config.projectId !== DEVELOPMENT_PROJECT_ID ||
      config.authDomain !== `${DEVELOPMENT_PROJECT_ID}.firebaseapp.com`)
  )
    throw new Error(`Development must use ${DEVELOPMENT_PROJECT_ID}.`);
  return {
    environment: testing ? "development" : "production",
    config,
  };
}

/** @param {string} environment @param {string} projectId */
export function notebookStorageKey(environment, projectId) {
  return environment === "production"
    ? "bandit-maintenance-v1"
    : `bandit-maintenance-v1:${environment}:${projectId}`;
}
