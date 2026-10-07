export const MANUAL_URL = 'https://en.enduro.team/images/b/b9/Suzuki-Gsf650s-2005.pdf';
export const TEXT_MANUAL_URL = 'https://manuzoid.com/manuals/wrBpO-Suzuki%20GSF650S%20User%20manual';
// Recurring intervals from Suzuki's GSF650/S K5 service manual, section 2-2.
// Each operation is independent: an inspection never resets a replacement.
const tasks = [];
function add(id, name, category, action, km, months, options = {}) {
  tasks.push({ id, name, category, action, intervalKm: km, intervalMonths: months, source: 'Suzuki · 2-2', ...options });
}
add('oil', 'Ulei motor', 'Motor', 'replace', 6000, 12, { seed: true, notes: 'Motul 7100 10W-40 · 3,5 L (schimb cu filtru).' });
add('oil-filter', 'Filtru ulei', 'Motor', 'replace', 18000, 36, { seed: true, notes: 'COF038. Poți seta un interval personal mai scurt, de exemplu odată cu uleiul.' });
add('air-check', 'Filtru aer', 'Motor', 'inspect', 6000, 12, { seed: true });
add('air-replace', 'Filtru aer', 'Motor', 'replace', 18000, 36, { seed: true });
add('spark-check', 'Bujii CR8EK', 'Motor', 'inspect', 6000, 12, { seed: true });
add('spark-replace', 'Bujii CR8EK', 'Motor', 'replace', 12000, 24, { seed: true, notes: '4 bucăți schimbate.' });
add('valves', 'Joc supape', 'Motor', 'inspect', 12000, 24, { plannedKm: 36000, notes: 'Probabil verificat la ~24.000 km în Germania, fără document sau dată. Nu este o intervenție confirmată.' });
add('fuel-line', 'Conducte benzină / vacuum', 'Alimentare', 'inspect', 6000, 12, { plannedKm: 36000, notes: 'Fără service documentat. Lipsa scurgerilor observate nu confirmă verificarea. De clarificat reparația garniturilor carburatoarelor.' });
add('fuel-check', 'Filtru benzină', 'Alimentare', 'inspect', 6000, 12, { plannedKm: 36000 });
add('fuel-replace', 'Filtru benzină', 'Alimentare', 'replace', 12000, 24, { plannedKm: 36000 });
add('idle', 'Ralanti', 'Alimentare', 'inspect', 6000, 12, { plannedKm: 36000 });
add('throttle', 'Joc cablu accelerație', 'Alimentare', 'inspect', 6000, 12, { plannedKm: 36000 });
add('carbs', 'Sincronizare carburatoare', 'Alimentare', 'inspect', 12000, 24, { plannedKm: 36000 });
add('pair', 'Sistem PAIR', 'Alimentare', 'inspect', 12000, 24, { plannedKm: 36000 });
add('clutch', 'Cablu ambreiaj / joc', 'Transmisie', 'inspect', 6000, 12, { plannedKm: 36000 });
add('chain-check', 'Lanț · uzură și joc', 'Transmisie', 'inspect', 6000, 12, { seed: true, notes: 'Verificat și reglat la service.' });
add('chain-lube', 'Lanț · curățare și lubrifiere', 'Transmisie', 'lubricate', 1000, null, { seed: true, notes: 'Și după ploaie sau spălare, când este necesar.' });
add('chain-kit', 'Kit lanț și pinioane', 'Transmisie', 'replace', null, null, { plannedKm: 36000, priority: 'watch', source: 'După uzură · recomandare mecanic', notes: 'Mecanicul a recomandat schimbarea în aproximativ 6.000 km de la service. Reper orientativ, de reevaluat.' });
add('brakes', 'Frâne · inspecție generală', 'Frâne', 'inspect', 6000, 12, { seed: true });
add('pads', 'Plăcuțe frână', 'Frâne', 'inspect', 6000, 12, { seed: true, priority: 'watch', notes: '~30% material rămas la 30.137 km. Verificare mai devreme decât service-ul de 6.000 km; înlocuire după uzură.' });
add('discs', 'Discuri frână', 'Frâne', 'inspect', 6000, 12, { seed: true, notes: 'Măsurate la service, fără problemă indicată. Parte din inspecția frânelor.' });
for (const [id, name] of [['front', 'Lichid frână față'], ['rear', 'Lichid frână spate']]) {
  add(`fluid-${id}-check`, name, 'Frâne', 'inspect', 6000, 12, { seed: true });
  add(`fluid-${id}-replace`, name, 'Frâne', 'replace', null, 24, { seed: true });
}
add('hoses-check', 'Furtunuri frână', 'Frâne', 'inspect', 6000, 12, { priority: 'watch', notes: 'Istoric necunoscut. Identifică vechimea și marcajele; nu presupunem că sunt noi.' });
add('hoses-replace', 'Furtunuri frână', 'Frâne', 'replace', null, 48, { notes: 'Data ultimei înlocuiri este necunoscută. Termenul de patru ani nu poate fi calculat.' });
add('tires-check', 'Anvelope', 'Șasiu', 'inspect', 6000, 12, { seed: true, priority: 'watch', notes: 'Bridgestone T31, DOT 2018; spate ~3 mm. Fața recomandată la schimb.' });
add('tires-replace', 'Anvelope · față și spate', 'Șasiu', 'replace', null, null, { priority: 'attention', source: 'După stare · plan personal', plannedDate: '2026-12-01', notes: 'Plan: Michelin Road 6, iarna 2026–2027. 01.12.2026 este un reper de planificare editabil, nu o limită Suzuki și nu confirmă siguranța până atunci.' });
add('steering', 'Rulmenți / jug direcție', 'Șasiu', 'inspect', 12000, 24, { seed: true });
add('fork', 'Furcă față', 'Șasiu', 'inspect', 12000, 24, { seed: true });
add('rear-suspension', 'Suspensie spate', 'Șasiu', 'inspect', 12000, 24, { plannedKm: 36000 });
add('exhaust', 'Șuruburi evacuare / tobă', 'Șasiu', 'tighten', 12000, 24, { plannedKm: 36000 });
add('chassis', 'Șuruburi / piulițe șasiu', 'Șasiu', 'tighten', 6000, 12, { plannedKm: 36000 });
add('wheel-bearings', 'Rulmenți roți', 'Șasiu', 'inspect', null, null, { seed: true, source: 'După stare · plan personal', notes: 'Verificați, OK. Recontrol recomandat la schimbul anvelopelor; fără interval separat Suzuki.' });
add('battery', 'Încărcare / baterie', 'Electric', 'inspect', null, 12, { seed: true, source: 'Plan personal · anual', notes: '~14,1 V în sarcină la service. Control anual înainte de sezon: preferință personală, fără interval fix în tabelul Suzuki.' });
add('electrics', 'Instalație electrică', 'Electric', 'inspect', null, null, { seed: true, source: 'La simptome', notes: 'Verificată față / spate.' });
add('horn', 'Claxon', 'Electric', 'replace', null, null, { seed: true, source: 'La nevoie', notes: 'Hella nou.' });
export const TASKS = tasks;
export const ACTIONS = { inspect: 'Verificare', replace: 'Schimb', lubricate: 'Întreținere', tighten: 'Strângere' };
export function createInitialState() {
  return {
    version: 1,
    vehicle: { model: 'Suzuki GSF650S', year: 2005, km: 30920 },
    events: TASKS.filter(t => t.seed).map(t => ({ id: `seed-${t.id}`, taskId: t.id, date: '2026-09-10', km: 30137, action: t.action, notes: t.notes || 'Service la 30.137 km, conform fișei furnizate.', confirmed: true })),
    overrides: {},
  };
}
