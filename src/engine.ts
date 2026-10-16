import { AppError } from "./lib/app-error";
import type {
  EvaluatedTask,
  Notebook,
  ServiceEvent,
  Status,
  Task,
} from "./types";
export const STATUS = {
  overdue: { label: "Scadent", tone: "danger", rank: 0 },
  attention: { label: "Prioritar", tone: "danger", rank: 1 },
  watch: { label: "De urmărit", tone: "warning", rank: 2 },
  soon: { label: "În curând", tone: "warning", rank: 3 },
  unknown: { label: "Istoric necunoscut", tone: "muted", rank: 4 },
  planned: { label: "Planificat", tone: "info", rank: 5 },
  ok: { label: "În interval", tone: "success", rank: 6 },
  condition: { label: "După stare", tone: "muted", rank: 7 },
} as const;
export function today() {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Bucharest",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
export function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const d = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}
export function addMonths(date: string, months: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1 + months, 1, 12));
  const last = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
  ).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d.toISOString().slice(0, 10);
}
export function latestEvent(
  state: Notebook,
  taskId: string,
): ServiceEvent | null {
  return (
    state.events
      .filter((e) => e.taskId === taskId && e.confirmed)
      .sort((a, b) => b.date.localeCompare(a.date) || b.km - a.km)[0] || null
  );
}
export function evaluate(
  task: Task,
  state: Notebook,
  date = today(),
): EvaluatedTask {
  const override = state.overrides[task.id] || {};
  const latest = latestEvent(state, task.id);
  const intervalKm =
    override.intervalKm === undefined ? task.intervalKm : override.intervalKm;
  const intervalMonths =
    override.intervalMonths === undefined
      ? task.intervalMonths
      : override.intervalMonths;
  const seedContext = !latest || latest.id.startsWith("seed-");
  const plannedKm = Object.hasOwn(override, "dueKm")
    ? (override.dueKm ?? null)
    : ((seedContext ? task.plannedKm : null) ?? null);
  const plannedDate = Object.hasOwn(override, "dueDate")
    ? override.dueDate || null
    : (seedContext ? task.plannedDate : null) || null;
  const calculatedKm = latest && intervalKm ? latest.km + intervalKm : null;
  const calculatedDate =
    latest && intervalMonths ? addMonths(latest.date, intervalMonths) : null;
  // A personal plan may bring work forward; it cannot hide a manufacturer deadline.
  const dueKm = [plannedKm, calculatedKm]
    .filter((v) => v !== null)
    .reduce((a, b) => Math.min(a, b), Infinity);
  const dueDate =
    [plannedDate, calculatedDate].filter(Boolean).sort()[0] || null;
  const remainingKm = Number.isFinite(dueKm) ? dueKm - state.vehicle.km : null;
  const days = dueDate
    ? Math.round(
        (Date.parse(`${dueDate}T12:00:00Z`) - Date.parse(`${date}T12:00:00Z`)) /
          86400000,
      )
    : null;
  const priority = override.priority ?? (seedContext ? task.priority : null);
  let status: Status;
  if (
    (remainingKm !== null && remainingKm <= 0) ||
    (days !== null && days <= 0)
  )
    status = "overdue";
  else if (priority === "attention" || priority === "watch") status = priority;
  else if (!latest && (intervalKm || intervalMonths)) status = "unknown";
  else if (
    (remainingKm !== null && remainingKm <= 1000) ||
    (days !== null && days <= 30)
  )
    status = "soon";
  else if (!latest && (plannedKm !== null || plannedDate)) status = "planned";
  else if (!intervalKm && !intervalMonths) status = "condition";
  else status = "ok";
  return {
    ...task,
    latest,
    intervalKm,
    intervalMonths,
    dueKm: Number.isFinite(dueKm) ? dueKm : null,
    dueDate,
    remainingKm,
    days,
    status,
    notes: override.notes ?? task.notes ?? "",
    personal: Object.keys(override).length > 0,
    plannedKm,
    plannedDate,
  };
}
export function validateState<T extends Notebook>(
  state: T,
  tasks?: readonly Task[],
): T;
export function validateState(
  state: unknown,
  tasks?: readonly Task[],
): Notebook;
export function validateState(
  input: unknown,
  tasks: readonly Task[] = [],
): Notebook {
  // Treat external data as a notebook only inside this runtime validator.
  // Every required field is checked below before the value is returned.
  const state = input as Notebook;
  if (
    !state ||
    ![1, 2].includes(state.version) ||
    !state.vehicle ||
    !Number.isSafeInteger(state.vehicle.km) ||
    state.vehicle.km < 0 ||
    !Array.isArray(state.events) ||
    !state.overrides ||
    typeof state.overrides !== "object" ||
    Array.isArray(state.overrides)
  )
    throw new AppError("errors.invalid_notebook");
  if (
    state.version === 1 &&
    (state.vehicle.model !== "Suzuki GSF650S" || state.vehicle.year !== 2005)
  )
    throw new AppError("errors.invalid_notebook");
  const text = (
    value: unknown,
    max: number,
    required = false,
  ): value is string =>
    typeof value === "string" &&
    value.length <= max &&
    (!required || value.trim().length > 0);
  const number = (value: unknown, minimum: number): value is number =>
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= minimum;
  if (state.version === 2) {
    if (
      !text(state.vehicle.make, 100, true) ||
      !text(state.vehicle.model, 200, true) ||
      !number(state.vehicle.year, 1886) ||
      state.vehicle.year > 2200 ||
      !Array.isArray(state.tasks) ||
      state.tasks.length > 1000 ||
      state.events.length > 5000
    )
      throw new AppError("errors.invalid_notebook");
    tasks = state.tasks;
    const taskIds = new Set();
    for (const task of tasks) {
      if (
        !task ||
        !text(task.id, 200, true) ||
        taskIds.has(task.id) ||
        !text(task.name, 200, true) ||
        !text(task.category, 100) ||
        !text(task.action, 100, true) ||
        !text(task.source, 1000) ||
        (task.notes !== undefined && !text(task.notes, 10000))
      )
        throw new AppError("errors.invalid_task");
      taskIds.add(task.id);
      for (const field of ["intervalKm", "intervalMonths"] as const)
        if (task[field] !== null && !number(task[field], 1))
          throw new AppError("errors.invalid_interval");
      if (task.plannedKm !== undefined && !number(task.plannedKm, 0))
        throw new AppError("errors.invalid_interval");
      if (task.plannedDate !== undefined && !validDate(task.plannedDate))
        throw new AppError("errors.invalid_date");
      if (
        task.priority !== undefined &&
        !["normal", "watch", "attention"].includes(task.priority)
      )
        throw new AppError("errors.invalid_priority");
    }
  }
  const ids = new Set();
  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  for (const e of state.events) {
    const validTask =
      state.version === 1
        ? taskMap.has(e.taskId) && e.action === taskMap.get(e.taskId)!.action
        : text(e.taskId, 200, true) &&
          text(e.taskName, 200, true) &&
          text(e.action, 100, true);
    if (
      !text(e.id, 200, true) ||
      ids.has(e.id) ||
      !validTask ||
      !validDate(e.date) ||
      !Number.isSafeInteger(e.km) ||
      e.km < 0 ||
      e.km > state.vehicle.km ||
      !text(e.notes, 10000) ||
      typeof e.confirmed !== "boolean"
    )
      throw new AppError("errors.invalid_event");
    ids.add(e.id);
  }
  for (const [id, rule] of Object.entries(state.overrides)) {
    if (
      !taskMap.has(id) ||
      !rule ||
      typeof rule !== "object" ||
      Array.isArray(rule)
    )
      throw new AppError("errors.unknown_task");
    for (const field of ["intervalKm", "intervalMonths", "dueKm"] as const)
      if (
        rule[field] !== undefined &&
        rule[field] !== null &&
        (!Number.isSafeInteger(rule[field]) ||
          rule[field] < (field === "dueKm" ? 0 : 1))
      )
        throw new AppError("errors.invalid_interval");
    if (rule.dueDate && !validDate(rule.dueDate))
      throw new AppError("errors.invalid_date");
    if (
      rule.priority !== undefined &&
      !["normal", "watch", "attention"].includes(rule.priority)
    )
      throw new AppError("errors.invalid_priority");
    if (rule.notes !== undefined && typeof rule.notes !== "string")
      throw new AppError("errors.invalid_notes");
  }
  return state;
}
