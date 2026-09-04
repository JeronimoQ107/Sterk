import { DEFAULT_EXERCISES, LEGACY_ROUTINES } from "./data.js";

const KEYS = Object.freeze({
  entries: "sterk:v1:workout-entries",
  activeSession: "sterk:v1:active-session",
  sessions: "sterk:v1:completed-sessions",
  settings: "sterk:v1:settings",
  customExercises: "sterk:v1:custom-exercises",
});

const LEGACY_ENTRIES_KEY = "gym-tracker:v0:workout-entries";

function read(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : JSON.parse(value);
  } catch {
    return fallback;
  }
}

function write(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
  return value;
}

function catalogWith(customExercises = read(KEYS.customExercises, [])) {
  return [...DEFAULT_EXERCISES, ...(Array.isArray(customExercises) ? customExercises : [])];
}

function findExercise(value, catalog = catalogWith()) {
  const id = value?.exerciseId || value?.id;
  const name = value?.exercise || value?.name;
  return catalog.find((exercise) => exercise.id === id)
    || catalog.find((exercise) => exercise.name.toLocaleLowerCase() === String(name || "").toLocaleLowerCase())
    || null;
}

function normalizeSets(entry) {
  if (Array.isArray(entry?.sets) && entry.sets.length) {
    return entry.sets.map((set, index) => ({
      weight: Math.max(0, Number(set.weight) || 0),
      reps: Math.max(0, Number(set.reps) || 0),
      completed: set.completed ?? entry.completedSets?.[index] ?? true,
    }));
  }
  const reps = Array.isArray(entry?.reps) && entry.reps.length ? entry.reps : [10, 10, 10];
  return reps.map((value, index) => ({
    weight: Math.max(0, Number(entry?.weight) || 0),
    reps: Math.max(0, Number(value) || 0),
    completed: entry?.completedSets?.[index] ?? true,
  }));
}

