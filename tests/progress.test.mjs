import test from 'node:test';
import assert from 'node:assert/strict';
import { inPeriod, overview, exerciseSeries, availableSides, estimatedOneRepMax, personalRecords, muscleGroupSets } from '../src/progress.js';
import { progressDashboard, homeDashboard, sessionSummary, chartScale } from '../src/dashboard.js';
const part = (weight, reps, completed = true) => ({ weight, reps, completed });
const session = (id, date, sets) => ({ id, startedAt: date, entries: [{ exerciseId: 'curl', exercise: 'Curl', sets }] });
test('best performance keeps weight and reps from the same completed set; observations are chronological', () => {
  const sessions = [session('b', '2026-09-08T12:00:00', [part(30, 8), part(20, 15), part(50, 2, false)]), session('a', '2026-09-01T12:00:00', [part(25, 10)])];
  assert.deepEqual(exerciseSeries(sessions, 'curl').map((p) => [p.weight, p.reps]), [[25, 10], [30, 8]]);
});
test('left, right and old unspecified records are never mixed', () => {
  const sessions = [session('a', '2026-09-01', [part(25, 10), { sides: { left: part(15, 10), right: part(20, 12, false) } }])];
  assert.deepEqual(availableSides(sessions, 'curl'), ['both', 'left']);
  assert.equal(exerciseSeries(sessions, 'curl', 'left')[0].weight, 15);
  assert.equal(exerciseSeries(sessions, 'curl', 'right').length, 0);
  assert.equal(exerciseSeries(sessions, 'curl', 'both')[0].weight, 25);
  assert.equal(overview(sessions).sets, 2);
});
test('period uses local calendar days and days active are deduplicated', () => {
  const sessions = [session('a', '2026-09-02T00:00:00', [part(25, 10)]), session('b', '2026-09-02T13:00:00', [part(20, 0)]), session('c', '2026-09-01T23:59:59', [part(25, 10)])];
  const filtered = inPeriod(sessions, 7, new Date('2026-09-08T12:00:00'));
  assert.equal(filtered.length, 2); assert.equal(overview(filtered).days, 1); assert.equal(overview(filtered).sets, 1);
});
test('MET-01: a previous set with 0 reps is not the mark to beat in the home insight', () => {
  const home = (id, date, sets) => ({ ...session(id, date, sets), label: 'Pull', exerciseCount: 1, setCount: 1, volume: 0 });
  const last = home('b', '2026-09-08T12:00:00', [part(50, 10)]);
  assert.doesNotMatch(homeDashboard([last, home('a', '2026-09-01T12:00:00', [part(50, 0)])]), /Más repeticiones/);
  assert.match(homeDashboard([last, home('a', '2026-09-01T12:00:00', [part(50, 0), part(50, 8)])]), /[+]2 reps/);
});
test('empty and single observation views explain missing charts rather than inventing a trend', () => {
  assert.match(progressDashboard([], {}), /Tu progreso empieza/);
  const sessions = [session('a', '2026-09-01', [part(0, 10)])];
  const html = progressDashboard(sessions, { progressPeriod: 'all' });
  assert.match(html, /Sin comparación/); assert.match(html, /próximo registro/); assert.doesNotMatch(html, /NaN/);
});
test('multi-session chart provides an accessible data table and escapes exercise names', () => {
  const sessions = [session('a', '2026-09-01', [part(0, 10)]), session('b', '2026-09-02', [part(0, 12)])];
  sessions[0].entries[0].exercise = '<script>bad</script>'; sessions[1].entries[0].exercise = '<script>bad</script>';
  const html = progressDashboard(sessions, { progressPeriod: 'all' });
  assert.match(html, /<svg/); assert.match(html, /<table>/); assert.doesNotMatch(html, /<script>|NaN|Infinity/);
});
test('weight and reps are combined into performance while volume and records remain independent', () => {
  const sessions = [
    session('a', '2026-09-01', [part(100, 5), part(80, 10)]),
    session('b', '2026-09-08', [part(95, 8), part(70, 12)]),
  ];
  const points = exerciseSeries(sessions, 'curl');
  assert.equal(points[0].weight, 100);
  assert.equal(points[1].weight, 95);
  assert(points[1].estimatedOneRepMax > points[0].estimatedOneRepMax);
  assert.equal(points[1].volume, 1600);
  assert.equal(points[1].totalReps, 20);
  assert.equal(personalRecords(points).weight.maxWeight, 100);
  assert.equal(personalRecords(points).performance.sessionId, 'b');
  assert.equal(estimatedOneRepMax(100, 1), 100);
});
test('muscle group totals count completed sets and the main view keeps formulas behind info', () => {
  const sessions = [session('a', '2026-09-01', [part(25, 10), part(25, 8, false)])];
  sessions[0].entries[0].muscleGroup = 'biceps';
  assert.deepEqual(muscleGroupSets(sessions), [{ id: 'biceps', sets: 1 }]);
  const html = progressDashboard(sessions, { progressPeriod: 'all' });
  assert.match(html, /Cómo se calcula el progreso/);
  assert.match(html, /Rendimiento estimado/);
  assert.doesNotMatch(html, /repeticiones ÷ 30|Más peso no implica/);
});
test('UI-02: session totals use correct plurals and thousands separators everywhere', () => {
  assert.equal(sessionSummary({ exerciseCount: 1, setCount: 1, volume: 337.5 }), '1 ejercicio · 1 serie · 337,5 lb');
  assert.equal(sessionSummary({ exerciseCount: 4, setCount: 12, volume: 15930 }), '4 ejercicios · 12 series · 15.930 lb');
  const html = homeDashboard([{ id: 's', label: 'Legs', startedAt: '2026-11-07T18:30:00Z', exerciseCount: 1, setCount: 3, volume: 16542.5, entries: [{ exerciseId: 'squat', exercise: 'Squat', sets: [] }] }]);
  assert.match(html, /1 ejercicio · 3 series · 16\.542,5 lb/);
  assert.doesNotMatch(html, /[A-ZÁÉÍÓÚ]{4,} /, 'sin etiquetas en mayúsculas');
  assert.match(homeDashboard([]), /Todavía no hay entrenamientos/);
});
test('UI-01: the chart axis follows the data range and the estimated performance is shown in whole pounds', () => {
  assert.deepEqual(chartScale([258.33, 263.08]), { min: 258, max: 264, steps: 3 });
  assert.deepEqual(chartScale([20, 24]), { min: 20, max: 24, steps: 4 });
  assert.deepEqual(chartScale([260, 260]), { min: 250, max: 270, steps: 4 }, 'valores iguales quedan en el centro');
  assert.deepEqual(chartScale([0, 0]), { min: 0, max: 2, steps: 2 });
  assert.deepEqual(chartScale([5, 16542.5]), { min: 0, max: 20000, steps: 4 }, 'el eje nunca baja de 0');
  for (const values of [[1, 3], [95, 1001], [258.33, 263.08], [0.4, 0.6], [1234, 1250]]) {
    const { min, max, steps } = chartScale(values);
    assert(min <= Math.min(...values) && max >= Math.max(...values) && min >= 0, `${values} cabe en ${min}–${max}`);
    assert(Number.isInteger(min) && Number.isInteger((max - min) / steps) && steps >= 2 && steps <= 4, `${values}: marcas enteras`);
  }
  // 200 × 9 → 260 lb exactos y 197,5 × 10 → 263,33 lb: el eje va de 260 a 264 y no empieza en 0.
  const sessions = [session('a', '2026-09-01', [part(200, 9)]), session('b', '2026-09-08', [part(197.5, 10)])];
  const html = progressDashboard(sessions, { progressPeriod: 'all' });
  assert.match(html, /data-chart-value data-roll>263<\/span> <small>lb<\/small>/);
  assert.doesNotMatch(html, /263,33/);
  assert.match(html, />260<\/text>.*>262<\/text>.*>264<\/text>/s);
  assert.doesNotMatch(html, />0<\/text>/);
});
test('MET-02: the comparison names the selected metric and the table has the values of all three charts', () => {
  const sessions = [session('a', '2026-09-01', [part(100, 5), part(80, 10)]), session('b', '2026-09-08', [part(95, 8), part(70, 12)])];
  // UI-01: un decimal en el porcentaje.
  const expected = { performance: ['Rendimiento', '+3,1%'], volume: ['Volumen', '+23,1%'], reps: ['Repeticiones', '+33,3%'] };
  for (const [metric, [label, change]] of Object.entries(expected)) {
    const html = progressDashboard(sessions, { progressPeriod: 'all', progressMetric: metric });
    assert(html.includes(`data-chart-label>${label}`) && html.includes(`data-chart-change>${change}</strong><small>frente al anterior</small>`), `${metric}: ${label} ${change}`);
  }
  const html = progressDashboard(sessions, { progressPeriod: 'all' });
  assert.match(html, /<th>Rendimiento<\/th><th>Volumen<\/th><th>Reps<\/th>/);
  assert.match(html, /<td>1\.600 lb<\/td><td>20<\/td><\/tr>/, 'repeticiones totales de la sesión más reciente');
});
test('UI-01: a change that rounds to zero shows 0% without a sign', () => {
  const sessions = [session('a', '2026-09-01', [part(100, 10), part(50, 1)]), session('b', '2026-09-08', [part(100, 10), part(50, 1), part(0.5, 1)])];
  const html = progressDashboard(sessions, { progressPeriod: 'all', progressMetric: 'volume' });
  assert(html.includes('data-chart-label>Volumen total<') && html.includes('data-chart-change>0%</strong>'));
});
