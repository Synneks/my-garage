import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createInstance } from "i18next";
import { validateState } from "../src/engine";
import { previewNotebook } from "../src/lib/garage";
import { translatedPreviewNotebook } from "../src/lib/preview-notebook";

const en = JSON.parse(
  readFileSync(new URL("../src/i18n/locales/en.json", import.meta.url), "utf8"),
);
const ro = JSON.parse(
  readFileSync(new URL("../src/i18n/locales/ro.json", import.meta.url), "utf8"),
);
const i18n = createInstance();
await i18n.init({
  resources: { en: { translation: en }, ro: { translation: ro } },
  keySeparator: false,
  fallbackLng: false,
});

test("every fictional demo name, note, action and category has an explicit preview translation", () => {
  for (const catalog of [en, ro]) {
    for (const task of previewNotebook().tasks) {
      for (const field of ["name", "notes"])
        assert.ok(catalog[`preview.tasks.${task.id}.${field}`]);
      assert.ok(catalog[`preview.actions.${task.action}`]);
      assert.ok(catalog[`preview.categories.${task.category}`]);
    }
    assert.ok(catalog["preview.vehicle"]);
  }
});
test("only fresh preview copies are translated, including historical names, actions and notes", () => {
  const original = previewNotebook(),
    before = JSON.stringify(original);
  const english = translatedPreviewNotebook(i18n.getFixedT("en"));
  const romanian = translatedPreviewNotebook(i18n.getFixedT("ro"));
  assert.equal(english.tasks[0].name, "Engine oil");
  assert.equal(romanian.tasks[0].name, "Ulei motor");
  assert.equal(english.tasks[0].category, "Engine");
  assert.equal(romanian.tasks[0].action, "Schimb");
  assert.equal(english.events[0].taskName, "Engine oil");
  assert.equal(english.events[0].action, "Replacement");
  assert.equal(romanian.events[0].taskName, "Ulei motor");
  assert.equal(english.events[0].notes, "Oil and filter replaced.");
  assert.equal(
    romanian.events[0].notes,
    "Uleiul și filtrul au fost schimbate.",
  );
  assert.equal(english.vehicle.model, "Everyday car");
  assert.equal(romanian.vehicle.model, "Mașina de zi cu zi");
  assert.equal(validateState(english), english);
  assert.equal(validateState(romanian), romanian);
  assert.equal(english.tasks.length, original.tasks.length);
  assert.equal(english.events.length, original.events.length);
  assert.deepEqual(
    english.events.map(({ id, taskId, date, km, confirmed }) => ({
      id,
      taskId,
      date,
      km,
      confirmed,
    })),
    original.events.map(({ id, taskId, date, km, confirmed }) => ({
      id,
      taskId,
      date,
      km,
      confirmed,
    })),
  );
  assert.equal(JSON.stringify(original), before);
  assert.deepEqual(previewNotebook(), original);
});
