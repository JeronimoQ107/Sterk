import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import * as data from '../src/data.js';
import * as sets from '../src/sets.js';
import { icon } from '../src/icons.js';
import { homeDashboard, progressDashboard, settingsDashboard } from '../src/dashboard.js';
import { exerciseOptions } from '../src/progress.js';

const memory = new Map();
globalThis.localStorage = { getItem: (key) => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value), removeItem: (key) => memory.delete(key) };
const { storage } = await import('../src/storage.js');
const source = fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8').replace(/^import .*;\r?\n/gm, '');
function setup() {
  storage.clearAll();
  const handlers = {}, notices = [], dialogs = [];
  const app = { innerHTML: '', addEventListener: (type, fn) => { handlers[type] = fn; }, querySelector: () => null };
  const dummy = { addEventListener() {}, classList: { add() {}, remove() {} } };
  const context = vm.createContext({ ...data, ...sets, icon, homeDashboard, progressDashboard, settingsDashboard, exerciseOptions, bindWeightControl() {}, bindRepsControl() {}, storage, structuredClone, console, crypto: globalThis.crypto,
    document: { querySelector: (selector) => selector === '#app' ? app : dummy, querySelectorAll: () => [], body: { append() {} },
      createElement: () => { const dialog = { handlers: {}, innerHTML: '', setAttribute() {}, addEventListener(type, fn) { this.handlers[type] = fn; }, showModal() {}, close() {}, remove() {} }; dialogs.push(dialog); return dialog; } },
    navigator: {}, window: { setInterval() {}, setTimeout() {}, scrollTo() {} }, confirm: () => true, alert: (text) => notices.push(text), openWeightPicker() {}, openRepsPicker() {},
  });
  vm.runInContext(source, context);
  const run = (code) => vm.runInContext(code, context);
  const click = (dataset) => handlers.click({ target: { closest: (selector) => {
    const attribute = selector.match(/^\[data-([\w-]+)\]$/)?.[1];
    const key = attribute?.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    return key && key in dataset ? { dataset } : null;
  } } });
  return { run, click, notices, dialogs, app };
}

test('start with one exercise, save without closing, append and recover with same clock', () => {
  const { run, click } = setup();
  run('state.builderSelection = ["bayesian-curl"]; startSession();');
  const initial = storage.getActiveSession();
  run('saveExercise();');
  assert.equal(storage.getActiveSession().id, initial.id);
  assert.equal(storage.getCompletedSessions().length, 0);
  click({ action: 'add-exercises' });
  run('state.builderSelection = ["hammer-curl"];');
  click({ action: 'start-session' });
  run('goHome(); resumeSession();');
  const recovered = storage.getActiveSession();
  assert.equal(recovered.startedAt, initial.startedAt);
  assert.equal(recovered.exercises.length, 2);
  assert.equal(run('draft().exerciseId'), 'hammer-curl');
  assert.equal(recovered.exercises[0].status, 'registered');
});

test('the final completed set registers its exercise but does not finish the workout', () => {
  const { run, click } = setup();
  storage.saveSettings({ trackingMode: 'set' });
  run('state.builderSelection = ["pec-deck"]; startSession();');
  click({ toggleSet: '0' });
  click({ toggleSet: '1' });
  assert.equal(storage.getEntries().length, 0);
  click({ toggleSet: '2' });
  assert.equal(storage.getEntries().length, 1);
  assert.equal(storage.getActiveSession().exercises[0].status, 'registered');
  assert.equal(storage.getCompletedSessions().length, 0);
});

test('the catalog shows the Pec Deck illustration and the added forearm group', () => {
  const { run, app } = setup();
  run('state.view = "builder"; render();');
  assert.match(app.innerHTML, /assets\/exercises\/pec-deck\.png/);
  assert.match(app.innerHTML, /Antebrazos/);
  assert.match(app.innerHTML, /Reverse Wrist Curl/);
});

