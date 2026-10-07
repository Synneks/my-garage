export const STATUS = {
  overdue: { label: 'Scadent', tone: 'red', rank: 0 },
  attention: { label: 'Prioritar', tone: 'red', rank: 1 },
  watch: { label: 'De urmărit', tone: 'orange', rank: 2 },
  soon: { label: 'În curând', tone: 'orange', rank: 3 },
  unknown: { label: 'Istoric necunoscut', tone: 'gray', rank: 4 },
  planned: { label: 'Planificat', tone: 'blue', rank: 5 },
  ok: { label: 'În interval', tone: 'green', rank: 6 },
  condition: { label: 'După stare', tone: 'gray', rank: 7 },
};
export function today() {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Bucharest', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
export function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}
export function addMonths(date, months) {
  const [year, month, day] = date.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1 + months, 1, 12));
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d.toISOString().slice(0, 10);
}
export function latestEvent(state, taskId) {
  return state.events.filter(e => e.taskId === taskId && e.confirmed).sort((a, b) => b.date.localeCompare(a.date) || b.km - a.km)[0] || null;
}
export function evaluate(task, state, date = today()) {
  const override = state.overrides[task.id] || {};
  const latest = latestEvent(state, task.id);
  const intervalKm = override.intervalKm === undefined ? task.intervalKm : override.intervalKm;
  const intervalMonths = override.intervalMonths === undefined ? task.intervalMonths : override.intervalMonths;
  const seedContext = !latest || latest.id.startsWith('seed-');
  const plannedKm = Object.hasOwn(override, 'dueKm') ? override.dueKm : (seedContext ? task.plannedKm : null) ?? null;
  const plannedDate = Object.hasOwn(override, 'dueDate') ? override.dueDate || null : (seedContext ? task.plannedDate : null) || null;
  const calculatedKm = latest && intervalKm ? latest.km + intervalKm : null;
  const calculatedDate = latest && intervalMonths ? addMonths(latest.date, intervalMonths) : null;
  // A personal plan may bring work forward; it cannot hide a manufacturer deadline.
  const dueKm = [plannedKm, calculatedKm].filter(v => v !== null).reduce((a, b) => Math.min(a, b), Infinity);
  const dueDate = [plannedDate, calculatedDate].filter(Boolean).sort()[0] || null;
  const remainingKm = Number.isFinite(dueKm) ? dueKm - state.vehicle.km : null;
  const days = dueDate ? Math.round((Date.parse(`${dueDate}T12:00:00Z`) - Date.parse(`${date}T12:00:00Z`)) / 86400000) : null;
  const priority = override.priority ?? (seedContext ? task.priority : null);
  let status;
  if ((remainingKm !== null && remainingKm <= 0) || (days !== null && days <= 0)) status = 'overdue';
  else if (priority === 'attention' || priority === 'watch') status = priority;
  else if (!latest && (intervalKm || intervalMonths)) status = 'unknown';
  else if ((remainingKm !== null && remainingKm <= 1000) || (days !== null && days <= 30)) status = 'soon';
  else if (!latest && (plannedKm !== null || plannedDate)) status = 'planned';
  else if (!intervalKm && !intervalMonths) status = 'condition';
  else status = 'ok';
  return { ...task, latest, intervalKm, intervalMonths, dueKm: Number.isFinite(dueKm) ? dueKm : null, dueDate, remainingKm, days, status, notes: override.notes ?? task.notes ?? '', personal: Object.keys(override).length > 0, plannedKm, plannedDate };
}
export function validateState(state, tasks) {
  if (!state || state.version !== 1 || !state.vehicle || state.vehicle.model !== 'Suzuki GSF650S' || state.vehicle.year !== 2005 || !Number.isSafeInteger(state.vehicle.km) || state.vehicle.km < 0 || !Array.isArray(state.events) || !state.overrides || typeof state.overrides !== 'object' || Array.isArray(state.overrides)) throw new Error('Formatul carnetului nu este valid.');
  const ids = new Set();
  const taskMap = new Map(tasks.map(t => [t.id, t]));
  for (const e of state.events) {
    if (typeof e.id !== 'string' || !e.id || ids.has(e.id) || !taskMap.has(e.taskId) || e.action !== taskMap.get(e.taskId).action || !validDate(e.date) || !Number.isSafeInteger(e.km) || e.km < 0 || e.km > state.vehicle.km || typeof e.notes !== 'string' || typeof e.confirmed !== 'boolean') throw new Error('O intervenție conține date invalide sau kilometri mai mari decât bordul.');
    ids.add(e.id);
  }
  for (const [id, rule] of Object.entries(state.overrides)) {
    if (!taskMap.has(id) || !rule || typeof rule !== 'object' || Array.isArray(rule)) throw new Error('Reper necunoscut în carnet.');
    for (const field of ['intervalKm', 'intervalMonths', 'dueKm']) if (rule[field] !== undefined && rule[field] !== null && (!Number.isSafeInteger(rule[field]) || rule[field] < (field === 'dueKm' ? 0 : 1))) throw new Error('Intervalele trebuie să fie numere întregi pozitive.');
    if (rule.dueDate && !validDate(rule.dueDate)) throw new Error('Data planificată nu este validă.');
    if (rule.priority !== undefined && !['normal', 'watch', 'attention'].includes(rule.priority)) throw new Error('Prioritate invalidă.');
    if (rule.notes !== undefined && typeof rule.notes !== 'string') throw new Error('Notițe invalide.');
  }
  return state;
}
