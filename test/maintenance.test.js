import test from 'node:test';
import assert from 'node:assert/strict';
import { TASKS, createInitialState } from '../src/data.js';
import { evaluate, addMonths, validateState, validDate } from '../src/engine.js';
import { exportCsv, importCsv, parseCsv } from '../src/csv.js';
const task = id => TASKS.find(t => t.id === id);
const at = (id, state = createInitialState(), date = '2026-10-05') => evaluate(task(id), state, date);
test('initial oil and chain deadlines use the actual odometer', () => {
  assert.equal(at('oil').dueKm, 36137);
  assert.equal(at('oil').dueDate, '2027-09-10');
  assert.equal(at('chain-lube').remainingKm, 217);
  assert.equal(at('chain-lube').status, 'soon');
});
test('oil filter includes the 36-month deadline', () => {
  assert.equal(at('oil-filter').dueKm, 48137);
  assert.equal(at('oil-filter').dueDate, '2029-09-10');
});
test('kilometres or time, whichever comes first, including the boundary', () => {
  const state = createInitialState(); state.vehicle.km = 36137;
  assert.equal(at('oil', state).status, 'overdue');
  assert.equal(at('oil', createInitialState(), '2027-09-10').status, 'overdue');
});
test('unknown valve history is not a completed service', () => {
  const result = at('valves');
  assert.equal(result.latest, null);
  assert.equal(result.dueKm, 36000);
  assert.equal(result.dueDate, null);
  assert.equal(result.status, 'unknown');
});
test('checking spark plugs never resets their replacement', () => {
  const state = createInitialState(); state.vehicle.km = 36000;
  state.events.push({id:'new-check',taskId:'spark-check',km:36000,date:'2026-10-05',action:'inspect',notes:'OK',confirmed:true});
  assert.equal(at('spark-check',state).dueKm,42000);
  assert.equal(at('spark-replace',state).dueKm,42137);
});
test('unconfirmed history does not reset intervals', () => {
  const state = createInitialState();
  state.events.push({id:'uncertain',taskId:'valves',km:24000,date:'2025-01-01',action:'inspect',notes:'Probabil',confirmed:false});
  assert.equal(at('valves',state).status,'unknown');
});
test('backdated records do not override the latest service', () => {
  const state = createInitialState();
  state.events.push({id:'old',taskId:'oil',km:20000,date:'2025-01-01',action:'replace',notes:'',confirmed:true});
  assert.equal(at('oil',state).dueKm,36137);
});
test('personal plan can advance but cannot postpone a calculated deadline', () => {
  const state = createInitialState(); state.overrides.oil = {dueKm:50000,dueDate:'2030-01-01'};
  assert.equal(at('oil',state).dueKm,36137);
  assert.equal(at('oil',state).dueDate,'2027-09-10');
  state.overrides.oil.dueKm=32000;
  assert.equal(at('oil',state).dueKm,32000);
});
test('initial plans can be explicitly cleared', () => {
  const state=createInitialState(); state.overrides.valves={dueKm:null,dueDate:''};
  assert.equal(at('valves',state).dueKm,null);
  assert.equal(at('valves',state).status,'unknown');
});
test('condition-based replacements do not invent a Suzuki mileage', () => {
  assert.equal(at('tires-replace').intervalKm,null);
  assert.equal(at('chain-kit').intervalKm,null);
  assert.equal(at('wheel-bearings').status,'condition');
});
test('brake fluid has a calendar replacement deadline',()=> {
  assert.equal(at('fluid-front-replace').dueKm,null);
  assert.equal(at('fluid-front-replace').dueDate,'2028-09-10');
  assert.equal(at('hoses-replace').dueDate,null);
});
test('calendar arithmetic clamps end-of-month and respects leap years',()=> {
  assert.equal(addMonths('2024-01-31',1),'2024-02-29');
  assert.equal(addMonths('2024-02-29',12),'2025-02-28');
  assert.equal(validDate('2026-02-30'),false);
});
test('CSV backup restores the complete initial notebook',()=> {
  const state=createInitialState();
  assert.deepEqual(importCsv(exportCsv(state),TASKS),state);
});
test('CSV round trip preserves quotes, Unicode, commas, newlines and formula protection',()=> {
  const state=createInitialState();
  state.events[0].notes='=SUM(A1:A2), „oil”\n"service" – café';
  state.events[1].notes="'literal note";
  const csv=exportCsv(state);
  assert.ok(csv.includes("'=SUM"));
  assert.deepEqual(importCsv(csv,TASKS),state);
});
test('CSV preserves unset notes, deliberately empty notes, disabled intervals and cleared plans',()=> {
  const state=createInitialState();
  state.overrides.oil={intervalKm:3000,intervalMonths:null,dueKm:null,dueDate:'',priority:'normal'};
  state.overrides.valves={notes:''};
  assert.deepEqual(importCsv(exportCsv(state),TASKS),state);
});
test('CSV rejects missing vehicle, wrong columns, duplicate IDs and unknown tasks',()=> {
  const csv=exportCsv(createInitialState());
  assert.throws(()=>importCsv('foo,bar\n1,2',TASKS));
  assert.throws(()=>importCsv(csv.split('\r\n').filter(r=>!r.startsWith('"vehicle"')).join('\r\n'),TASKS));
  assert.throws(()=>importCsv(csv.replace('"oil","2026','"nonsense","2026'),TASKS));
  const state=createInitialState();state.events.push({...state.events[0]});
  assert.throws(()=>validateState(state,TASKS));
});
test('CSV parser rejects unterminated quoted values',()=> {
  assert.throws(()=>parseCsv('a,b\n"unfinished,2'));
  assert.throws(()=>parseCsv('a,b\n"closed"x,2'));
});
test('validation prevents fractional, negative and invalid imported data',()=> {
  for(const value of [-1,1.5,NaN]) { const state=createInitialState();state.vehicle.km=value;assert.throws(()=>validateState(state,TASKS)); }
  const state=createInitialState();state.events[0].date='2026-02-31';assert.throws(()=>validateState(state,TASKS));
});
