import { TASKS, ACTIONS } from "../data";
import { validateState } from "../engine";
import { createDemoNotebook } from "./demo-data";
import type { GarageNotebook, Notebook, Task } from "../types";

// The original motorcycle data is retained only for legacy recovery.
// New account vehicles are empty; public examples use independent fictional data.
export function emptyNotebook(
  vehicle: GarageNotebook["vehicle"] = {
    make: "",
    model: "",
    year: new Date().getFullYear(),
    km: 0,
  },
): GarageNotebook {
  return { version: 2, vehicle, tasks: [], events: [], overrides: {} };
}
export function notebookTasks(state: Notebook): Task[] {
  return state.version === 2 ? state.tasks! : TASKS;
}
export function previewNotebook() {
  return createDemoNotebook();
}
export function migrateNotebook(input: unknown): GarageNotebook {
  const state = structuredClone(validateState(input, TASKS));
  if (state.version === 2) return state as GarageNotebook;
  const tasks = TASKS.map(({ seed, ...task }) => ({
    ...task,
    action: ACTIONS[task.action],
  }));
  const migrated: GarageNotebook = {
    ...state,
    version: 2,
    vehicle: { ...state.vehicle, make: "Suzuki", model: "GSF650S" },
    tasks,
    events: state.events.map((event) => ({
      ...event,
      action: ACTIONS[event.action],
      taskName: tasks.find((task) => task.id === event.taskId)!.name,
    })),
  };
  return validateState(migrated);
}
export function removeTask<T extends Notebook>(state: T, taskId: string): T {
  const next = structuredClone(state);
  const task = next.tasks?.find((task) => task.id === taskId);
  if (!task) return next;
  next.events = next.events.map((event) =>
    event.taskId === taskId
      ? { ...event, taskName: event.taskName || task.name }
      : event,
  );
  next.tasks = next.tasks!.filter((task) => task.id !== taskId);
  delete next.overrides[taskId];
  return validateState(next);
}
