import type { Task, Notebook } from "./types";
export function exportCsv(state: Notebook): string;
export function importCsv(text: string, tasks: Task[]): Notebook;
export function parseCsv(input: string): string[][];