test('history keeps mixed workouts in their own filter', () => {
  const { run, app } = setup();
  run('state.builderSelection = ["pec-deck", "bayesian-curl"]; startSession(); saveExercise(); saveExercise(); completeSession();');
  run('state.historyFilter = "mixed"; renderHistory();');
  assert.match(app.innerHTML, /data-history-session=/);
  assert.match(app.innerHTML, /Pec Deck · Bayesian Curl/);
  run('state.historyFilter = "push"; renderHistory();');
  assert.doesNotMatch(app.innerHTML, /data-history-session=/);
});
test('unilateral series mode persists asymmetric values and only counts completed sides', () => {
  const { run, click } = setup();
  storage.saveSettings({ trackingMode: 'set' });
  run('state.builderSelection = ["bayesian-curl"]; startSession();');
  click({ action: 'toggle-unilateral' });
  click({ setReps: '0', side: 'right', delta: '2' });
  click({ toggleSet: '0', side: 'left' });
  run('saveExercise(); goHome(); resumeSession();');
  assert.equal(run('draft().sets[0].sides.right.reps'), 12);
  assert.equal(storage.getEntries()[0].volume, 250);
  click({ toggleSet: '0', side: 'right' });
  run('saveExercise();');
  assert.equal(storage.getEntries().length, 1);
  assert.equal(storage.getEntries()[0].volume, 550);
  assert.equal(storage.getEntries()[0].setCount, 1);
});
test('finalization blocks unsaved edits, then writes completed summary on explicit action', () => {
  const { run, click, notices } = setup();
  run('state.builderSelection = ["bayesian-curl"]; startSession(); saveExercise();');
  click({ setReps: '0', delta: '2' });
  click({ action: 'finish-session' });
  assert.equal(notices.length, 1);
  assert.equal(storage.getCompletedSessions().length, 0);
  run('saveExercise();');
  click({ action: 'finish-session' });
  assert.equal(storage.getActiveSession(), null);
  assert.equal(storage.getCompletedSessions()[0].volume, 800);
});
test('reorder preserves current draft; removing exercises can leave a recoverable empty session', () => {
  const { run, click, dialogs } = setup();
  run('state.builderSelection = ["bayesian-curl", "hammer-curl"]; startSession(); saveExercise();');
  const currentId = run('draft().exerciseId');
  click({ action: 'manage-session' });
  const dialog = dialogs[0];
  const event = (selector, dataset) => ({ target: { closest: (query) => query === selector ? { dataset } : null } });
  dialog.handlers.click(event('[data-move]', { move: '1', direction: '-1' }));
  assert.equal(storage.getActiveSession().exercises[0].exerciseId, 'hammer-curl');
  assert.equal(run('draft().exerciseId'), currentId);
  dialog.handlers.click(event('[data-remove]', { remove: '1' }));
  assert.equal(storage.getEntries().length, 0);
  dialog.handlers.click(event('[data-remove]', { remove: '0' }));
  run('goHome(); resumeSession();');
  assert.equal(run('state.view'), 'exercise');
  assert.equal(run('state.exerciseIndex'), 0);
  assert.equal(storage.getActiveSession().exercises.length, 0);
});
test('previous reference excludes this session', () => {
  const { run } = setup();
  storage.saveWorkoutEntry({ id: 'past', sessionId: 'past-session', exerciseId: 'bayesian-curl', recordedAt: '2026-01-01', sets: [{ weight: 10, reps: 8 }] });
  run('state.builderSelection = ["bayesian-curl"]; startSession(); saveExercise();');
  const sessionId = storage.getActiveSession().id;
  assert.equal(storage.getLastExerciseEntry('bayesian-curl', 'Bayesian Curl', sessionId).id, 'past');
});
test('a past workout uses its chosen date while its timer keeps the real session clock', () => {
  const { run } = setup();
  run('state.builderSelection = ["bayesian-curl"]; startSession(); changeActiveSessionDate("2020-03-14"); saveExercise(); completeSession();');
  const entry = storage.getEntries()[0];
  const session = storage.getCompletedSessions()[0];
  assert.equal(run(`inputDate("${entry.recordedAt}")`), '2020-03-14');
  assert.equal(run(`inputDate("${session.startedAt}")`), '2020-03-14');
  assert(session.durationSeconds < 60);
});
test('progress explanations open only from the information dialog', () => {
  const { run, dialogs } = setup();
  run('openProgressInfo();');
  assert.equal(dialogs.length, 1);
  assert.match(dialogs[0].innerHTML, /peso × \(1 \+ repeticiones ÷ 30\)/);
  assert.match(dialogs[0].innerHTML, /no una prueba real/);
});
