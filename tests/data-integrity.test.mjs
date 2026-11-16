// DATA-02 y QA-03: los datos escritos por la versión anterior se conservan, y una clave que no se
// puede leer nunca se sobrescribe. Usa solo almacenamiento simulado.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// Estado de localStorage escrito por Sterk 1.7.3 con datos sintéticos (sin datos reales):
// migración V0, series bilaterales, lados asimétricos, una serie con 0 repeticiones, ejercicios
// propios (uno archivado), preferencias antiguas y una sesión activa con estados mezclados.
const FIXTURE = JSON.parse(fs.readFileSync(new URL('./fixtures/storage-v1.7.3.json', import.meta.url), 'utf8'));
const ENTRIES = 'sterk:v1:workout-entries';
const ACTIVE = 'sterk:v1:active-session';
const SESSIONS = 'sterk:v1:completed-sessions';
const SETTINGS = 'sterk:v1:settings';
const CUSTOM = 'sterk:v1:custom-exercises';
const LEGACY = 'gym-tracker:v0:workout-entries';
const ALL = [ENTRIES, ACTIVE, SESSIONS, SETTINGS, CUSTOM];
const stored = (key) => JSON.parse(FIXTURE[key]);
// Las series por lado tienen reps undefined en el resumen; JSON lo guarda como null desde 1.7.3.
const asStored = (value) => JSON.parse(JSON.stringify(value));

let storage;
const memory = new Map();
const failRead = new Set();
const failWrite = new Set();
globalThis.localStorage = {
  getItem(key) {
    if (failRead.has(key)) throw new Error('SecurityError simulado');
    return memory.get(key) ?? null;
  },
  setItem(key, value) {
    if (failWrite.has(key)) throw new Error('QuotaExceededError simulado');
    memory.set(key, String(value));
  },
  removeItem(key) {
    if (failWrite.has(key)) throw new Error('Error de escritura simulado');
    memory.delete(key);
  },
};

function loadFixture() {
  memory.clear(); failRead.clear(); failWrite.clear();
  Object.entries(FIXTURE).forEach(([key, value]) => memory.set(key, value));
  storage?.checkData();
}

loadFixture();
({ storage } = await import('../src/storage.js'));
const backupV4 = (() => { loadFixture(); return JSON.parse(JSON.stringify(storage.exportData())); })();

const newEntry = { id: 'entry-new', sessionId: 'session-active', exerciseId: 'hammer-curl', recordedAt: '2026-10-05T12:40:00.000Z', sets: [{ weight: 30, reps: 10, completed: true }] };
const newSession = { id: 'session-new', startedAt: '2026-10-07T12:00:00.000Z', endedAt: '2026-10-07T13:00:00.000Z', durationSeconds: 3600 };

test('QA-03: data written by 1.7.3 reads back unchanged', () => {
  loadFixture();
  assert.deepEqual(storage.checkData(), []);
  assert.deepEqual(asStored(storage.getEntries()), stored(ENTRIES));
  assert.deepEqual(storage.getCompletedSessions(), stored(SESSIONS));
  assert.deepEqual(storage.getActiveSession(), stored(ACTIVE));
  assert.deepEqual(storage.getSettings(), { trackingMode: 'exercise' });

  const curl = storage.getEntries().find((entry) => entry.id === 'entry-curl');
  assert.deepEqual(curl.sets[1].sides, { left: { weight: 17.5, reps: 9, completed: true }, right: { weight: 15, reps: 11, completed: false } });
  assert.equal(curl.setCount, 2);
  const bench = storage.getEntries().find((entry) => entry.id === 'entry-bench');
  assert.deepEqual(bench.sets[2], { weight: 135, reps: 0, completed: true });
  assert.equal(storage.getEntries().find((entry) => entry.id === 'v0-entry').volume, 2280);

  assert(storage.getExerciseCatalog().some((exercise) => exercise.id === 'custom-cable-kickback'));
  assert(!storage.getExerciseCatalog().some((exercise) => exercise.id === 'custom-old'));
  assert(storage.getExerciseCatalog({ includeArchived: true }).some((exercise) => exercise.id === 'custom-old'));
});

test('QA-03: writing with the new version keeps every earlier record', () => {
  loadFixture();
  storage.saveWorkoutEntry(newEntry);
  storage.saveCompletedSession(newSession);
  storage.saveCustomExercise({ id: 'custom-new', name: 'Nuevo ejercicio', category: 'push', muscleGroup: 'chest' });
  storage.saveSettings({});
  storage.saveActiveSession(storage.getActiveSession());

  for (const entry of stored(ENTRIES)) assert.deepEqual(asStored(storage.getEntries().find((item) => item.id === entry.id)), entry);
  assert.equal(storage.getEntries().length, stored(ENTRIES).length + 1);
  assert.deepEqual(storage.getCompletedSessions().slice(0, -1), stored(SESSIONS));
  assert.deepEqual(JSON.parse(memory.get(CUSTOM)).slice(0, -1), stored(CUSTOM));
  assert.equal(memory.get(ACTIVE), FIXTURE[ACTIVE]);
  assert.equal(memory.get(SETTINGS), FIXTURE[SETTINGS]);
  assert.equal(memory.get(LEGACY), FIXTURE[LEGACY]);
});

