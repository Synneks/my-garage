import { validateState } from './engine.js';
const HEADERS = ['record_type', 'id', 'task_id', 'date', 'km', 'action', 'notes', 'confirmed', 'interval_km', 'interval_months', 'due_km', 'due_date', 'priority'];
function cell(value) {
  let s = value === null || value === undefined ? '' : String(value);
  // Avoid spreadsheet formula execution; reversible on our own import.
  if (/^[=+@\-\t\r]/.test(s) || s.startsWith("'")) s = `'${s}`;
  return `"${s.replaceAll('"', '""')}"`;
}
export function exportCsv(state) {
  const rows = [HEADERS, ['vehicle', 'vehicle', '', '', state.vehicle.km, '', state.vehicle.model, '', '', '', '', '', state.vehicle.year]];
  for (const e of state.events) rows.push(['event', e.id, e.taskId, e.date, e.km, e.action, e.notes, e.confirmed]);
  for (const [id, r] of Object.entries(state.overrides)) rows.push(['rule', id, id, '', '', '', r.notes, Object.hasOwn(r, 'notes'), r.intervalKm, r.intervalMonths, r.dueKm, r.dueDate, r.priority]);
  // Explicit null disables an interval, while an empty field means use Suzuki's default.
  for (const row of rows.filter(r => r[0] === 'rule')) {
    const rule = state.overrides[row[1]];
    for (const [index, key] of [[8, 'intervalKm'], [9, 'intervalMonths'], [10, 'dueKm']]) if (rule[key] === null) row[index] = 'none';
    if (Object.hasOwn(rule, 'dueDate') && !rule.dueDate) row[11] = 'none';
  }
  return '\uFEFF' + rows.map(r => HEADERS.map((_, i) => cell(r[i])).join(',')).join('\r\n');
}
export function parseCsv(input) {
  const text = input.replace(/^\uFEFF/, '');
  const rows = [];
  let row = [], value = '', quoted = false, closed = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { value += '"'; i++; }
      else if (c === '"') { quoted = false; closed = true; }
      else value += c;
    } else if (c === '"' && !value && !closed) quoted = true;
    else if (c === ',') { row.push(value); value = ''; closed = false; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(value); if (row.some(Boolean)) rows.push(row);
      row = []; value = ''; closed = false;
    } else {
      if (closed || c === '"') throw new Error('CSV invalid: ghilimele plasate incorect.');
      value += c;
    }
  }
  if (quoted) throw new Error('CSV invalid: ghilimele neînchise.');
  row.push(value); if (row.some(Boolean)) rows.push(row);
  return rows;
}
export function importCsv(text, tasks) {
  const [header, ...rows] = parseCsv(text);
  if (!header || header.join(',') !== HEADERS.join(',')) throw new Error('Folosește un CSV exportat din acest carnet. Coloanele nu corespund.');
  const result = { version: 1, vehicle: null, events: [], overrides: {} };
  const decode = s => s.startsWith("'") && (/^[=+@\-\t\r]/.test(s.slice(1)) || s.slice(1).startsWith("'")) ? s.slice(1) : s;
  const number = s => { if (!/^\d+$/.test(s)) throw new Error('Valoare numerică invalidă în CSV.'); return Number(s); };
  for (const cells of rows) {
    if (cells.length !== HEADERS.length) throw new Error('CSV invalid: număr incorect de coloane.');
    const r = Object.fromEntries(header.map((key, i) => [key, decode(cells[i])]));
    if (r.record_type === 'vehicle') {
      if (result.vehicle) throw new Error('CSV conține mai multe motociclete.');
      result.vehicle = { model: r.notes, year: number(r.priority), km: number(r.km) };
    } else if (r.record_type === 'event') {
      if (!['true', 'false'].includes(r.confirmed)) throw new Error('Confirmare invalidă în CSV.');
      result.events.push({ id: r.id, taskId: r.task_id, date: r.date, km: number(r.km), action: r.action, notes: r.notes, confirmed: r.confirmed === 'true' });
    } else if (r.record_type === 'rule') {
      if (result.overrides[r.task_id]) throw new Error('CSV conține repere duplicate.');
      const rule = {};
      for (const [csv, key] of [['interval_km', 'intervalKm'], ['interval_months', 'intervalMonths'], ['due_km', 'dueKm']]) if (r[csv] !== '') rule[key] = r[csv] === 'none' ? null : number(r[csv]);
      if (r.due_date) rule.dueDate = r.due_date === 'none' ? '' : r.due_date;
      if (r.priority) rule.priority = r.priority;
      // Empty notes are meaningful: preserve clearing of a default note.
      if (r.confirmed === 'true') rule.notes = r.notes;
      result.overrides[r.task_id] = rule;
    } else throw new Error('Tip de înregistrare necunoscut în CSV.');
  }
  return validateState(result, tasks);
}
