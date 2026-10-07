import test from "node:test";
import assert from "node:assert/strict";
import { TASKS } from "../src/data.js";
import { evaluate, validateState } from "../src/engine.js";
import { exportCsv, importCsv } from "../src/csv.js";
import { mockNotebook } from "../scripts/mock-data.mjs";
const date = "2026-10-07";
test("synthetic fixture covers overdue, soon, custom intervals, unconfirmed history and plans", () => {
  const state = mockNotebook("realistic", date);
  const at = (id) =>
    evaluate(
      TASKS.find((task) => task.id === id),
      state,
      date,
    );
  assert.equal(at("oil").status, "overdue");
  assert.equal(at("chain-lube").status, "soon");
  assert.equal(at("air-replace").intervalKm, 9000);
  assert.equal(at("valves").latest, null);
  assert.equal(at("tires-replace").plannedKm, 45000);
  assert.deepEqual(importCsv(exportCsv(state), TASKS), state);
});
test("empty mock history stays empty and fixtures share the production schema", () => {
  const state = mockNotebook("empty", date);
  assert.equal(state.events.length, 0);
  assert.deepEqual(state.overrides, {});
  assert.deepEqual(validateState(state, TASKS), state);
  assert.throws(() => mockNotebook("production"), /Scenario/);
});
