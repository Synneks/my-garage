import { TASKS, ACTIONS } from "../data.js";
import { validateState } from "../engine.js";
import { createDemoNotebook } from "./demo-data.js";

// The original motorcycle data is retained only for legacy recovery.
// New account vehicles are empty; public examples use independent fictional data.
export function emptyNotebook(
  vehicle = { make: "", model: "", year: new Date().getFullYear(), km: 0 },
) {
  return { version: 2, vehicle, tasks: [], events: [], overrides: {} };
}
export function notebookTasks(state) {
  return state.version === 2 ? state.tasks : TASKS;
}
export function previewNotebook() {
  return createDemoNotebook();
}
export function migrateNotebook(input) {
  validateState(input, TASKS);
  const state = structuredClone(input);
  if (state.version === 2) return state;
  state.version = 2;
  state.vehicle = { ...state.vehicle, make: "Suzuki", model: "GSF650S" };
  state.tasks = TASKS.map(({ seed, ...task }) => ({
    ...task,
    action: ACTIONS[task.action],
  }));
  state.events = state.events.map((event) => ({
    ...event,
    action: ACTIONS[event.action],
    taskName: state.tasks.find((task) => task.id === event.taskId).name,
  }));
  return validateState(state);
}
export function removeTask(state, taskId) {
  const next = structuredClone(state);
  const task = next.tasks.find((task) => task.id === taskId);
  if (!task) return next;
  next.events = next.events.map((event) =>
    event.taskId === taskId
      ? { ...event, taskName: event.taskName || task.name }
      : event,
  );
  next.tasks = next.tasks.filter((task) => task.id !== taskId);
  delete next.overrides[taskId];
  return validateState(next);
}
