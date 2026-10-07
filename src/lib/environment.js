export const PRODUCTION_PROJECT_ID = "my-garage-981e8";
export const STAGING_PROJECT_ID = "my-garage-staging";
/** @param {Record<string, string | undefined>} env @param {{mode: string, command: string}} context */
export function resolveEnvironment(env, { mode, command }) {
  if (!["staging", "production"].includes(mode) || env.VITE_APP_ENV !== mode)
    throw new Error(
      "Choose staging or production mode and matching VITE_APP_ENV.",
    );
  if (mode === "production" && command !== "build")
    throw new Error(
      "Production Firebase is forbidden in development servers. Use npm run dev.",
    );
  const config = {
    apiKey: env.VITE_FIREBASE_API_KEY?.trim(),
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN?.trim(),
    projectId: env.VITE_FIREBASE_PROJECT_ID?.trim(),
    appId: env.VITE_FIREBASE_APP_ID?.trim(),
  };
  if (Object.values(config).some((value) => !value))
    throw new Error(
      `Incomplete ${mode} Firebase configuration. Fill in .env.${mode}.local.`,
    );
  const expected =
    mode === "production" ? PRODUCTION_PROJECT_ID : STAGING_PROJECT_ID;
  if (config.projectId !== expected)
    throw new Error(
      `${mode} requires Firebase project ${expected}; received ${config.projectId}.`,
    );
  if (
    env.VITE_USE_FIREBASE_EMULATORS &&
    env.VITE_USE_FIREBASE_EMULATORS !== "false"
  )
    throw new Error(
      "App development uses cloud staging; emulator configuration is unsupported.",
    );
  if (
    config.apiKey.startsWith("demo-") ||
    config.authDomain !== `${expected}.firebaseapp.com`
  )
    throw new Error(`Invalid ${mode} Firebase Web configuration.`);
  return { environment: mode, config };
}
/** @param {string} environment @param {string} projectId */
export function notebookStorageKey(environment, projectId) {
  return environment === "production"
    ? "bandit-maintenance-v1"
    : `bandit-maintenance-v1:${environment}:${projectId}`;
}
