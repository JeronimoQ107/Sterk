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

if (localStorage.getItem(KEYS.entries) === null) {
  const legacy = read(LEGACY_ENTRIES_KEY, []);
  if (Array.isArray(legacy) && legacy.length) write(KEYS.entries, legacy);
}

export const storage = {
  getEntries() {
    const entries = read(KEYS.entries, []);
    return Array.isArray(entries) ? entries : [];
  },
  getExerciseHistory(routineId, exercise) {
    return this.getEntries().filter((entry) => entry.routineId === routineId && entry.exercise === exercise).sort((a, b) => new Date(b.recordedAt) - new Date(a.recordedAt));
  },
  getLastExerciseEntry(routineId, exercise) {
    return this.getExerciseHistory(routineId, exercise)[0] || null;
  },
  saveWorkoutEntry(entry) {
    const entries = this.getEntries();
    const index = entries.findIndex((item) => item.id === entry.id);
    if (index >= 0) entries[index] = entry;
    else entries.push(entry);
    return write(KEYS.entries, entries);
  },
  deleteWorkoutEntry(id) {
    return write(KEYS.entries, this.getEntries().filter((entry) => entry.id !== id));
  },
  getActiveSession() { return read(KEYS.activeSession, null); },
  saveActiveSession(session) { return write(KEYS.activeSession, session); },
  clearActiveSession() { localStorage.removeItem(KEYS.activeSession); },
  getCompletedSessions() {
    const sessions = read(KEYS.sessions, []);
    return Array.isArray(sessions) ? sessions : [];
  },
  saveCompletedSession(session) {
    const sessions = this.getCompletedSessions();
    sessions.push(session);
    return write(KEYS.sessions, sessions);
  },
  getSettings() { return { trackingMode: "exercise", ...read(KEYS.settings, {}) }; },
  saveSettings(settings) { return write(KEYS.settings, { ...this.getSettings(), ...settings }); },
  exportData() {
    return { app: "Sterk", version: 1, exportedAt: new Date().toISOString(), entries: this.getEntries(), completedSessions: this.getCompletedSessions(), activeSession: this.getActiveSession(), settings: this.getSettings() };
  },
  importData(data) {
    if (!data || data.app !== "Sterk" || data.version !== 1 || !Array.isArray(data.entries)) throw new Error("El archivo no es un respaldo válido de Sterk.");
    write(KEYS.entries, data.entries);
    write(KEYS.sessions, Array.isArray(data.completedSessions) ? data.completedSessions : []);
    write(KEYS.settings, data.settings || { trackingMode: "exercise" });
    if (data.activeSession) write(KEYS.activeSession, data.activeSession);
    else this.clearActiveSession();
  },
  clearAll() {
    Object.values(KEYS).forEach((key) => localStorage.removeItem(key));
    localStorage.removeItem(LEGACY_ENTRIES_KEY);
  },
};
