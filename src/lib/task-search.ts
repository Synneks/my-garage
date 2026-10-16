import type { Task } from "@/types";

export function searchTask(
  task: Pick<Task, "name" | "category" | "action">,
  query: string,
  notes: string,
) {
  const normalize = (value: string) =>
    value.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase();
  return normalize(
    [task.name, task.category, task.action, notes].join(" "),
  ).includes(normalize(query));
}
