// DATA-03 con QA-03: copias automáticas antes de cada versión y su restauración exacta.
// Usa almacenamiento y base de copias simulados; IndexedDB real se comprueba en el navegador.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createSnapshots } from '../src/snapshots.js';
import { settingsDashboard } from '../src/dashboard.js';

const FIXTURE = JSON.parse(fs.readFileSync(new URL('./fixtures/storage-v1.7.3.json', import.meta.url), 'utf8'));
const ENTRIES = 'sterk:v1:workout-entries';
const ACTIVE = 'sterk:v1:active-session';
const SESSIONS = 'sterk:v1:completed-sessions';
const LEGACY = 'gym-tracker:v0:workout-entries';
const OTHER = 'otra-app:preferencias';

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

// Cada arranque carga storage.js de nuevo, como al abrir la app: captura los datos en ese momento.
let boots = 0;
async function boot(data = FIXTURE) {
  memory.clear(); failRead.clear(); failWrite.clear();
  Object.entries(data).forEach(([key, value]) => memory.set(key, value));
  memory.set(OTHER, 'no es de Sterk');
  return (await import(`../src/storage.js?arranque=${boots++}`)).storage;
}

function memoryBackend() {
  const records = new Map();
  return {
    records,
    async getAll() { return [...records.values()].map((record) => structuredClone(record)); },
    async put(record) { records.set(record.id, structuredClone(record)); },
    async delete(id) { records.delete(id); },
  };
}

let clock = Date.parse('2026-11-19T10:00:00.000Z');
const now = () => new Date(clock += 60_000);
const open = (storage, backend, version = '1.7.5') => createSnapshots({ storage, backend, version, now });
const sterkData = () => Object.fromEntries([...memory].filter(([key]) => key !== OTHER));

test('DATA-03: the first run of a version saves the previous data exactly, once', async () => {
  const backend = memoryBackend();
  const storage = await boot();
  const snapshots = open(storage, backend);

  const first = await snapshots.ensureVersionSnapshot();
  assert.equal(first.created, true);
  assert.deepEqual(first.snapshot.summary, { sessions: 2, entries: 5, customExercises: 2, activeSession: true });
  const [record] = backend.records.values();
  assert.deepEqual(record.data, FIXTURE);
  assert.equal(record.data[OTHER], undefined);

  assert.deepEqual(await snapshots.ensureVersionSnapshot(), { created: false, reason: 'exists' });
  assert.equal(backend.records.size, 1);
});

test('DATA-03: only the last three versions are kept', async () => {
  const backend = memoryBackend();
  for (const version of ['1.7.5', '1.7.6', '1.7.7', '1.7.8']) {
    const storage = await boot();
    assert.equal((await open(storage, backend, version).ensureVersionSnapshot()).created, true);
  }
  const versions = (await open(await boot(), backend).list()).map((snapshot) => snapshot.appVersion);
  assert.deepEqual(versions, ['1.7.8', '1.7.7', '1.7.6']);
});

test('DATA-03: the copy is taken before the V0 migration writes', async () => {
  const backend = memoryBackend();
  const storage = await boot({ [LEGACY]: FIXTURE[LEGACY] });
  assert(memory.has(ENTRIES), 'la migración V0 creó las entradas V1');
  await open(storage, backend).ensureVersionSnapshot();
  const [record] = backend.records.values();
  assert.deepEqual(record.data, { [LEGACY]: FIXTURE[LEGACY] });
});

test('DATA-03: no copy is created when data cannot be read, nor when there is nothing to save', async () => {
  const corruptions = {
    json: () => ({ ...FIXTURE, [ENTRIES]: FIXTURE[ENTRIES].slice(0, 100) }),
    format: () => ({ ...FIXTURE, [SESSIONS]: '[null]' }),
  };
  for (const [name, data] of Object.entries(corruptions)) {
    const backend = memoryBackend();
    const storage = await boot(data());
    assert.deepEqual(await open(storage, backend).ensureVersionSnapshot(), { created: false, reason: 'unreadable' }, name);
    assert.equal(backend.records.size, 0, name);
  }

  const backend = memoryBackend();
  memory.clear();
  failRead.add(ACTIVE);
  const unreadable = (await import(`../src/storage.js?arranque=${boots++}`)).storage;
  assert.deepEqual(await open(unreadable, backend).ensureVersionSnapshot(), { created: false, reason: 'unreadable' });
  assert.equal(backend.records.size, 0);

  // Una vez reparados los datos, el siguiente arranque de la misma versión sí guarda la copia.
  assert.equal((await open(await boot(), backend).ensureVersionSnapshot()).created, true);
  assert.deepEqual(await open(await boot({}), memoryBackend()).ensureVersionSnapshot(), { created: false, reason: 'empty' });
});

