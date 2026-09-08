import test from 'node:test';
import assert from 'node:assert/strict';
import { inPeriod, overview, exerciseSeries, availableSides } from '../src/progress.js';
import { progressDashboard } from '../src/dashboard.js';
const part = (weight, reps, completed = true) => ({ weight, reps, completed });
const session = (id, date, sets) => ({ id, startedAt: date, entries: [{ exerciseId: 'curl', exercise: 'Curl', sets }] });
test('highest load and reps come from the same completed set; observations are chronological', () => {
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
test('empty and single observation views explain missing charts rather than inventing a trend', () => {
  assert.match(progressDashboard([], {}), /Tu progreso empieza/);
  const sessions = [session('a', '2026-09-01', [part(0, 10)])];
  const html = progressDashboard(sessions, { progressPeriod: 'all' });
  assert.match(html, /Sin comparación/); assert.match(html, /completar otra sesión/); assert.doesNotMatch(html, /NaN/);
});
test('multi-session chart provides an accessible data table and escapes exercise names', () => {
  const sessions = [session('a', '2026-09-01', [part(0, 10)]), session('b', '2026-09-02', [part(0, 12)])];
  sessions[0].entries[0].exercise = '<script>bad</script>'; sessions[1].entries[0].exercise = '<script>bad</script>';
  const html = progressDashboard(sessions, { progressPeriod: 'all' });
  assert.match(html, /<svg/); assert.match(html, /<table>/); assert.doesNotMatch(html, /<script>|NaN|Infinity/);
});