function normalizeEntry(entry, catalog = catalogWith()) {
  const sets = normalizeSets(entry);
  const metadata = findExercise(entry, catalog);
  return {
    ...entry,
    exerciseId: entry.exerciseId || metadata?.id || `legacy-${String(entry.exercise || "exercise").toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    exercise: entry.exercise || metadata?.name || "Ejercicio",
    muscleGroup: entry.muscleGroup || metadata?.muscleGroup || "other",
    category: entry.category || metadata?.category || entry.routineId || "push",
    sets,
    weight: sets[0]?.weight ?? 0,
    reps: sets.map((set) => set.reps),
    completedSets: sets.map((set) => set.completed),
    setCount: sets.length,
    volume: sets.reduce((sum, set) => sum + set.weight * set.reps, 0),
  };
}

function normalizeActiveSession(session, catalog = catalogWith()) {
  if (!session || !Array.isArray(session.exercises)) return session;
  const legacyNames = LEGACY_ROUTINES[session.routineId] || [];
  const exercises = session.exercises.map((exercise, index) => {
    const name = exercise.exercise || exercise.name || legacyNames[index];
    const metadata = findExercise({ ...exercise, name }, catalog);
    return {
      ...exercise,
      exerciseId: exercise.exerciseId || metadata?.id || `legacy-${index}`,
      exercise: name || metadata?.name || `Ejercicio ${index + 1}`,
      muscleGroup: exercise.muscleGroup || metadata?.muscleGroup || "other",
      category: exercise.category || metadata?.category || session.routineId || "push",
      sets: normalizeSets(exercise),
    };
  });
  return {
    ...session,
    categoryTags: session.categoryTags || [...new Set(exercises.map((exercise) => exercise.category))],
    exercises,
  };
}

if (localStorage.getItem(KEYS.entries) === null) {
  const legacy = read(LEGACY_ENTRIES_KEY, []);
  if (Array.isArray(legacy) && legacy.length) write(KEYS.entries, legacy);
}

export const storage = {
  getExerciseCatalog({ includeArchived = false } = {}) {
    const catalog = catalogWith();
    return includeArchived ? catalog : catalog.filter((exercise) => !exercise.archived);
  },
  saveCustomExercise(exercise) {
    const custom = read(KEYS.customExercises, []);
    const normalized = { ...exercise, custom: true, archived: Boolean(exercise.archived) };
    const duplicate = catalogWith(custom).find((item) => item.id !== normalized.id && item.name.toLocaleLowerCase() === normalized.name.toLocaleLowerCase());
    if (duplicate) throw new Error("Ya existe un ejercicio con ese nombre.");
    const index = custom.findIndex((item) => item.id === normalized.id);
    if (index >= 0) custom[index] = normalized;
    else custom.push(normalized);
    return write(KEYS.customExercises, custom);
  },
  archiveCustomExercise(id) {
    const custom = read(KEYS.customExercises, []);
    const item = custom.find((exercise) => exercise.id === id);
    if (item) item.archived = true;
    return write(KEYS.customExercises, custom);
  },
  getEntries() {
    const entries = read(KEYS.entries, []);
    return Array.isArray(entries) ? entries.map((entry) => normalizeEntry(entry)) : [];
  },
  getExerciseHistory(exerciseId, exerciseName) {
    return this.getEntries().filter((entry) => entry.exerciseId === exerciseId || entry.exercise === exerciseName).sort((a, b) => new Date(b.recordedAt) - new Date(a.recordedAt));
  },
  getLastExerciseEntry(exerciseId, exerciseName) {
    return this.getExerciseHistory(exerciseId, exerciseName)[0] || null;
  },
  saveWorkoutEntry(entry) {
    const entries = this.getEntries();
    const normalized = normalizeEntry(entry);
    const index = entries.findIndex((item) => item.id === normalized.id);
    if (index >= 0) entries[index] = normalized;
    else entries.push(normalized);
    return write(KEYS.entries, entries);
  },
  deleteWorkoutEntry(id) {
    return write(KEYS.entries, this.getEntries().filter((entry) => entry.id !== id));
  },
  getActiveSession() { return normalizeActiveSession(read(KEYS.activeSession, null)); },
  saveActiveSession(session) { return write(KEYS.activeSession, normalizeActiveSession(session)); },
  clearActiveSession() { localStorage.removeItem(KEYS.activeSession); },
  getCompletedSessions() {
    const sessions = read(KEYS.sessions, []);
    return Array.isArray(sessions) ? sessions : [];
  },
  saveCompletedSession(session) {
    const sessions = this.getCompletedSessions();
    const index = sessions.findIndex((item) => item.id === session.id);
    if (index >= 0) sessions[index] = session;
    else sessions.push(session);
    return write(KEYS.sessions, sessions);
  },
  deleteSession(sessionId, entryIds = []) {
    const ids = new Set(entryIds);
    write(KEYS.entries, this.getEntries().filter((entry) => entry.sessionId !== sessionId && !ids.has(entry.id)));
    write(KEYS.sessions, this.getCompletedSessions().filter((session) => session.id !== sessionId));
  },
  getSettings() { return { trackingMode: "exercise", ...read(KEYS.settings, {}) }; },
  saveSettings(settings) { return write(KEYS.settings, { ...this.getSettings(), ...settings }); },
  exportData() {
    return { app: "Sterk", version: 3, exportedAt: new Date().toISOString(), entries: this.getEntries(), completedSessions: this.getCompletedSessions(), activeSession: this.getActiveSession(), settings: this.getSettings(), customExercises: read(KEYS.customExercises, []) };
  },
  importData(data) {
    if (!data || data.app !== "Sterk" || ![1, 2, 3].includes(data.version) || !Array.isArray(data.entries)) throw new Error("El archivo no es un respaldo válido de Sterk.");
    const customExercises = data.version === 3 && Array.isArray(data.customExercises) ? data.customExercises : [];
    const catalog = catalogWith(customExercises);
    write(KEYS.customExercises, customExercises);
    write(KEYS.entries, data.entries.map((entry) => normalizeEntry(entry, catalog)));
    write(KEYS.sessions, Array.isArray(data.completedSessions) ? data.completedSessions : []);
    write(KEYS.settings, data.settings || { trackingMode: "exercise" });
    if (data.activeSession) write(KEYS.activeSession, normalizeActiveSession(data.activeSession, catalog));
    else this.clearActiveSession();
  },
  clearAll() {
    Object.values(KEYS).forEach((key) => localStorage.removeItem(key));
    localStorage.removeItem(LEGACY_ENTRIES_KEY);
  },
};
