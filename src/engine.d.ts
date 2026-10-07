import type {
  Task,
  Notebook,
  ServiceEvent,
  Status,
  EvaluatedTask,
} from "./types";
export const STATUS: Record<
  Status,
  { label: string; tone: string; rank: number }
>;
export function today(): string;
export function validDate(value: string): boolean;
export function addMonths(date: string, months: number): string;
export function latestEvent(
  state: Notebook,
  taskId: string,
): ServiceEvent | null;
export function evaluate(
  task: Task,
  state: Notebook,
  date?: string,
): EvaluatedTask;
export function validateState(state: unknown, tasks: Task[]): Notebook;
