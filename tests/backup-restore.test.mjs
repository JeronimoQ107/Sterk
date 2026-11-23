// DATA-01 y QA-03: restaurar un respaldo JSON V1–V4 valida su contenido completo antes de escribir.
// Un respaldo dañado o un fallo de escritura dejan exactamente los datos anteriores. Usa solo
// almacenamiento simulado y datos sintéticos.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const FIXTURE = JSON.parse(fs.readFileSync(new URL('./fixtures/storage-v1.7.3.json', import.meta.url), 'utf8'));
const ENTRIES = 'sterk:v1:workout-entries';
const ACTIVE = 'sterk:v1:active-session';
const SESSIONS = 'sterk:v1:completed-sessions';
const SETTINGS = 'sterk:v1:settings';
const CUSTOM = 'sterk:v1:custom-exercises';
const ALL = [ENTRIES, ACTIVE, SESSIONS, SETTINGS, CUSTOM];
const clone = (value) => JSON.parse(JSON.stringify(value));

const memory = new Map();
const failWrite = new Set();
// Permite fallar una escritura concreta, por ejemplo la que restaura el valor original.
let beforeWrite = null;
globalThis.localStorage = {
  getItem: (key) => memory.get(key) ?? null,
  setItem(key, value) {
    beforeWrite?.(key, value);
    if (failWrite.has(key)) throw new Error('QuotaExceededError simulado');
    memory.set(key, String(value));
  },
  removeItem(key) {
    beforeWrite?.(key, undefined);
    if (failWrite.has(key)) throw new Error('Error de escritura simulado');
    memory.delete(key);
  },
};

let storage;
function loadFixture() {
  memory.clear(); failWrite.clear(); beforeWrite = null;
  Object.entries(FIXTURE).forEach(([key, value]) => memory.set(key, value));
  storage?.checkData();
}

loadFixture();
({ storage } = await import('../src/storage.js'));
// Respaldo V4 exportado por esta versión a partir de los datos de 1.7.3.
const backupV4 = (() => { loadFixture(); return clone(storage.exportData()); })();

// V1 y V2 (1.0–1.1): rutinas fijas, peso único por ejercicio, repeticiones en lista y sin ejercicios propios.
const backupV1 = {
  app: 'Sterk', version: 1, exportedAt: '2026-09-02T12:00:00.000Z',
  entries: [
    { id: 'v1-bench', sessionId: 'v1-session', routineId: 'push', exercise: 'Bench Press', weight: 95, reps: [10, 8, 6], completedSets: [true, true, false], recordedAt: '2026-09-01T13:00:00.000Z', date: '1/9/2026', time: '08:00 a. m.' },
    { id: 'v1-row', routineId: 'pull', exercise: 'Ejercicio retirado', weight: 50.5, reps: [12, 12], recordedAt: '2026-09-01T13:20:00.000Z' },
  ],
  completedSessions: [{ id: 'v1-session', routineId: 'push', routine: 'Empuje', startedAt: '2026-09-01T12:50:00.000Z', endedAt: '2026-09-01T13:40:00.000Z', durationMinutes: 50, exerciseCount: 1, skippedCount: 0, setCount: 2, repCount: 18, volume: 1710 }],
  activeSession: { id: 'v1-active', routineId: 'push', startedAt: '2026-09-02T11:00:00.000Z', trackingMode: 'set', exerciseIndex: 1, exercises: [
    { weight: 100, reps: [10, 10, 10], completedSets: [true, false, false], status: 'registered', entryId: 'v1-active-entry' },
    { weight: 20, reps: [12, 12, 12], completedSets: [false, false, false], status: 'pending' },
  ] },
  settings: { trackingMode: 'set' },
};
const backupV2 = { ...clone(backupV1), version: 2, activeSession: null };
// V3 (1.2): ejercicios propios y series bilaterales.
const backupV3 = {
  app: 'Sterk', version: 3, exportedAt: '2026-09-05T12:00:00.000Z',
  entries: [{ id: 'v3-kick', sessionId: 'v3-session', exerciseId: 'custom-kick', recordedAt: '2026-09-04T14:00:00.000Z', sets: [{ weight: 20, reps: 10, completed: true }, { weight: 22.5, reps: 0, completed: true }] }],
  completedSessions: [{ id: 'v3-session', label: 'Pierna', categoryTags: ['legs'], startedAt: '2026-09-04T13:30:00.000Z', endedAt: '2026-09-04T14:30:00.000Z', durationSeconds: 3600 }],
  activeSession: null,
  settings: { trackingMode: 'exercise' },
  customExercises: [{ id: 'custom-kick', name: 'Patada en polea', category: 'legs', muscleGroup: 'glutes', custom: true, archived: false }],
};