test('QA-03: a V4 backup of 1.7.3 data restores the same state', () => {
  loadFixture();
  storage.clearAll();
  storage.importData(JSON.parse(JSON.stringify(backupV4)));
  for (const key of ALL) assert.deepEqual(JSON.parse(memory.get(key)), stored(key), key);
  assert.equal(backupV4.unreadableData, undefined);
});

test('DATA-02: unreadable entries are not replaced by saveWorkoutEntry (roadmap case)', () => {
  loadFixture();
  const broken = FIXTURE[ENTRIES].slice(0, 200);
  memory.set(ENTRIES, broken);

  assert.throws(() => storage.saveWorkoutEntry(newEntry), { name: 'StorageReadError', message: /historial de ejercicios/ });
  assert.equal(memory.get(ENTRIES), broken);
  assert.deepEqual(storage.getStorageProblems(), [{ key: ENTRIES, label: 'historial de ejercicios', reason: 'json' }]);
});

// Cada operación con las claves que modifica.
const operations = [
  ['saveWorkoutEntry', [ENTRIES], () => storage.saveWorkoutEntry(newEntry)],
  ['deleteWorkoutEntry', [ENTRIES], () => storage.deleteWorkoutEntry('entry-bench')],
  ['changeSessionDate', [ENTRIES, SESSIONS, ACTIVE], () => storage.changeSessionDate('session-a', '2026-10-02', ['entry-bench'])],
  ['deleteSession', [ENTRIES, SESSIONS], () => storage.deleteSession('session-a', ['entry-bench'])],
  ['saveCompletedSession', [SESSIONS], () => storage.saveCompletedSession(newSession)],
  ['saveActiveSession', [ACTIVE], () => storage.saveActiveSession({ id: 'session-new', exercises: [] })],
  ['clearActiveSession', [ACTIVE], () => storage.clearActiveSession()],
  ['saveSettings', [SETTINGS], () => storage.saveSettings({ trackingMode: 'set' })],
  ['saveCustomExercise', [CUSTOM], () => storage.saveCustomExercise({ id: 'custom-new', name: 'Nuevo ejercicio', category: 'push', muscleGroup: 'chest' })],
  ['archiveCustomExercise', [CUSTOM], () => storage.archiveCustomExercise('custom-cable-kickback')],
  ['importData', ALL, () => storage.importData(JSON.parse(JSON.stringify(backupV4)))],
  ['clearAll', ALL, () => storage.clearAll()],
];

// JSON válido que no tiene la forma esperada y que antes se trataba como vacío o rompía la lectura.
const wrongShape = { [ENTRIES]: '[null]', [ACTIVE]: '{"id":"x","exercises":[null]}', [SESSIONS]: '{"id":"session-a"}', [SETTINGS]: '[]', [CUSTOM]: '"texto"' };
const corruptions = {
  json: (key) => memory.set(key, FIXTURE[key].slice(0, Math.floor(FIXTURE[key].length / 2))),
  access: (key) => failRead.add(key),
  format: (key) => memory.set(key, wrongShape[key]),
};

for (const key of ALL) {
  for (const [reason, corrupt] of Object.entries(corruptions)) {
    test(`DATA-02: ${key} with ${reason} problem is never written`, () => {
      const affected = operations.filter(([, keys]) => keys.includes(key));
      assert(affected.length > 0);
      for (const [name, , run] of affected) {
        loadFixture();
        corrupt(key);
        const before = new Map(memory);
        assert.throws(run, { name: 'StorageReadError' }, name);
        assert.deepEqual(memory, before, `${name} changed stored data`);
        assert.deepEqual(storage.getStorageProblems().find((problem) => problem.key === key)?.reason, reason, name);
      }
    });
  }
}

test('DATA-02: reading an unreadable key shows defaults, warns and exports the original text', () => {
  loadFixture();
  const broken = '{"roto": ';
  memory.set(ENTRIES, broken);

  assert.deepEqual(storage.getEntries(), []);
  assert.deepEqual(storage.checkData().map((problem) => problem.key), [ENTRIES]);
  assert.equal(storage.exportData().unreadableData[ENTRIES], broken);
  assert.equal(storage.getCompletedSessions().length, stored(SESSIONS).length);

  storage.saveSettings({ trackingMode: 'set' });
  assert.equal(memory.get(ENTRIES), broken);

  memory.set(ENTRIES, FIXTURE[ENTRIES]);
  storage.saveWorkoutEntry(newEntry);
  assert.deepEqual(storage.checkData(), []);
  assert.equal(storage.getEntries().length, stored(ENTRIES).length + 1);
});

test('DATA-02: a failed write restores every key changed by the same operation', () => {
  for (const run of [
    () => storage.changeSessionDate('session-a', '2026-10-02', ['entry-bench']),
    () => storage.deleteSession('session-a', ['entry-bench']),
    () => storage.importData(JSON.parse(JSON.stringify(backupV4))),
  ]) {
    loadFixture();
    failWrite.add(SESSIONS);
    const before = new Map(memory);
    assert.throws(run, /QuotaExceededError simulado/);
    assert.deepEqual(memory, before);
  }
});

test('DATA-02: a read error at startup does not migrate V0 history over V1 entries', async () => {
  loadFixture();
  failRead.add(ENTRIES);
  await import('../src/storage.js?startup-read-error');
  failRead.clear();
  assert.equal(memory.get(ENTRIES), FIXTURE[ENTRIES]);
});
