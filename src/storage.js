const KEYS = Object.freeze({
  entries: "sterk:v1:workout-entries",
  activeSession: "sterk:v1:active-session",
  sessions: "sterk:v1:completed-sessions",
  settings: "sterk:v1:settings",
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

function normalizeEntry(entry) {
  const sets = normalizeSets(entry);
  return {
    ...entry,
    sets,
    weight: sets[0]?.weight ?? 0,
    reps: sets.map((set) => set.reps),
    completedSets: sets.map((set) => set.completed),
    setCount: sets.length,
    volume: sets.reduce((sum, set) => sum + set.weight * set.reps, 0),
  };
}

function normalizeActiveSession(session) {
  if (!session || !Array.isArray(session.exercises)) return session;
  return {
    ...session,
    exercises: session.exercises.map((exercise) => ({
      ...exercise,
      sets: normalizeSets(exercise),
    })),
  };
}

if (localStorage.getItem(KEYS.entries) === null) {
  const legacy = read(LEGACY_ENTRIES_KEY, []);
  if (Array.isArray(legacy) && legacy.length) write(KEYS.entries, legacy);
}

export const storage = {
  getEntries() {
    const entries = read(KEYS.entries, []);
    return Array.isArray(entries) ? entries.map(normalizeEntry) : [];
  },
  getExerciseHistory(routineId, exercise) {
    return this.getEntries().filter((entry) => entry.routineId === routineId && entry.exercise === exercise).sort((a, b) => new Date(b.recordedAt) - new Date(a.recordedAt));
  },
  getLastExerciseEntry(routineId, exercise) {
    return this.getExerciseHistory(routineId, exercise)[0] || null;
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
    return { app: "Sterk", version: 2, exportedAt: new Date().toISOString(), entries: this.getEntries(), completedSessions: this.getCompletedSessions(), activeSession: this.getActiveSession(), settings: this.getSettings() };
  },
  importData(data) {
    if (!data || data.app !== "Sterk" || ![1, 2].includes(data.version) || !Array.isArray(data.entries)) throw new Error("El archivo no es un respaldo válido de Sterk.");
    write(KEYS.entries, data.entries.map(normalizeEntry));
    write(KEYS.sessions, Array.isArray(data.completedSessions) ? data.completedSessions : []);
    write(KEYS.settings, data.settings || { trackingMode: "exercise" });
    if (data.activeSession) write(KEYS.activeSession, normalizeActiveSession(data.activeSession));
    else this.clearActiveSession();
  },
  clearAll() {
    Object.values(KEYS).forEach((key) => localStorage.removeItem(key));
    localStorage.removeItem(LEGACY_ENTRIES_KEY);
  },
};