function assertRestoredCleanly() {
  assert.deepEqual(storage.checkData(), [], 'la restauración dejó claves ilegibles');
}

test('DATA-01: a V4 backup of 1.7.3 data restores exactly over different data', () => {
  loadFixture();
  storage.importData(clone(backupV3));
  storage.importData(clone(backupV4));
  for (const key of ALL) assert.deepEqual(JSON.parse(memory.get(key)), JSON.parse(FIXTURE[key]), key);
  assertRestoredCleanly();
});

test('DATA-01: V1 and V2 backups keep weights, reps, sessions and the active session', () => {
  for (const backup of [backupV1, backupV2]) {
    loadFixture();
    storage.importData(clone(backup));
    assertRestoredCleanly();
    const bench = storage.getEntries().find((entry) => entry.id === 'v1-bench');
    assert.deepEqual(bench.sets, [{ weight: 95, reps: 10, completed: true }, { weight: 95, reps: 8, completed: true }, { weight: 95, reps: 6, completed: false }]);
    assert.equal(bench.exerciseId, 'bench-press');
    assert.equal(bench.volume, 1710);
    assert.equal(storage.getEntries().find((entry) => entry.id === 'v1-row').exercise, 'Ejercicio retirado');
    assert.deepEqual(storage.getCompletedSessions(), backup.completedSessions);
    assert.deepEqual(storage.getSettings(), { trackingMode: 'set' });
    assert.equal(memory.has(CUSTOM) && JSON.parse(memory.get(CUSTOM)).length, 0);
    if (backup.activeSession) {
      const active = storage.getActiveSession();
      assert.equal(active.id, 'v1-active');
      assert.equal(active.exercises.length, 2);
      assert.deepEqual(active.exercises[0].sets.map((set) => set.completed), [true, false, false]);
      assert.equal(active.exercises[1].sets[0].weight, 20);
    } else {
      assert.equal(memory.has(ACTIVE), false);
    }
  }
});

test('DATA-01: a V3 backup keeps custom exercises and zero-rep sets', () => {
  loadFixture();
  storage.importData(clone(backupV3));
  assertRestoredCleanly();
  assert.deepEqual(JSON.parse(memory.get(CUSTOM)), backupV3.customExercises);
  const kick = storage.getEntries()[0];
  assert.equal(kick.exercise, 'Patada en polea');
  assert.deepEqual(kick.sets[1], { weight: 22.5, reps: 0, completed: true });
  assert.equal(memory.has(ACTIVE), false);
});

test('DATA-01: a backup exported with unreadable data still restores its readable sections', () => {
  loadFixture();
  const backup = clone(backupV4);
  backup.unreadableData = { [ENTRIES]: '{"roto": ' };
  storage.importData(backup);
  assertRestoredCleanly();
  assert.deepEqual(JSON.parse(memory.get(ENTRIES)), JSON.parse(FIXTURE[ENTRIES]));
});

