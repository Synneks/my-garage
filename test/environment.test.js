import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  LOCAL_ENV,
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
  VITE_USE_FIREBASE_EMULATORS: "false",
});
test("local requires demo project and both emulators; cannot become a build", () => {
  assert.equal(
    resolveEnvironment(LOCAL_ENV, { mode: "emulator", command: "serve" })
      .usingEmulators,
    true,
  );
  for (const changes of [
    { VITE_FIREBASE_PROJECT_ID: PRODUCTION_PROJECT_ID },
    { VITE_USE_FIREBASE_EMULATORS: "false" },
    { VITE_FIREBASE_API_KEY: "" },
  ])
    assert.throws(() =>
      resolveEnvironment(
        { ...LOCAL_ENV, ...changes },
        { mode: "emulator", command: "serve" },
      ),
    );
  assert.throws(() =>
    resolveEnvironment(LOCAL_ENV, { mode: "emulator", command: "build" }),
  );
});
test("staging uses only its pinned cloud project in dev and compiled builds", () => {
  for (const command of ["serve", "build"])
    assert.equal(
      resolveEnvironment(cloud("staging"), { mode: "staging", command })
        .environment,
      "staging",
    );
  for (const changes of [
    { VITE_FIREBASE_PROJECT_ID: PRODUCTION_PROJECT_ID },
    { VITE_FIREBASE_PROJECT_ID: "some-other-project" },
    { VITE_USE_FIREBASE_EMULATORS: "true" },
    { VITE_FIREBASE_APP_ID: undefined },
  ])
    assert.throws(() =>
      resolveEnvironment(
        { ...cloud("staging"), ...changes },
        { mode: "staging", command: "serve" },
      ),
    );
});
test("production is build-only and cannot target staging or an emulator", () => {
  assert.equal(
    resolveEnvironment(cloud("production"), {
      mode: "production",
      command: "build",
    }).environment,
    "production",
  );
  assert.throws(() =>
    resolveEnvironment(cloud("production"), {
      mode: "production",
      command: "serve",
    }),
  );
  assert.throws(() =>
    resolveEnvironment(
      { ...cloud("production"), VITE_FIREBASE_PROJECT_ID: STAGING_PROJECT_ID },
      { mode: "production", command: "build" },
    ),
  );
  assert.throws(() =>
    resolveEnvironment(
      { ...cloud("production"), VITE_USE_FIREBASE_EMULATORS: "true" },
      { mode: "production", command: "build" },
    ),
  );
  assert.throws(() =>
    resolveEnvironment(cloud("production"), {
      mode: "development",
      command: "serve",
    }),
  );
});
test("production browser key is preserved and test environments have distinct keys", () => {
  assert.equal(
    notebookStorageKey("production", PRODUCTION_PROJECT_ID),
    "bandit-maintenance-v1",
  );
  const keys = [
    notebookStorageKey("production", PRODUCTION_PROJECT_ID),
    notebookStorageKey("staging", STAGING_PROJECT_ID),
    notebookStorageKey("local", "demo-my-garage-local"),
  ];
  assert.equal(new Set(keys).size, 3);
});
test("generic production config and inherited shell overrides cannot contaminate local mode", () => {
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
      () => loadEnvironment("emulator", "serve", root),
      /Generic Firebase/,
    );
    rmSync(join(root, ".env.local"));
    process.env.VITE_FIREBASE_PROJECT_ID = PRODUCTION_PROJECT_ID;
    assert.throws(
      () => loadEnvironment("emulator", "serve", root),
      /requires Firebase project/,
    );
    delete process.env.VITE_FIREBASE_PROJECT_ID;
    assert.equal(
      loadEnvironment("emulator", "serve", root).VITE_APP_ENV,
      "local",
    );
    assert.throws(
      () => loadEnvironment("staging", "serve", root),
      /matching VITE_APP_ENV/,
    );
  } finally {
    for (const key of Object.keys(process.env))
      if (key.startsWith("VITE_")) delete process.env[key];
    Object.assign(process.env, previous);
    rmSync(root, { recursive: true, force: true });
  }
});
