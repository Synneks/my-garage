import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createInstance } from "i18next";
import { TASKS, createInitialState } from "../src/data.js";
import { validateState } from "../src/engine.js";
import { importCsv } from "../src/csv.js";
import { NotebookConflict } from "../src/lib/notebook-transaction.js";
import {
  detectLanguage,
  languageKey,
  readLanguage,
  cacheLanguage,
} from "../src/i18n/language.js";
const en = JSON.parse(
  readFileSync(new URL("../src/i18n/locales/en.json", import.meta.url)),
);
const ro = JSON.parse(
  readFileSync(new URL("../src/i18n/locales/ro.json", import.meta.url)),
);
const baseKeys = (catalog) =>
  [
    ...new Set(
      Object.keys(catalog).map((key) => key.replace(/_(one|few|other)$/, "")),
    ),
  ].sort();
const parameters = (text) =>
  [
    ...new Set(
      [...text.matchAll(/{{(\w+)(?:,[^}]+)?}}/g)].map((match) => match[1]),
    ),
  ].sort();

test("catalogs have matching messages, interpolation parameters and required plural forms", () => {
  assert.deepEqual(baseKeys(en), baseKeys(ro));
  for (const [key, english] of Object.entries(en)) {
    assert.equal(typeof ro[key], "string", key);
    assert.ok(english.trim() && ro[key].trim(), key);
    assert.deepEqual(parameters(english), parameters(ro[key]), key);
    if (key.endsWith("_other"))
      assert.equal(typeof ro[key.replace(/_other$/, "_few")], "string");
  }
});
test("every maintenance name, source, default note, category, action and status is translated", () => {
  for (const catalog of [en, ro]) {
    for (const task of TASKS) {
      for (const field of ["name", "source", ...(task.notes ? ["notes"] : [])])
        assert.ok(catalog[`tasks.${task.id}.${field}`]);
      assert.ok(catalog[`actions.${task.action}`]);
    }
    for (const category of [
      "engine",
      "fuel",
      "transmission",
      "brakes",
      "chassis",
      "electrical",
    ])
      assert.ok(catalog[`categories.${category}`]);
    for (const status of [
      "overdue",
      "attention",
      "watch",
      "soon",
      "unknown",
      "planned",
      "ok",
      "condition",
    ])
      assert.ok(catalog[`statuses.${status}`]);
  }
});
test("browser selection recognizes regional variants and ordered preferences", () => {
  assert.equal(detectLanguage(["fr-FR", "ro-RO", "en-US"]), "ro");
  assert.equal(detectLanguage(["en-US", "ro"]), "en");
  assert.equal(detectLanguage(["RO-md"]), "ro");
  assert.equal(detectLanguage(["de-DE"]), "en");
});
test("explicit choices override browser defaults and guest/account caches remain separate", () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key),
    setItem: (key, value) => values.set(key, value),
  };
  cacheLanguage(storage, "en");
  cacheLanguage(storage, "ro", "alice");
  assert.equal(readLanguage(storage, ["ro"]), "en");
  assert.equal(readLanguage(storage, ["en"], "alice"), "ro");
  assert.notEqual(languageKey("alice"), languageKey("bob"));
  values.set(languageKey(), "fr");
  assert.equal(readLanguage(storage, ["ro"]), "ro");
});
test("unavailable browser storage does not stop language selection", () => {
  const storage = {
    getItem() {
      throw Error("blocked");
    },
    setItem() {
      throw Error("blocked");
    },
  };
  assert.equal(readLanguage(storage, ["ro"]), "ro");
  assert.doesNotThrow(() => cacheLanguage(storage, "en"));
});
test("English and Romanian plural categories render correctly without falling back", async () => {
  const translator = createInstance();
  await translator.init({
    resources: { en: { translation: en }, ro: { translation: ro } },
    keySeparator: false,
    fallbackLng: false,
  });
  for (const language of ["en", "ro"]) {
    await translator.changeLanguage(language);
    for (const count of [0, 1, 2, 19, 20, 101]) {
      const form = new Intl.PluralRules(language).select(count);
      const catalog = language === "en" ? en : ro;
      assert.equal(
        translator.t("format.days", { count }),
        catalog[`format.days_${form}`].replace(
          "{{count, number}}",
          new Intl.NumberFormat(language).format(count),
        ),
      );
    }
  }
});
test("domain and CSV errors carry translatable codes", () => {
  assert.throws(
    () => validateState(null, TASKS),
    (error) => error.code === "errors.invalid_notebook",
  );
  assert.throws(
    () => importCsv("wrong,columns", TASKS),
    (error) => error.code === "errors.csv_headers",
  );
  assert.equal(new NotebookConflict().code, "errors.conflict");
  assert.equal(createInitialState().version, 1);
});
