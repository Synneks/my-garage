const required = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_APP_ID",
];
const missing = required.filter((key) => !process.env[key]?.trim());
if (missing.length)
  throw new Error(
    `Set the required GitHub Pages repository variables: ${missing.join(", ")}`,
  );
if (
  process.env.VITE_FIREBASE_PROJECT_ID.startsWith("demo-") ||
  process.env.VITE_USE_FIREBASE_EMULATORS === "true"
) {
  throw new Error(
    "Deployment requires a real Firebase project configuration with emulators disabled.",
  );
}
