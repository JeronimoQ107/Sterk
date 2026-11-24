import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import * as data from '../src/data.js';
import * as sets from '../src/sets.js';
import { icon, checkMark } from '../src/icons.js';
import * as motion from '../src/motion.js';
import { homeDashboard, progressDashboard, settingsDashboard, plural, metricsRow, segmented } from '../src/dashboard.js';
import { exerciseOptions, overview, muscleGroupSets } from '../src/progress.js';
import { createSnapshots } from '../src/snapshots.js';
import { APP_VERSION } from '../src/version.js';
import * as format from '../src/format.js';

const memory = new Map();
globalThis.localStorage = { getItem: (key) => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value), removeItem: (key) => memory.delete(key) };
const { storage } = await import('../src/storage.js');
const source = fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8').replace(/^import .*;\r?\n/gm, '');
function setup() {
  storage.clearAll();
  const handlers = {}, notices = [], dialogs = [], asked = [], answer = { accept: true };
  const app = { innerHTML: '', addEventListener: (type, fn) => { handlers[type] = fn; }, querySelector: () => null };
  const dummy = { addEventListener() {}, classList: { add() {}, remove() {} } };
  const context = vm.createContext({ ...data, ...sets, ...format, ...motion, icon, checkMark, homeDashboard, progressDashboard, settingsDashboard, plural, metricsRow, segmented, exerciseOptions, createSnapshots, APP_VERSION, bindWeightControl() {}, bindRepsControl() {}, bindFolds() {}, bindChart() {}, chartState: () => null, morphChart() {},
    // UX-04: las confirmaciones se aceptan y los avisos se anotan; las hojas no se abren de verdad.
    showSheet() {}, ask: (options, accept) => { asked.push(options); if (answer.accept) accept(); }, notice: (text) => notices.push(text), storage, structuredClone, console, crypto: globalThis.crypto,
    document: { querySelector: (selector) => selector === '#app' ? app : selector === 'dialog[open]' ? null : dummy, querySelectorAll: () => [], body: { append() {} },
      createElement: () => { const dialog = { handlers: {}, innerHTML: '', setAttribute() {}, addEventListener(type, fn) { this.handlers[type] = fn; }, showModal() {}, close() {}, remove() {} }; dialogs.push(dialog); return dialog; } },
    navigator: {}, window: { setInterval() {}, setTimeout() {}, scrollTo() {}, addEventListener() {} }, openWeightPicker() {}, openRepsPicker() {},
  });
  vm.runInContext(source, context);
  const run = (code) => vm.runInContext(code, context);
  const click = (dataset) => handlers.click({ target: { closest: (selector) => {
    const attribute = selector.match(/^\[data-([\w-]+)\]$/)?.[1];
    const key = attribute?.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    return key && key in dataset ? { dataset } : null;
  } } });
  return { run, click, notices, dialogs, app, asked, answer };
}

test('start with one exercise, save without closing, append and recover with same clock', () => {
  const { run, click } = setup();
  run('state.builderSelection = ["bayesian-curl"]; startSession();');
  const initial = storage.getActiveSession();
  click({ toggleSet: '0' });
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
  run('state.builderSelection = ["pec-deck"]; startSession();');
  run('state.session.trackingMode = "exercise"; persistSession();');
  click({ toggleSet: '0' });
  click({ toggleSet: '1' });
  assert.equal(storage.getEntries().length, 0);
  click({ toggleSet: '2' });
  assert.equal(storage.getEntries().length, 1);
  assert.equal(storage.getActiveSession().exercises[0].status, 'registered');
  assert.equal(storage.getCompletedSessions().length, 0);
});

test('the settings selector is gone and legacy preferences cannot disable set checks', () => {
  const { run, click, app } = setup();
  storage.saveSettings({ trackingMode: 'exercise' });
  run('state.builderSelection = ["pec-deck"]; startSession();');
  assert.equal(storage.getActiveSession().trackingMode, 'set');
  const row = run('renderSetRows(draft().sets[0], 0, null)');
  const order = ['class="ex-n"', 'class="ex-prev"', 'class="weight-value"', 'class="reps-value"', 'class="ex-check"'].map((marker) => row.indexOf(marker));
  assert(order.every((position, index) => position >= 0 && (index === 0 || position > order[index - 1])), 'serie, anterior, peso, repeticiones y marcador en ese orden');
  click({ toggleSet: '0' });
  assert.equal(storage.getActiveSession().exercises[0].sets[0].completed, true);
  run('state.view = "settings"; render();');
  assert.doesNotMatch(app.innerHTML, /data-mode=|Por ejercicio|Por serie/);
});

