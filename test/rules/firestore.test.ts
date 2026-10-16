import type {
  RulesTestEnvironment,
  RulesTestContext,
} from "@firebase/rules-unit-testing";
import type { Notebook } from "../../src/types";
import { before, beforeEach, after, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from "@firebase/rules-unit-testing";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import {
  emptyNotebook,
  migrateNotebook,
  removeTask,
} from "../../src/lib/garage";
import { createInitialState } from "../../src/data";

let environment: RulesTestEnvironment;
before(async () => {
  const [host, port] = (
    process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080"
  ).split(":");
  environment = await initializeTestEnvironment({
    projectId: "demo-garage-crud",
    firestore: {
      host,
      port: Number(port),
      rules: readFileSync(
        new URL("../../firestore.rules", import.meta.url),
        "utf8",
      ),
    },
  });
});
beforeEach(async () => {
  await environment.clearFirestore();
});
after(async () => {
  await environment?.cleanup();
});
const state = () =>
  emptyNotebook({ make: "Honda", model: "CB500", year: 2020, km: 12000 });
const value = (notebook: Notebook = state(), revision = 1) => ({
  state: notebook,
  revision,
  updatedAt: serverTimestamp(),
});
const ref = (
  db: ReturnType<RulesTestContext["firestore"]>,
  id = "honda",
  owner = "alice",
) => doc(db, "users", owner, "notebooks", id);
const db = (uid?: string) =>
  uid
    ? environment.authenticatedContext(uid).firestore()
    : environment.unauthenticatedContext().firestore();

test("owners can create, list, update and delete different vehicles", async () => {
  const own = db("alice");
  await assertSucceeds(setDoc(ref(own), value()));
  const yamaha = state();
  yamaha.vehicle = { make: "Yamaha", model: "MT-07", year: 2024, km: 50 };
  await assertSucceeds(setDoc(ref(own, "yamaha"), value(yamaha)));
  assert.equal(
    (await getDocs(collection(own, "users", "alice", "notebooks"))).size,
    2,
  );
  const updated = state();
  updated.vehicle.km = 13000;
  await assertSucceeds(setDoc(ref(own), value(updated, 2)));
  await assertSucceeds(deleteDoc(ref(own, "yamaha")));
  assert.equal((await getDoc(ref(own))).data()!.state.vehicle.km, 13000);
});
test("anonymous users and other accounts cannot read, query, create, update or delete a garage", async () => {
  await setDoc(ref(db("alice")), value());
  for (const denied of [db(), db("bob")]) {
    await assertFails(getDoc(ref(denied)));
    await assertFails(
      getDocs(collection(denied, "users", "alice", "notebooks")),
    );
    await assertFails(setDoc(ref(denied, "new"), value()));
    await assertFails(setDoc(ref(denied), value(state(), 2)));
    await assertFails(deleteDoc(ref(denied)));
  }
});
test("rules reject invalid vehicle schemas, timestamps, capacities and revision changes", async () => {
  const own = db("alice");
  const invalid = state();
  invalid.vehicle.year = 1;
  await assertFails(setDoc(ref(own), value(invalid)));
  await assertFails(setDoc(ref(own), { ...value(), updatedAt: new Date(0) }));
  const excessive = state();
  excessive.tasks = Array(1001).fill({});
  await assertFails(setDoc(ref(own), value(excessive)));
  await assertFails(setDoc(ref(own), value(state(), 2)));
  await setDoc(ref(own), value());
  await assertFails(setDoc(ref(own), value(state(), 1)));
  await assertFails(setDoc(ref(own), value(state(), 3)));
});
test("legacy Bandit logs migrate in place without losing records or changing account ownership", async () => {
  const legacy = createInitialState();
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(ref(context.firestore(), "bandit"), value(legacy));
  });
  const own = db("alice");
  const snapshot = await getDoc(ref(own, "bandit"));
  const migrated = migrateNotebook(snapshot.data()!.state);
  await assertSucceeds(setDoc(ref(own, "bandit"), value(migrated, 2)));
  const saved = (await getDoc(ref(own, "bandit"))).data()!.state;
  assert.equal(saved.tasks.length, 38);
  assert.equal(saved.events.length, legacy.events.length);
  assert.ok(
    saved.events.every((event: { taskName?: string }) => event.taskName),
  );
});

test("legacy clients retain owner-only access to the Bandit log during rollout", async () => {
  const own = db("alice");
  const legacy = createInitialState();
  await assertSucceeds(setDoc(ref(own, "bandit"), value(legacy)));
  legacy.vehicle.km += 1;
  await assertSucceeds(setDoc(ref(own, "bandit"), value(legacy, 2)));
  assert.equal(
    (await getDocs(collection(own, "users", "alice", "notebooks"))).size,
    1,
  );
  await assertFails(setDoc(ref(own, "another-legacy"), value(legacy)));
  await assertFails(getDoc(ref(db("bob"), "bandit")));
  await assertFails(setDoc(ref(db("bob"), "bandit"), value(legacy, 3)));
  await assertSucceeds(
    setDoc(ref(own, "bandit"), value(migrateNotebook(legacy), 3)),
  );
  await assertFails(setDoc(ref(own, "bandit"), value(legacy, 4)));
});

test("interface preferences synchronize only for their owner", async () => {
  const own = db("alice");
  const reference = (firestore: ReturnType<RulesTestContext["firestore"]>) =>
    doc(firestore, "users", "alice", "preferences", "interface");
  assert.equal((await assertSucceeds(getDoc(reference(own)))).exists(), false);
  await assertSucceeds(
    setDoc(reference(own), { language: "en", updatedAt: serverTimestamp() }),
  );
  await assertSucceeds(
    setDoc(reference(own), { language: "ro", updatedAt: serverTimestamp() }),
  );
  assert.equal((await getDoc(reference(own))).data()!.language, "ro");
  await assertFails(
    setDoc(reference(own), { language: "pl", updatedAt: serverTimestamp() }),
  );
  for (const denied of [db(), db("bob")]) {
    await assertFails(getDoc(reference(denied)));
    await assertFails(
      setDoc(reference(denied), {
        language: "en",
        updatedAt: serverTimestamp(),
      }),
    );
  }
});
test("custom task deletion retains named history, which can subsequently be edited and deleted", async () => {
  const own = db("alice");
  const initial = state();
  initial.tasks.push({
    id: "polish",
    name: "Łańcuch",
    category: "Napęd",
    action: "Wymiana",
    intervalKm: null,
    intervalMonths: null,
    source: "",
  });
  initial.events.push({
    id: "event",
    taskId: "polish",
    taskName: "Łańcuch",
    action: "Wymiana",
    date: "2026-01-01",
    km: 10000,
    notes: "",
    confirmed: true,
  });
  await setDoc(ref(own), value(initial));
  const deleted = removeTask(initial, "polish");
  await assertSucceeds(setDoc(ref(own), value(deleted, 2)));
  let saved = (await getDoc(ref(own))).data()!.state;
  assert.deepEqual(saved.tasks, []);
  assert.equal(saved.events[0].taskName, "Łańcuch");
  saved.events[0].notes = "Edited after removing the task";
  await assertSucceeds(setDoc(ref(own), value(saved, 3)));
  saved.events = [];
  await assertSucceeds(setDoc(ref(own), value(saved, 4)));
  assert.deepEqual((await getDoc(ref(own))).data()!.state.events, []);
});