// Respaldos dañados en cada sección. Todos parten del V4 válido y cambian un solo punto.
const damaged = {
  'archivo vacío': () => null,
  'otra aplicación': (b) => { b.app = 'Otra'; },
  'versión desconocida': (b) => { b.version = 5; },
  'sin historial': (b) => { delete b.entries; },
  'entradas: elemento nulo': (b) => { b.entries.push(null); },
  'entradas: series no son lista': (b) => { b.entries[1].sets = 'x'; },
  'entradas: serie nula': (b) => { b.entries[1].sets[0] = null; },
  'entradas: peso no numérico': (b) => { b.entries[1].sets[0].weight = 'mucho'; },
  'entradas: repeticiones como objeto': (b) => { b.entries[1].sets[0].reps = { n: 8 }; },
  'entradas: completada no booleana': (b) => { b.entries[1].sets[0].completed = 'sí'; },
  'entradas: lados nulos': (b) => { b.entries.find((e) => e.id === 'entry-curl').sets[1].sides = null; },
  'entradas: lado izquierdo no es objeto': (b) => { b.entries.find((e) => e.id === 'entry-curl').sets[1].sides.left = 'x'; },
  'entradas: peso de un lado no numérico': (b) => { b.entries.find((e) => e.id === 'entry-curl').sets[1].sides.right.weight = []; },
  'entradas: fecha inválida': (b) => { b.entries[0].recordedAt = 'ayer'; },
  'entradas: nombre como objeto': (b) => { b.entries[0].exercise = { name: 'Bench Press' }; },
  'entradas: repeticiones antiguas no numéricas': (b) => { delete b.entries[0].sets; b.entries[0].reps = ['diez']; },
  'sesiones: no son lista': (b) => { b.completedSessions = { id: 'session-a' }; },
  'sesiones: elemento nulo': (b) => { b.completedSessions.push(null); },
  'sesiones: fecha inválida': (b) => { b.completedSessions[0].startedAt = '2026-13-45'; },
  'sesiones: volumen no numérico': (b) => { b.completedSessions[0].volume = 'NaN lb'; },
  'sesiones: categorías no son lista': (b) => { b.completedSessions[0].categoryTags = 'push'; },
  'preferencias: texto': (b) => { b.settings = 'set'; },
  'preferencias: lista': (b) => { b.settings = []; },
  'sesión en curso: texto': (b) => { b.activeSession = 'x'; },
  'sesión en curso: sin ejercicios': (b) => { delete b.activeSession.exercises; },
  'sesión en curso: ejercicio nulo (caso del roadmap)': (b) => { b.activeSession.exercises = [null]; },
  'sesión en curso: serie nula': (b) => { b.activeSession.exercises[0].sets = [null]; },
  'sesión en curso: lado no es objeto': (b) => { b.activeSession.exercises[1].sets[0].sides.right = 7; },
  'sesión en curso: índice no numérico': (b) => { b.activeSession.exerciseIndex = 'uno'; },
  'sesión en curso: fecha inválida': (b) => { b.activeSession.startedAt = 'hoy'; },
  'ejercicios propios: no son lista': (b) => { b.customExercises = 'x'; },
  'ejercicios propios: elemento nulo': (b) => { b.customExercises.push(null); },
  'ejercicios propios: sin nombre': (b) => { delete b.customExercises[0].name; },
  'ejercicios propios: nombre numérico': (b) => { b.customExercises[0].name = 5; },
  'ejercicios propios: sin id': (b) => { delete b.customExercises[1].id; },
};

for (const [name, damage] of Object.entries(damaged)) {
  test(`DATA-01: damaged backup (${name}) changes nothing`, () => {
    loadFixture();
    const before = new Map(memory);
    let backup = clone(backupV4);
    backup = damage(backup) === null ? null : backup;
    assert.throws(() => storage.validateBackup(clone(backup)), { name: 'InvalidBackupError', message: /No se modificó ningún dato/ });
    assert.throws(() => storage.importData(clone(backup)), { name: 'InvalidBackupError', message: /No se modificó ningún dato/ });
    assert.deepEqual(memory, before);
    assert.deepEqual(storage.checkData(), []);
  });
}

test('DATA-01: the error names the damaged section', () => {
  loadFixture();
  const backup = clone(backupV4);
  backup.activeSession.exercises = [null];
  assert.throws(() => storage.importData(backup), { message: /sesión en curso, ejercicios, elemento 1/ });
});

for (const key of ALL) {
  test(`DATA-01: a failed write to ${key} keeps every earlier key`, () => {
    loadFixture();
    failWrite.add(key);
    const before = new Map(memory);
    assert.throws(() => storage.importData(clone(backupV3)), { message: /No se pudo guardar el respaldo.*Tus datos anteriores se conservan/ });
    assert.deepEqual(memory, before);
  });
}

test('DATA-01: if restoring the earlier data also fails, the warning says so', () => {
  loadFixture();
  // La escritura de las sesiones falla y, después, también la que devuelve el historial a su valor original.
  beforeWrite = (key, value) => {
    if (key === SESSIONS) throw new Error('QuotaExceededError simulado');
    if (key === ENTRIES && value === FIXTURE[ENTRIES]) throw new Error('QuotaExceededError simulado');
  };
  assert.throws(() => storage.importData(clone(backupV3)), { message: /Puede que algunos datos hayan cambiado/ });
});