test('the right-hand set check completes both sides of a unilateral set', () => {
  const { run, click } = setup();
  run('state.builderSelection = ["bayesian-curl"]; startSession();');
  click({ action: 'toggle-unilateral' });
  click({ toggleSet: '0' });
  const sides = storage.getActiveSession().exercises[0].sets[0].sides;
  assert.equal(sides.left.completed, true);
  assert.equal(sides.right.completed, true);
  click({ toggleSet: '0' });
  assert.equal(storage.getActiveSession().exercises[0].sets[0].completed, false);
});

test('the catalog keeps image slots for illustrated and pending exercises', () => {
  const { run, app } = setup();
  run('state.view = "builder"; render();');
  assert.match(app.innerHTML, /assets\/exercises\/pec-deck.webp/);
  assert.match(app.innerHTML, /catalog-item illustrated/);
  assert.match(app.innerHTML, /catalog-thumbnail image-pending"><svg/);
  assert.match(app.innerHTML, /Antebrazos/);
  assert.match(app.innerHTML, /Reverse Wrist Curl/);
});

test('VIS-01: the exercise screen offers the technique animation closed, only where one exists', () => {
  const { run, app } = setup();
  run('state.builderSelection = ["barbell-squat", "pec-deck"]; startSession();');
  assert.match(app.innerHTML, /<details class="ex-technique" ><summary>Ver técnica/);
  assert.match(app.innerHTML, /data-technique="barbell-squat"/);
  run('state.techniqueOpen = true; render();');
  assert.match(app.innerHTML, /<details class="ex-technique" open>/);
  run('state.exerciseIndex = 1; render();');
  assert.doesNotMatch(app.innerHTML, /ex-technique/);
  run('state.view = "builder"; render();');
  assert.match(app.innerHTML, /assets\/exercises\/barbell-squat\.webp/);
});

test('VIS-01: the bench press shows its catalog image and its technique animation', () => {
  const { run, app } = setup();
  run('state.builderSelection = ["pec-deck", "bench-press"]; startSession();');
  assert.doesNotMatch(app.innerHTML, /ex-technique/);
  run('state.exerciseIndex = 1; render();');
  assert.match(app.innerHTML, /data-technique="bench-press"/);
  run('state.view = "builder"; render();');
  assert.match(app.innerHTML, /assets\/exercises\/bench-press\.webp/);
});

test('history keeps mixed workouts in their own filter', () => {
  const { run, click, app } = setup();
  run('state.builderSelection = ["pec-deck", "bayesian-curl"]; startSession();');
  click({ toggleSet: '0' }); run('saveExercise();');
  click({ toggleSet: '0' }); run('saveExercise(); completeSession();');
  run('state.historyFilter = "mixed"; renderHistory();');
  assert.match(app.innerHTML, /data-history-session=/);
  assert.match(app.innerHTML, /Pec Deck · Bayesian Curl/);
  run('state.historyFilter = "push"; renderHistory();');
  assert.doesNotMatch(app.innerHTML, /data-history-session=/);
});
test('unilateral series mode persists asymmetric values and only counts completed sides', () => {
  const { run, click } = setup();
  run('state.builderSelection = ["bayesian-curl"]; startSession();');
  click({ action: 'toggle-unilateral' });
  run('editablePart(0, "right").reps += 2; markEdited(); persistSession();'); // lo que hace el control de repeticiones
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
test('UX-02: finishing registers the current edits, but untouched pending exercises still block', () => {
  const { run, click, notices } = setup();
  run('state.builderSelection = ["bayesian-curl", "hammer-curl"]; startSession();');
  for (let index = 0; index < run('draft().sets.length'); index += 1) click({ toggleSet: String(index) });
  assert.equal(run('state.exerciseIndex'), 1, 'la última serie registra y pasa al siguiente pendiente');
  click({ jump: '0' });
  run('editablePart(0).reps += 2; markEdited(); persistSession();'); // lo que hace el control de repeticiones
  assert.equal(storage.getActiveSession().exercises[0].status, 'pending');
  click({ action: 'finish-session' });
  assert.equal(notices.length, 1, 'hammer-curl sigue pendiente sin series marcadas');
  assert.equal(storage.getCompletedSessions().length, 0);
  assert.equal(storage.getActiveSession().exercises[0].status, 'registered', 'la edición de bayesian-curl se registró al finalizar');
  run('goToExercise(1);');
  click({ action: 'skip' });
  click({ action: 'finish-session' });
  assert.equal(storage.getActiveSession(), null);
  assert.equal(storage.getCompletedSessions()[0].volume, 800);
});
test('UX-02: leaving an exercise registers its checked sets; with nothing checked it stays pending', () => {
  const { run, click } = setup();
  run('state.builderSelection = ["bayesian-curl", "hammer-curl"]; startSession();');
  click({ toggleSet: '0' });
  assert.equal(storage.getEntries().length, 0, 'una serie marcada no registra por sí sola');
  click({ action: 'next' });
  assert.equal(run('state.exerciseIndex'), 1);
  assert.equal(storage.getEntries().length, 1);
  assert.equal(storage.getEntries()[0].setCount, 1);
  assert.equal(storage.getActiveSession().exercises[0].status, 'registered');
  click({ jump: '0' });
  assert.equal(storage.getActiveSession().exercises[1].status, 'pending', 'sin series marcadas no se registra');
  assert.equal(storage.getEntries().length, 1);
  click({ toggleSet: '1' });
  click({ action: 'leave-session' });
  assert.equal(storage.getEntries()[0].setCount, 2, 'volver al inicio también registra la edición');
  assert.equal(storage.getCompletedSessions().length, 0, 'salir no finaliza el entrenamiento');
});
test('reorder preserves current draft; removing exercises can leave a recoverable empty session', () => {
  const { run, click, dialogs } = setup();
  run('state.builderSelection = ["bayesian-curl", "hammer-curl"]; startSession();');
  click({ toggleSet: '0' }); run('saveExercise();');
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
  const { run, click } = setup();
  storage.saveWorkoutEntry({ id: 'past', sessionId: 'past-session', exerciseId: 'bayesian-curl', recordedAt: '2026-01-01', sets: [{ weight: 10, reps: 8 }] });
  run('state.builderSelection = ["bayesian-curl"]; startSession();');
  click({ toggleSet: '0' }); run('saveExercise();');
  const sessionId = storage.getActiveSession().id;
  assert.equal(storage.getLastExerciseEntry('bayesian-curl', 'Bayesian Curl', sessionId).id, 'past');
});
test('a past workout uses its chosen date while its timer keeps the real session clock', () => {
  const { run, click } = setup();
  run('state.builderSelection = ["bayesian-curl"]; startSession(); changeActiveSessionDate("2020-03-14");');
  click({ toggleSet: '0' }); run('saveExercise(); completeSession();');
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
test('DATA-02: unreadable history shows a warning and registering keeps the stored text', () => {
  const { run, click, app } = setup();
  run('state.builderSelection = ["pec-deck"]; startSession();');
  click({ toggleSet: '0' });
  const broken = '[{"id":"older","sets":';
  memory.set('sterk:v1:workout-entries', broken);
  try {
    run('render();');
    assert.match(app.innerHTML, /No se pudieron leer algunos datos/);
    assert.match(app.innerHTML, /historial de ejercicios/);
    assert.throws(() => run('saveExercise();'), { name: 'StorageReadError' });
    assert.equal(memory.get('sterk:v1:workout-entries'), broken);
    assert.equal(storage.getActiveSession().exercises[0].status, 'pending');
  } finally {
    memory.delete('sterk:v1:workout-entries');
    storage.checkData();
  }
  run('render();');
  assert.doesNotMatch(app.innerHTML, /No se pudieron leer algunos datos/);
});

test('HIST-02 y QA-03: los registros V0 sin sesión siguen en el historial al cerrar la sesión activa', () => {
  const { run } = setup();
  const fixture = JSON.parse(fs.readFileSync(new URL('./fixtures/storage-v1.7.3.json', import.meta.url), 'utf8'));
  memory.clear();
  Object.entries(fixture).forEach(([key, value]) => memory.set(key, value));
  const legacyId = 'legacy:push:1/8/2026';
  const ids = () => run('getHistorySessions().map((session) => session.id)');
  try {
    assert.ok(storage.getActiveSession());
    assert.ok(ids().includes(legacyId));
    assert.ok(!ids().includes(storage.getActiveSession().id));
    storage.clearActiveSession();
    assert.equal(storage.getActiveSession(), null);
    const legacy = run('getHistorySessions()').find((session) => session.id === legacyId);
    assert.ok(legacy, 'el entrenamiento legacy debe seguir en el historial');
    assert.deepEqual(Array.from(legacy.entries, (entry) => entry.id), ['v0-entry']);
    assert.ok(run('exerciseOptions(getHistorySessions())').some((option) => /bench/i.test(JSON.stringify(option))));
    assert.equal(memory.get('gym-tracker:v0:workout-entries'), fixture['gym-tracker:v0:workout-entries']);
    assert.equal(memory.get('sterk:v1:workout-entries'), fixture['sterk:v1:workout-entries']);
  } finally {
    memory.clear();
  }
});

test('HIST-03 y QA-03: las sesiones antiguas sin totales muestran valores calculados de sus entradas', () => {
  const { run, click, app } = setup();
  const fixture = JSON.parse(fs.readFileSync(new URL('./fixtures/storage-v1.7.3.json', import.meta.url), 'utf8'));
  memory.clear();
  Object.entries(fixture).forEach(([key, value]) => memory.set(key, value));
  try {
    const old = run('getHistorySessions()').find((session) => session.id === 'session-b');
    assert.deepEqual([old.exerciseCount, old.setCount, old.volume, old.skippedCount], [1, 1, 337.5, 0]);
    const current = run('getHistorySessions()').find((session) => session.id === 'session-a');
    assert.deepEqual([current.exerciseCount, current.setCount, current.volume], [2, 4, 3620], 'la serie de 0 repeticiones no cuenta (MET-01)');

    run('state.view = "history"; render();');
    assert.doesNotMatch(app.innerHTML, /undefined|NaN/);
    run('state.historySessionId = "session-b"; state.view = "history-detail"; render();');
    assert.doesNotMatch(app.innerHTML, /undefined|NaN/);
    assert.match(app.innerHTML, /337,5 lb/);

    // Al finalizar una sesión de piernas, la comparación usa el volumen calculado de session-b.
    storage.clearActiveSession();
    run('state.builderSelection = ["custom-cable-kickback"]; startSession();');
    run('draft().sets.forEach((set) => { set.weight = 25; set.reps = 10; }); persistSession();');
    const setCount = run('draft().sets.length');
    for (let index = 0; index < setCount; index += 1) click({ toggleSet: String(index) });
    run('completeSession();');
    assert.equal(run('state.completion.previous.id'), 'session-b');
    assert.equal(run('state.completion.previous.volume'), 337.5);
    assert.doesNotMatch(app.innerHTML, /undefined|NaN/);

    assert.equal(memory.get('sterk:v1:completed-sessions').includes('"id":"session-b","routineId":"legs"'), true, 'la sesión antigua no se reescribe');
  } finally {
    memory.clear();
  }
});

test('MET-01 y QA-03: las series de 0 repeticiones de datos antiguos no cuentan y los datos no se modifican', () => {
  const { run, app } = setup();
  const fixture = JSON.parse(fs.readFileSync(new URL('./fixtures/storage-v1.7.3.json', import.meta.url), 'utf8'));
  memory.clear();
  Object.entries(fixture).forEach(([key, value]) => memory.set(key, value));
  try {
    const sessions = run('getHistorySessions()');
    const total = sessions.reduce((sum, session) => sum + session.setCount, 0);
    assert.equal(total, overview(sessions).sets, 'Historial y Progreso cuentan las mismas series');
    assert.equal(total, muscleGroupSets(sessions).reduce((sum, group) => sum + group.sets, 0));
    run('state.historySessionId = "session-a"; state.view = "history-detail"; render();');
    assert.match(app.innerHTML, /135 lb × 0/, 'la serie sigue visible en el detalle');
    run('state.view = "history"; render();');
    assert.match(app.innerHTML, /2 ejercicios · 4 series/);
    assert.equal(storage.getEntries().find((entry) => entry.id === 'entry-bench').sets.length, 3);
    Object.entries(fixture).forEach(([key, value]) => assert.equal(memory.get(key), value, key));
  } finally {
    memory.clear();
  }
});

test('MET-01: una serie o lado de 0 repeticiones se guarda, pero no cuenta al registrar, resumir ni comparar', () => {
  const { run, click, app } = setup();
  run('state.builderSelection = ["pec-deck", "bayesian-curl"]; startSession();');
  run('draft().sets[1].reps = 0; persistSession();');
  click({ toggleSet: '0' }); click({ toggleSet: '1' });
  assert.match(app.innerHTML, /data-roll>1<\/span> de 3 series/);
  click({ toggleSet: '2' });
  assert.equal(storage.getEntries().length, 0, 'con una serie de 0 repeticiones no se registra solo');
  click({ action: 'next' });
  assert.deepEqual(storage.getEntries()[0].sets.map((set) => [set.reps > 0, set.completed]), [[true, true], [false, true], [true, true]], 'la serie se conserva');

  // Por lado: cuenta la pareja si cuenta algún lado; con los dos a 0 no cuenta.
  click({ action: 'toggle-unilateral' });
  run('draft().sets[0].sides.right.reps = 0; draft().sets[1].sides.left.reps = 0; draft().sets[1].sides.right.reps = 0; persistSession();');
  for (const [index, side] of [['0', 'left'], ['0', 'right'], ['1', 'left'], ['1', 'right']]) click({ toggleSet: index, side });
  assert.match(app.innerHTML, /data-roll>0<\/span> de 3 series/);
  run('commitCurrentExercise(); completeSession();');
  const [summary] = storage.getCompletedSessions();
  assert.equal(summary.setCount, 3, '2 de pec deck y 1 pareja');
  assert.equal(summary.exerciseCount, 2);
  const sessions = run('getHistorySessions()');
  assert.equal(sessions[0].setCount, 3);
  assert.equal(overview(sessions).sets, 3);

  // La columna Anterior no propone la serie de 0 repeticiones como resultado.
  const row = (index) => run(`renderSetRows({ weight: 1, reps: 1, completed: false }, ${index}, storage.getEntries().find((entry) => entry.exerciseId === 'pec-deck').sets)`);
  assert.match(row(0), /ex-prev">[0-9.,]+ × [0-9]+</);
  assert.match(row(1), /ex-prev">—</);
});

test('UI-01: changing view or starting the workout scrolls to the top and notices stay visible for more than 1 s', () => {
  const { run, click } = setup();
  run('globalThis.scrolls = []; window.scrollTo = (...args) => scrolls.push(args); globalThis.timers = []; window.setTimeout = (fn, ms) => timers.push({ fn, ms });');
  run('toast.classList = { visible: false, add() { this.visible = true; }, remove() { this.visible = false; } };');
  click({ view: 'history' });
  assert.equal(run('scrolls.length'), 1, 'cambiar de vista vuelve arriba');
  run('render(); renderHistory();');
  assert.equal(run('scrolls.length'), 1, 'volver a dibujar la misma vista no mueve la página');
  click({ action: 'new-session' });
  run('state.builderSelection = ["pec-deck"];');
  click({ action: 'start-session' });
  assert.equal(run('state.view'), 'exercise');
  assert.equal(run('scrolls.length'), 3, 'empezar el entrenamiento abre el primer ejercicio arriba');
  run('showToast("Uno"); showToast("Dos");');
  assert(run('timers.every((timer) => timer.ms > 1000)'));
  run('timers[0].fn();');
  assert.equal(run('toast.classList.visible'), true, 'un aviso anterior no oculta el siguiente');
  run('timers[1].fn();');
  assert.equal(run('toast.classList.visible'), false);
});

test('UI-01: weights of 1,000 lb or more use the thousands separator in the exercise screen', () => {
  const { run, app } = setup();
  run('state.builderSelection = ["pec-deck"]; startSession(); draft().sets[0].weight = 1002.5; render();');
  assert.match(app.innerHTML, /data-weight-number>1\.002,5</);
});

test('UX-04 y QA-03: cancelar una confirmación no cambia ningún dato', () => {
  const { run, click, asked, answer } = setup();
  run('state.builderSelection = ["bayesian-curl", "hammer-curl"]; startSession();');
  click({ toggleSet: '0' }); run('saveExercise();');
  click({ jump: '0' });
  const stored = () => JSON.stringify([...memory]);
  const before = stored();
  answer.accept = false;
  for (const action of ['skip', 'discard-session', 'new-session', 'clear-data']) click({ action });
  run('draft().sets.forEach((set) => { set.completed = true; }); persistSession();');
  const marked = stored();
  click({ action: 'remove-set' });
  assert.equal(stored(), marked, 'la serie marcada sigue');
  run('draft().sets.forEach((set, index) => { set.completed = index === 0; }); persistSession();');
  assert.equal(stored(), before);
  assert.deepEqual(Array.from(asked, (options) => [options.action, options.danger]), [['Omitir', true], ['Descartar', true], ['Empezar otro', true], ['Borrar todo', true], ['Eliminar', true]]);
  click({ jump: '1' }); click({ action: 'skip' });
  click({ action: 'finish-session' });
  assert.equal(storage.getCompletedSessions().length, 0, 'finalizar también se puede cancelar');
  answer.accept = true;
  click({ action: 'finish-session' });
  assert.equal(storage.getCompletedSessions().length, 1);
  run('state.historySessionId = getHistorySessions()[0].id; state.view = "history-detail"; render();');
  answer.accept = false;
  const saved = stored();
  click({ action: 'delete-session' });
  assert.equal(stored(), saved);
  answer.accept = true;
  click({ action: 'delete-session' });
  assert.equal(storage.getCompletedSessions().length, 0);
});

test('UI-03: al completar la última serie se registra en el momento y solo se pasa al siguiente si no se tocó nada más', () => {
  const { run, click } = setup();
  run('globalThis.waiting = []; afterPause = (milliseconds, next) => waiting.push(next);');
  const complete = () => { for (let index = 0; index < run('draft().sets.length'); index += 1) click({ toggleSet: String(index) }); };
  run('state.builderSelection = ["bayesian-curl", "hammer-curl", "preacher-curl"]; startSession();');
  complete();
  assert.equal(storage.getEntries().length, 1, 'el registro no espera');
  assert.equal(run('state.exerciseIndex'), 0, 'la pantalla sí espera a que se vea la marca');
  click({ toggleSet: '0' }); // se desmarca antes de tiempo
  run('waiting.shift()();');
  assert.equal(run('state.exerciseIndex'), 0, 'una edición posterior cancela el cambio');
  click({ toggleSet: '0' });
  click({ action: 'next' });
  run('waiting.shift()();');
  assert.equal(run('state.exerciseIndex'), 1, 'si ya se cambió de ejercicio, no se vuelve a cambiar');
  complete();
  run('waiting.shift()();');
  assert.equal(run('state.exerciseIndex'), 2);
});

test('UI-03: cada cambio de vista tiene su animación y volver a dibujar la misma no', () => {
  const kind = motion.transitionKind;
  assert.deepEqual([kind(null, 'home'), kind('home', 'home'), kind('exercise', 'exercise')], ['', '', '']);
  assert.deepEqual([kind('home', 'exercise'), kind('exercise', 'home')], ['expand', 'collapse']);
  assert.deepEqual([kind('home', 'progress'), kind('settings', 'history')], ['tab-next', 'tab-previous']);
  assert.deepEqual([kind('history', 'history-detail'), kind('history-detail', 'history')], ['push', 'pop']);
  assert.deepEqual([kind('home', 'builder'), kind('builder', 'home'), kind('builder', 'exercise')], ['push', 'pop', 'push']);
  assert.deepEqual([kind('exercise', 'complete'), kind('complete', 'home')], ['finish', 'fade']);
});
