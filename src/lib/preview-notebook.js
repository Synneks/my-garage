import { createDemoNotebook } from "./demo-data.js";

// Only the public, fictional demo is translated. Account data never enters here.
export function translatedPreviewNotebook(t) {
  const state = createDemoNotebook();
  state.vehicle.make = t("preview.vehicle_make");
  state.vehicle.model = t("preview.vehicle");
  state.tasks = state.tasks.map((task) => ({
    ...task,
    name: t(`preview.tasks.${task.id}.name`),
    notes: t(`preview.tasks.${task.id}.notes`),
    category: t(`preview.categories.${task.category}`),
    action: t(`preview.actions.${task.action}`),
  }));
  const tasks = new Map(state.tasks.map((task) => [task.id, task]));
  state.events = state.events.map((event) => {
    const task = tasks.get(event.taskId);
    return {
      ...event,
      taskName: task.name,
      action: task.action,
      notes: task.notes,
    };
  });
  return state;
}
