import type { TFunction } from "i18next";
import type { Task, EvaluatedTask } from "@/types";
import type { TranslationKey } from "@/i18n";
import { i18n } from "@/i18n";

export const categoryIds = {
  Motor: "engine",
  Alimentare: "fuel",
  Transmisie: "transmission",
  Frâne: "brakes",
  Șasiu: "chassis",
  Electric: "electrical",
} as const;
export function taskLabel(
  t: TFunction,
  taskId: string,
  field: "name" | "source" | "notes" = "name",
) {
  return t(`tasks.${taskId}.${field}` as TranslationKey);
}
export function categoryId(category: string) {
  return categoryIds[category as keyof typeof categoryIds];
}
export function categoryLabel(t: TFunction, category: string) {
  return t(`categories.${categoryId(category)}`);
}
export function taskNotes(
  t: TFunction,
  task: EvaluatedTask,
  state?: { overrides: Record<string, { notes?: string }> },
) {
  // Personal notes, including deliberately empty ones, always stay as entered.
  if (state && Object.hasOwn(state.overrides[task.id] ?? {}, "notes"))
    return task.notes;
  return task.notes ? taskLabel(t, task.id, "notes") : "";
}
export function localizedTask(
  t: TFunction,
  task: EvaluatedTask,
  hasPersonalNotes: boolean,
): EvaluatedTask {
  return {
    ...task,
    name: taskLabel(t, task.id),
    source: taskLabel(t, task.id, "source"),
    notes: hasPersonalNotes ? task.notes : taskNotes(t, task),
  };
}
export function searchTask(
  t: TFunction,
  task: Task,
  query: string,
  displayedNotes: string,
) {
  const text = [
    taskLabel(t, task.id),
    task.name,
    displayedNotes,
    task.notes ?? "",
    t(`actions.${task.action}`),
  ];
  for (const language of ["en", "ro"]) {
    const translate = i18n.getFixedT(language);
    text.push(
      taskLabel(translate, task.id),
      translate(`actions.${task.action}`),
    );
  }
  const normalized = (value: string) =>
    value.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase();
  return normalized(text.join(" ")).includes(normalized(query));
}
