import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  PRODUCTION_PROJECT_ID,
  STAGING_PROJECT_ID,
  resolveEnvironment,
  notebookStorageKey,
} from "../src/lib/environment.js";
import { loadEnvironment } from "../scripts/load-environment.mjs";
const cloud = (environment) => ({
  VITE_APP_ENV: environment,
  VITE_FIREBASE_API_KEY: "public-web-key",
  VITE_FIREBASE_AUTH_DOMAIN: `${environment === "production" ? PRODUCTION_PROJECT_ID : STAGING_PROJECT_ID}.firebaseapp.com`,
  VITE_FIREBASE_PROJECT_ID:
    environment === "production" ? PRODUCTION_PROJECT_ID : STAGING_PROJECT_ID,
  VITE_FIREBASE_APP_ID: "1:123:web:test",
});
test("development and staging builds use the separate cloud test project", () => {
  for (const command of ["serve", "build"])
    assert.equal(
      resolveEnvironment(cloud("staging"), { mode: "staging", command })
        .environment,
      "staging",
    );
  for (const changes of [
    { VITE_FIREBASE_PROJECT_ID: PRODUCTION_PROJECT_ID },
    { VITE_FIREBASE_PROJECT_ID: "other-project" },
    { VITE_FIREBASE_APP_ID: undefined },
    { VITE_USE_FIREBASE_EMULATORS: "true" },
    { VITE_FIREBASE_AUTH_DOMAIN: `${PRODUCTION_PROJECT_ID}.firebaseapp.com` },
  ])
    assert.throws(() =>
      resolveEnvironment(
        { ...cloud("staging"), ...changes },
        { mode: "staging", command: "serve" },
      ),
    );
});
test("production is build-only and cannot target staging", () => {
  assert.equal(
    resolveEnvironment(cloud("production"), {
      mode: "production",
      command: "build",
    }).environment,
    "production",
  );
  assert.throws(
    () =>
      resolveEnvironment(cloud("production"), {
        mode: "production",
        command: "serve",
      }),
    /forbidden/,
  );
  assert.throws(
    () =>
      resolveEnvironment(
        {
          ...cloud("production"),
          VITE_FIREBASE_PROJECT_ID: STAGING_PROJECT_ID,
        },
        { mode: "production", command: "build" },
      ),
    /requires Firebase/,
  );
});
test("implicit, mismatched, and old emulator profiles are rejected", () => {
  for (const mode of ["development", "emulator", "unknown"])
    assert.throws(
      () => resolveEnvironment(cloud("staging"), { mode, command: "serve" }),
      /Choose staging or production/,
    );
  assert.throws(() =>
    resolveEnvironment(cloud("production"), {
      mode: "staging",
      command: "serve",
    }),
  );
  assert.throws(() =>
    resolveEnvironment(
      { ...cloud("staging"), VITE_FIREBASE_API_KEY: "demo-key" },
      { mode: "staging", command: "serve" },
    ),
  );
});
test("production browser storage is preserved and staging storage is separate", () => {
  const production = notebookStorageKey("production", PRODUCTION_PROJECT_ID);
  assert.equal(production, "bandit-maintenance-v1");
  assert.equal(
    notebookStorageKey("staging", STAGING_PROJECT_ID),
    `bandit-maintenance-v1:staging:${STAGING_PROJECT_ID}`,
  );
  assert.notEqual(
    production,
    notebookStorageKey("staging", STAGING_PROJECT_ID),
  );
});
test("generic config and inherited production shell settings cannot contaminate development", () => {
  const root = mkdtempSync(join(tmpdir(), "garage-env-"));
  const previous = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => key.startsWith("VITE_")),
  );
  for (const key of Object.keys(previous)) delete process.env[key];
  try {
    writeFileSync(
      join(root, ".env.local"),
      `VITE_FIREBASE_PROJECT_ID=${PRODUCTION_PROJECT_ID}`,
    );
    assert.throws(
      () => loadEnvironment("staging", "serve", root),
      /Generic Firebase/,
    );
    rmSync(join(root, ".env.local"));
    assert.throws(
      () => loadEnvironment("staging", "serve", root),
      /matching VITE_APP_ENV/,
    );
    writeFileSync(
      join(root, ".env.staging.local"),
      Object.entries(cloud("staging"))
        .map(([key, value]) => `${key}=${value}`)
        .join("\n"),
    );
    assert.equal(
      loadEnvironment("staging", "serve", root).VITE_FIREBASE_PROJECT_ID,
      STAGING_PROJECT_ID,
    );
    process.env.VITE_FIREBASE_PROJECT_ID = PRODUCTION_PROJECT_ID;
    assert.throws(
      () => loadEnvironment("staging", "serve", root),
      /requires Firebase project/,
    );
  } finally {
    for (const key of Object.keys(process.env))
      if (key.startsWith("VITE_")) delete process.env[key];
    Object.assign(process.env, previous);
    rmSync(root, { recursive: true, force: true });
  }
});
