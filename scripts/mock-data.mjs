import { TASKS } from "../src/data.js";
import { validateState, addMonths, today } from "../src/engine.js";
import { exportCsv } from "../src/csv.js";
import { mkdir, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
export function mockNotebook(scenario = "realistic", date = today()) {
  if (!["realistic", "empty"].includes(scenario))
    throw new Error("Scenario must be realistic or empty.");
  const state = {
    version: 1,
    vehicle: { model: "Suzuki GSF650S", year: 2005, km: 42000 },
    events: [],
    overrides: {},
  };
  if (scenario === "realistic") {
    const event = (taskId, km, months, confirmed = true) => ({
      id: `mock-${taskId}`,
      taskId,
      km,
      date: addMonths(date, -months),
      action: TASKS.find((task) => task.id === taskId).action,
      notes: "Date fictive pentru testare.",
      confirmed,
    });
    state.events = [
      event("oil", 35000, 13),
      event("chain-lube", 41400, 0),
      event("spark-replace", 41000, 1),
      event("air-replace", 40500, 2),
      event("valves", 39000, 3, false),
      event("fluid-front-replace", 40000, 25),
    ];
    state.overrides = {
      "air-replace": {
        intervalKm: 9000,
        intervalMonths: 18,
        notes: "Interval fictiv personalizat.",
      },
      "tires-replace": {
        dueKm: 45000,
        dueDate: addMonths(date, 2),
        priority: "attention",
        notes: "Plan fictiv.",
      },
      "chain-kit": { dueKm: 47000, priority: "normal" },
    };
  }
  return validateState(state, TASKS);
}
export async function writeMockCsv() {
  await mkdir(".runtime/fixtures", { recursive: true });
  for (const scenario of ["realistic", "empty"])
    await writeFile(
      `.runtime/fixtures/${scenario}.csv`,
      exportCsv(mockNotebook(scenario)),
      "utf8",
    );
  console.log(
    "Synthetic CSV fixtures: .runtime/fixtures/realistic.csv and empty.csv",
  );
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await writeMockCsv();
