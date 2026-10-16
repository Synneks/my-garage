export type Action = string;
export type Status =
  | "overdue"
  | "attention"
  | "watch"
  | "soon"
  | "unknown"
  | "planned"
  | "ok"
  | "condition";
export interface ServiceEvent {
  id: string;
  taskId: string;
  taskName?: string;
  date: string;
  km: number;
  action: Action;
  notes: string;
  confirmed: boolean;
}
export interface Plan {
  intervalKm?: number | null;
  intervalMonths?: number | null;
  dueKm?: number | null;
  dueDate?: string;
  priority?: "normal" | "watch" | "attention";
  notes?: string;
}
export interface Notebook {
  version: 1 | 2;
  vehicle: Vehicle;
  tasks?: Task[];
  events: ServiceEvent[];
  overrides: Record<string, Plan>;
}
export interface LegacyNotebook extends Notebook {
  version: 1;
}
export interface GarageNotebook extends Notebook {
  version: 2;
  vehicle: Vehicle & { make: string };
  tasks: Task[];
}
export interface Vehicle {
  make?: string;
  model: string;
  year: number;
  km: number;
}
export interface Task {
  id: string;
  name: string;
  category: string;
  action: Action;
  intervalKm: number | null;
  intervalMonths: number | null;
  source: string;
  seed?: boolean;
  notes?: string;
  plannedKm?: number;
  plannedDate?: string;
  priority?: "normal" | "watch" | "attention";
}
export interface EvaluatedTask extends Omit<Task, "plannedKm" | "plannedDate"> {
  latest: ServiceEvent | null;
  dueKm: number | null;
  dueDate: string | null;
  remainingKm: number | null;
  days: number | null;
  status: Status;
  notes: string;
  personal: boolean;
  plannedKm: number | null;
  plannedDate: string | null;
}
