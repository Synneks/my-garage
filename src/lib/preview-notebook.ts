import { createDemoNotebook } from "./demo-data";
import type { TranslationKey } from "../i18n";
import type { GarageNotebook } from "../types";

// Only the public, fictional demo is translated. Account data never enters here.
export function translatedPreviewNotebook(
  t: (key: TranslationKey) => string,
): GarageNotebook {
  const state = createDemoNotebook();
  state.vehicle.make = t("preview.vehicle_make");
  state.vehicle.model = t("preview.vehicle");
  state.tasks = state.tasks.map((task) => ({
    ...task,
    name: t(`preview.tasks.${task.id}.name` as TranslationKey),
    notes: t(`preview.tasks.${task.id}.notes` as TranslationKey),
    category: t(`preview.categories.${task.category}` as TranslationKey),
    action: t(`preview.actions.${task.action}` as TranslationKey),
  }));
  const tasks = new Map(state.tasks.map((task) => [task.id, task]));
  state.events = state.events.map((event) => {
    const task = tasks.get(event.taskId)!;
    return {
      ...event,
      taskName: task.name,
      action: task.action,
      notes: task.notes ?? "",
    };
  });
  return state;
}
