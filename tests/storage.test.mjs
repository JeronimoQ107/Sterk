import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_EXERCISES, matchesExercise } from '../src/data.js';
import { resetSet, finishSet, setVolume } from '../src/sets.js';

const memory = new Map();
globalThis.localStorage = { getItem: (key) => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value), removeItem: (key) => memory.delete(key) };
const { storage } = await import('../src/storage.js');
const unilateral = { sides: { left: { weight: 15, reps: 10, completed: true }, right: { weight: 15, reps: 12, completed: false } } };

test('catalog IDs remain unique; names and Spanish aliases are searchable', () => {
  assert.equal(DEFAULT_EXERCISES.length, 57);
  assert.equal(new Set(DEFAULT_EXERCISES.map((e) => e.id)).size, 57);
  assert(matchesExercise(DEFAULT_EXERCISES.find((e) => e.id === 'bayesian-curl'), 'bayesiano'));
  assert(matchesExercise(DEFAULT_EXERCISES[0], 'PÉCHO banca'));
});
test('unilateral totals include only completed sides and count the pair once', () => {
  storage.clearAll();
  storage.saveWorkoutEntry({ id: 'one', exerciseId: 'bayesian-curl', sets: [unilateral] });
  let entry = storage.getEntries()[0];
  assert.equal(entry.volume, 150); assert.equal(entry.repCount, 10); assert.equal(entry.setCount, 1);
  storage.saveWorkoutEntry({ ...entry, sets: [finishSet(unilateral)] });
  entry = storage.getEntries()[0];
  assert.equal(entry.volume, 330); assert.equal(entry.repCount, 22); assert.equal(entry.setCount, 1);
  assert.equal(setVolume(resetSet(unilateral)), 0);
  assert.equal(unilateral.sides.left.completed, true);
});
test('active session and version 4 backup round trip preserve asymmetric sides', () => {
  storage.clearAll();
  storage.saveCustomExercise({ id: 'custom-test', name: 'Test custom', category: 'pull', muscleGroup: 'biceps' });
  storage.saveActiveSession({ id: 'session', startedAt: '2026-09-08T00:00:00Z', exerciseIndex: 0, exercises: [{ exerciseId: 'bayesian-curl', unilateral: true, sets: [unilateral], status: 'pending' }] });
  const before = storage.getActiveSession();
  const backup = storage.exportData(); assert.equal(backup.version, 4);
  storage.clearAll(); storage.importData(JSON.parse(JSON.stringify(backup)));
  assert.deepEqual(storage.getActiveSession(), before);
  assert(storage.getExerciseCatalog().some((e) => e.id === 'custom-test'));
});
test('backups V1–V3 keep old sets bilateral and preserve weights', () => {
  for (const version of [1, 2, 3]) {
    storage.importData({ app: 'Sterk', version, entries: [{ id: 'legacy', exercise: 'Bench Press', weight: 25, reps: [10, 8] }] });
    const entry = storage.getEntries()[0];
    assert.equal(entry.volume, 450); assert.equal(entry.sets[1].reps, 8); assert.equal(entry.sets[0].sides, undefined);
  }
});
test('empty active sessions survive reload; removing a current entry preserves older history', () => {
  storage.clearAll();
  storage.saveActiveSession({ id: 'empty', exercises: [] });
  assert.deepEqual(storage.getActiveSession().exercises, []);
  storage.saveWorkoutEntry({ id: 'older', sessionId: 'older-session', exerciseId: 'bayesian-curl', sets: [finishSet(unilateral)] });
  storage.saveWorkoutEntry({ id: 'current', sessionId: 'empty', exerciseId: 'bayesian-curl', sets: [unilateral] });
  storage.deleteWorkoutEntry('current');
  assert.deepEqual(storage.getEntries().map((entry) => entry.id), ['older']);
});
