import type { Task, Notebook, Action } from "./types";
export const TASKS: Task[];
export const ACTIONS: Record<Action, string>;
export const MANUAL_URL: string;
export const TEXT_MANUAL_URL: string;
export function createInitialState(): Notebook;
