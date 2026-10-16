import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { loadEnv } from "vite";
import { validateEnv } from "../src/lib/env";
import { notebookStorageKey } from "../src/lib/notebook-storage";

const production = {
  VITE_FIREBASE_API_KEY: "live-key",
  VITE_FIREBASE_AUTH_DOMAIN: "my-garage-981e8.firebaseapp.com",
  VITE_FIREBASE_PROJECT_ID: "my-garage-981e8",
  VITE_FIREBASE_APP_ID: "live-app",
};
const development = {
  VITE_FIREBASE_API_KEY: "test-key",
  VITE_FIREBASE_AUTH_DOMAIN: "my-garage-dev-6169f.firebaseapp.com",
  VITE_FIREBASE_PROJECT_ID: "my-garage-dev-6169f",
  VITE_FIREBASE_APP_ID: "test-app",
};

test("Vite selects mode-specific files using the same variable names", () => {
  const directory = mkdtempSync(join(tmpdir(), "my-garage-env-"));
  const previous = { ...process.env };
  try {
    for (const key of Object.keys(production)) delete process.env[key];
    for (const [mode, values] of Object.entries({ development, production })) {
      writeFileSync(
        join(directory, `.env.${mode}.local`),
        Object.entries(values)
          .map(([key, value]) => `${key}=${value}`)
          .join("\n"),
      );
    }
    for (const [mode, values] of Object.entries({ development, production })) {
      const env = validateEnv(loadEnv(mode, directory, "VITE_"), mode);
      assert.equal(
        env.VITE_FIREBASE_PROJECT_ID,
        values.VITE_FIREBASE_PROJECT_ID,
      );
      assert.equal(env.VITE_FIREBASE_API_KEY, values.VITE_FIREBASE_API_KEY);
    }
  } finally {
    for (const key of Object.keys(production)) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
    assert.equal(dirname(directory), tmpdir());
    rmSync(directory, { recursive: true, force: true });
  }
});

test("development rejects the production project or auth domain", () => {
  assert.throws(() => validateEnv(production, "development"));
  assert.throws(() =>
    validateEnv(
      {
        ...development,
        VITE_FIREBASE_PROJECT_ID: production.VITE_FIREBASE_PROJECT_ID,
      },
      "development",
    ),
  );
  assert.throws(() =>
    validateEnv(
      {
        ...development,
        VITE_FIREBASE_AUTH_DOMAIN: production.VITE_FIREBASE_AUTH_DOMAIN,
      },
      "development",
    ),
  );
});

test("both modes require all four nonempty Firebase settings", () => {
  for (const [mode, values] of Object.entries({ development, production })) {
    assert.equal(
      validateEnv(values, mode).VITE_FIREBASE_PROJECT_ID,
      values.VITE_FIREBASE_PROJECT_ID,
    );
    assert.throws(() => validateEnv({}, mode));
    for (const key of Object.keys(values)) {
      for (const value of [undefined, "", "   "]) {
        assert.throws(() => validateEnv({ ...values, [key]: value }, mode));
      }
    }
  }
});

test("schemas trim Firebase values", () => {
  const env = validateEnv(
    {
      ...development,
      VITE_FIREBASE_API_KEY: "  test-key  ",
      VITE_FIREBASE_PROJECT_ID: "  my-garage-dev-6169f  ",
    },
    "development",
  );
  assert.equal(env.VITE_FIREBASE_API_KEY, "test-key");
  assert.equal(
    env.VITE_FIREBASE_PROJECT_ID,
    development.VITE_FIREBASE_PROJECT_ID,
  );
});

test("production notebook storage is preserved and development storage is separate", () => {
  assert.equal(
    notebookStorageKey("production", production.VITE_FIREBASE_PROJECT_ID),
    "bandit-maintenance-v1",
  );
  assert.equal(
    notebookStorageKey("development", development.VITE_FIREBASE_PROJECT_ID),
    "bandit-maintenance-v1:development:my-garage-dev-6169f",
  );
});
