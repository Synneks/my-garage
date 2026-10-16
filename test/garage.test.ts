import test from "node:test";
import assert from "node:assert/strict";
import { createInitialState, TASKS } from "../src/data";
import {
  emptyNotebook,
  migrateNotebook,
  previewNotebook,
  removeTask,
} from "../src/lib/garage";
import { evaluate, validateState } from "../src/engine";
import { exportCsv, importCsv } from "../src/csv";
import type { Task } from "../src/types";

const vehicle = { make: "Honda", model: "CB500", year: 2020, km: 12000 };
const task = (): Task => ({
  id: "custom",
  name: "Łańcuch i zębatki",
  category: "Napęd",
  action: "Wymiana",
  intervalKm: 5000,
  intervalMonths: 12,
  source: "",
  notes: "Moje notatki",
});
const notebook = () => ({ ...emptyNotebook({ ...vehicle }), tasks: [task()] });
const event = () => ({
  id: "event",
  taskId: "custom",
  taskName: "Łańcuch i zębatki",
  date: "2026-01-01",
  km: 10000,
  action: "Wymiana",
  notes: "",
  confirmed: true,
});

test("new vehicles contain no preset maintenance or history, and share no mutable state", () => {
  const first = emptyNotebook({ ...vehicle }),
    second = emptyNotebook({ ...vehicle, make: "Yamaha" });
  first.tasks.push(task());
  first.events.push(event());
  assert.deepEqual(second.tasks, []);
  assert.deepEqual(second.events, []);
  assert.equal(validateState(first), first);
});

test("the guest preview is fictional, valid and independent of legacy account seeds", () => {
  const first = previewNotebook(),
    second = previewNotebook();
  const original = structuredClone(first);
  assert.notDeepEqual(first, migrateNotebook(createInitialState()));
  assert.equal(validateState(first), first);
  assert.equal(first.vehicle.model, "Everyday car");
  assert.equal(first.vehicle.km, 24500);
  assert.ok(first.tasks.every((task) => task.id.startsWith("demo-")));
  assert.ok(first.events.every((event) => event.id.startsWith("demo-record-")));
  first.tasks[0].name = "Changed preview";
  first.events[0].notes = "Changed preview";
  assert.deepEqual(second, original);
});
test("legacy migration preserves history, plans and names, and is idempotent", () => {
  const old = createInitialState();
  old.overrides.oil = { intervalKm: 3000, notes: "" };
  const before = JSON.stringify(old);
  const migrated = migrateNotebook(old);
  assert.equal(migrated.version, 2);
  assert.equal(migrated.tasks.length, TASKS.length);
  assert.deepEqual(migrated.overrides, old.overrides);
  for (const record of migrated.events) {
    const previous = old.events.find((item) => item.id === record.id);
    assert.ok(previous);
    assert.deepEqual(
      { ...record, action: previous.action, taskName: undefined },
      { ...previous, taskName: undefined },
    );
    assert.equal(
      record.taskName,
      TASKS.find((task) => task.id === record.taskId)!.name,
    );
  }
  assert.equal(JSON.stringify(old), before);
  assert.deepEqual(migrateNotebook(migrated), migrated);
});
test("custom tasks and actions validate, and deadlines use only that vehicle history", () => {
  const first = notebook();
  first.events.push(event());
  const second = notebook();
  second.vehicle.km = 90000;
  assert.equal(
    evaluate(first.tasks[0], validateState(first), "2026-02-01").dueKm,
    15000,
  );
  assert.equal(
    evaluate(second.tasks[0], validateState(second), "2026-02-01").dueKm,
    null,
  );
});
test("editing task names/actions does not rewrite or invalidate historical snapshots", () => {
  const state = notebook();
  state.events.push(event());
  state.tasks[0].name = "New task name";
  state.tasks[0].action = "Custom action";
  validateState(state);
  assert.equal(state.events[0].taskName, "Łańcuch i zębatki");
  assert.equal(state.events[0].action, "Wymiana");
});
test("deleting a task keeps history editable and individually deletable", () => {
  const state = notebook();
  state.events.push(event());
  state.overrides.custom = { dueKm: 13000 };
  const next = removeTask(state, "custom");
  assert.deepEqual(next.tasks, []);
  assert.deepEqual(next.overrides, {});
  assert.deepEqual(next.events, state.events);
  next.events[0].taskName = "Edited historical name";
  next.events[0].notes = "Edited";
  validateState(next);
  next.events = [];
  validateState(next);
  assert.equal(state.tasks.length, 1);
});
test("new CSV backups include arbitrary vehicle details, tasks, rules and retained history", () => {
  const state = notebook();
  state.tasks[0].notes = '=SUM(A1:A2), "Łańcuch"\n日本語';
  state.events.push(event());
  state.overrides.custom = {
    intervalKm: null,
    dueKm: null,
    dueDate: "",
    notes: "",
  };
  assert.deepEqual(importCsv(exportCsv(state)), state);
  const deleted = removeTask(state, "custom");
  assert.deepEqual(importCsv(exportCsv(deleted)), deleted);
  assert.deepEqual(
    importCsv(exportCsv(migrateNotebook(createInitialState()))),
    migrateNotebook(createInitialState()),
  );
});
test("validation rejects duplicate tasks, malformed custom data, and nameless retained records", () => {
  const state = notebook();
  state.tasks.push(task());
  assert.throws(() => validateState(state));
  for (const change of [
    (s: ReturnType<typeof notebook>) => (s.tasks[0].action = ""),
    (s: ReturnType<typeof notebook>) => (s.tasks[0].intervalKm = 0),
    (s: ReturnType<typeof notebook>) => (s.vehicle.make = ""),
    (s: ReturnType<typeof notebook>) => (s.vehicle.year = 1),
    (s: ReturnType<typeof notebook>) => (s.tasks[0].plannedDate = "bad"),
  ]) {
    const invalid = notebook();
    change(invalid);
    assert.throws(() => validateState(invalid));
  }
  const missing = notebook();
  missing.events.push({ ...event(), taskName: "" });
  assert.throws(() => validateState(missing));
});
