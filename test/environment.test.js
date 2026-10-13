import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveEnvironment,
  notebookStorageKey,
  validateProductionEnvironment,
} from "../src/lib/environment.js";

const production = {
  VITE_FIREBASE_API_KEY: "live-key",
  VITE_FIREBASE_AUTH_DOMAIN: "my-garage-981e8.firebaseapp.com",
  VITE_FIREBASE_PROJECT_ID: "my-garage-981e8",
  VITE_FIREBASE_APP_ID: "live-app",
};
const development = {
  VITE_DEV_FIREBASE_API_KEY: "test-key",
  VITE_DEV_FIREBASE_AUTH_DOMAIN: "my-garage-dev-72659.firebaseapp.com",
  VITE_DEV_FIREBASE_PROJECT_ID: "my-garage-dev-72659",
  VITE_DEV_FIREBASE_APP_ID: "test-app",
};

test("development selects the test config even with live settings present", () => {
  const local = resolveEnvironment(
    { ...production, ...development },
    "development",
  );
  assert.deepEqual(local, resolveEnvironment(development, "development"));
  assert.equal(local.environment, "development");
  assert.equal(local.config.projectId, "my-garage-dev-72659");
  assert.equal(local.config.apiKey, "test-key");
});

test("test environments cannot fall back to live or incomplete settings", () => {
  const mode = "development";
  assert.throws(
    () => resolveEnvironment(production, mode),
    /Invalid environment variables/,
  );
  assert.throws(() =>
    resolveEnvironment({ ...development, VITE_DEV_FIREBASE_APP_ID: "" }, mode),
  );
  assert.throws(() =>
    resolveEnvironment(
      { ...development, VITE_DEV_FIREBASE_PROJECT_ID: "my-garage-981e8" },
      mode,
    ),
  );
  assert.throws(() =>
    resolveEnvironment(
      {
        ...development,
        VITE_DEV_FIREBASE_AUTH_DOMAIN: production.VITE_FIREBASE_AUTH_DOMAIN,
      },
      mode,
    ),
  );
});

test("deployment requires every production setting", () => {
  assert.equal(
    validateProductionEnvironment(production).VITE_FIREBASE_PROJECT_ID,
    production.VITE_FIREBASE_PROJECT_ID,
  );
  for (const key of Object.keys(production)) {
    for (const value of [undefined, "", "   "]) {
      assert.throws(() =>
        validateProductionEnvironment({ ...production, [key]: value }),
      );
    }
  }
});

test("schemas trim values and reject whitespace-only credentials", () => {
  assert.equal(
    resolveEnvironment(
      { ...development, VITE_DEV_FIREBASE_API_KEY: "  test-key  " },
      "development",
    ).config.apiKey,
    "test-key",
  );
  assert.throws(() =>
    resolveEnvironment(
      { ...development, VITE_DEV_FIREBASE_API_KEY: "   " },
      "development",
    ),
  );
  assert.throws(() =>
    resolveEnvironment(
      { ...production, VITE_FIREBASE_API_KEY: "   " },
      "production",
    ),
  );
  assert.equal(
    resolveEnvironment({ VITE_FIREBASE_API_KEY: "" }, "production").config
      .apiKey,
    undefined,
  );
});

test("production keeps using the original settings and supports unconfigured browser-only builds", () => {
  const live = resolveEnvironment(
    { ...production, ...development },
    "production",
  );
  assert.equal(live.environment, "production");
  assert.equal(live.config.projectId, "my-garage-981e8");
  assert.equal(live.config.apiKey, "live-key");
  assert.equal(
    resolveEnvironment({}, "production").config.projectId,
    undefined,
  );
});

test("production notebook storage is preserved and development storage is separate", () => {
  assert.equal(
    notebookStorageKey("production", "my-garage-981e8"),
    "bandit-maintenance-v1",
  );
  assert.notEqual(
    notebookStorageKey("development", "my-garage-dev-72659"),
    notebookStorageKey("production", "my-garage-981e8"),
  );
});
