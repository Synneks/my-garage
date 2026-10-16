import type { Notebook, Task, Vehicle } from "../types";
export function emptyNotebook(vehicle?: Vehicle): Notebook;
export function previewNotebook(): Notebook;
export function notebookTasks(state: Notebook): Task[];
export function migrateNotebook(input: Notebook): Notebook;
export function removeTask(state: Notebook, taskId: string): Notebook;