test('DATA-03: restoring brings back the exact data and can be undone', async () => {
  const backend = memoryBackend();
  const storage = await boot();
  const snapshots = open(storage, backend);
  const { snapshot } = await snapshots.ensureVersionSnapshot();

  storage.saveWorkoutEntry({ id: 'entry-new', sessionId: 'session-new', exerciseId: 'hammer-curl', sets: [{ weight: 30, reps: 10, completed: true }] });
  storage.deleteSession('session-a', ['entry-bench', 'entry-curl']);
  storage.clearActiveSession();
  storage.saveSettings({ trackingMode: 'set' });
  memory.delete(LEGACY);
  const changed = sterkData();

  await snapshots.restore(snapshot.id);
  assert.deepEqual(sterkData(), FIXTURE);
  assert.equal(memory.get(OTHER), 'no es de Sterk');
  assert.deepEqual(storage.getActiveSession(), JSON.parse(FIXTURE[ACTIVE]));
  assert.deepEqual(storage.checkData(), []);

  const undo = (await snapshots.list()).find((item) => item.reason === 'before-restore');
  assert.equal(undo.summary.activeSession, false);
  await snapshots.restore(undo.id);
  assert.deepEqual(sterkData(), changed);
  assert.equal((await snapshots.list()).filter((item) => item.reason === 'before-restore').length, 1);
  assert.equal((await snapshots.list()).filter((item) => item.reason === 'version').length, 1);
});

test('DATA-03: restoring does not replace unreadable data, a damaged copy or a failed write', async () => {
  const backend = memoryBackend();
  const storage = await boot();
  const snapshots = open(storage, backend);
  const { snapshot } = await snapshots.ensureVersionSnapshot();

  // Decisión de DATA-02: un dato ilegible no se reemplaza ni al restaurar una copia.
  memory.set(ENTRIES, '[{"roto"');
  let before = new Map(memory);
  await assert.rejects(snapshots.restore(snapshot.id), { name: 'StorageReadError' });
  assert.deepEqual(memory, before);
  assert.equal(backend.records.size, 1, 'no se guarda copia previa si no se va a restaurar');

  memory.set(ENTRIES, FIXTURE[ENTRIES]);
  backend.records.get(snapshot.id).data[SESSIONS] = '{"incompleto"';
  before = new Map(memory);
  await assert.rejects(snapshots.restore(snapshot.id), /dañada/);
  assert.deepEqual(memory, before);
  assert.equal(backend.records.size, 1);

  backend.records.get(snapshot.id).data[SESSIONS] = FIXTURE[SESSIONS];
  storage.saveSettings({ trackingMode: 'set' });
  failWrite.add(SESSIONS);
  before = new Map(memory);
  await assert.rejects(snapshots.restore(snapshot.id), /QuotaExceededError simulado/);
  assert.deepEqual(memory, before);
});

test('DATA-03: Settings lists the copies with a restore button', () => {
  const snapshot = { id: 'abc', reason: 'version', appVersion: '1.7.5', createdAt: '2026-11-19T10:00:00.000Z', summary: { sessions: 2, entries: 5, customExercises: 2, activeSession: true } };
  const html = settingsDashboard([], 0, [snapshot, { ...snapshot, id: 'def', reason: 'before-restore', summary: { ...snapshot.summary, sessions: 1, activeSession: false } }]);
  assert.match(html, /Copias automáticas/);
  assert.match(html, /Al abrir la versión 1\.7\.5/);
  assert.match(html, /2 entrenamientos · sesión en curso/);
  assert.match(html, /Antes de restaurar una copia/);
  assert.match(html, /data-restore-snapshot="abc"/);
  assert.match(settingsDashboard([], 0, 'unavailable'), /no están disponibles/);
  assert.match(settingsDashboard([], 0, []), /Todavía no hay copias/);
  assert.doesNotMatch(settingsDashboard([], 0, null), /Copias automáticas/);
});
