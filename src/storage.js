import { DEFAULT_EXERCISES, LEGACY_ROUTINES } from "./data.js";
import { normalizeSet, setReps, setVolume, parts } from "./sets.js";

const KEYS = Object.freeze({
  entries: "sterk:v1:workout-entries",
  activeSession: "sterk:v1:active-session",
  sessions: "sterk:v1:completed-sessions",
  settings: "sterk:v1:settings",
  customExercises: "sterk:v1:custom-exercises",
});

const LEGACY_ENTRIES_KEY = "gym-tracker:v0:workout-entries";

const KEY_LABELS = Object.freeze({
  [KEYS.entries]: "historial de ejercicios",
  [KEYS.activeSession]: "sesión en curso",
  [KEYS.sessions]: "entrenamientos finalizados",
  [KEYS.settings]: "preferencias",
  [KEYS.customExercises]: "ejercicios propios",
});

// DATA-02: una clave que no se puede leer no equivale a datos ausentes. Se conserva su valor
// original y ninguna escritura la reemplaza hasta que vuelva a leerse correctamente.
export class StorageReadError extends Error {
  constructor(problems) {
    const labels = problems.map((problem) => problem.label).join(", ");
    super(`No se pudieron leer tus datos guardados (${labels}). Sterk no los modificará para no perderlos. Exporta una copia desde Ajustes y no borres la app.`);
    this.name = "StorageReadError";
    this.problems = problems;
  }
}

const problems = new Map();
const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
function invalidFormat() { throw new TypeError("Formato inesperado."); }
const listOfRecords = (value) => (Array.isArray(value) && value.every(isRecord) ? value : invalidFormat());
const SHAPES = {
  [KEYS.entries]: (value) => listOfRecords(value).map((entry) => normalizeEntry(entry)),
  [KEYS.activeSession]: (value) => (value === null || isRecord(value) ? normalizeActiveSession(value) : invalidFormat()),
  [KEYS.sessions]: listOfRecords,
  [KEYS.settings]: (value) => (isRecord(value) ? value : invalidFormat()),
  [KEYS.customExercises]: listOfRecords,
};

// Lee y valida una clave. Un fallo de acceso, un JSON inválido o un formato que no se puede
// normalizar se registra como problema y nunca se confunde con una clave vacía.
function inspect(key) {
  let raw;
  try {
    raw = localStorage.getItem(key);
  } catch (error) {
    return report(key, { reason: "access", error });
  }
  if (raw === null) {
    problems.delete(key);
    return { ok: true, raw, absent: true };
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    return report(key, { reason: "json", raw, error });
  }
  try {
    const value = SHAPES[key] ? SHAPES[key](parsed) : parsed;
    problems.delete(key);
    return { ok: true, raw, value };
  } catch (error) {
    return report(key, { reason: "format", raw, error });
  }
}

function report(key, details) {
  const problem = { key, label: KEY_LABELS[key] || key, ...details };
  problems.set(key, problem);
  return { ok: false, problem };
}

const publicProblem = ({ key, label, reason }) => ({ key, label, reason });

// Lectura para mostrar datos: ante un problema devuelve el valor por defecto sin escribir nada.
function read(key, fallback) {
  const result = inspect(key);
  return result.ok && !result.absent ? result.value : fallback;
}

function ensureReadable(keys) {
  const results = keys.map((key) => [key, inspect(key)]);
  const failed = results.filter(([, result]) => !result.ok).map(([, result]) => publicProblem(result.problem));
  if (failed.length) throw new StorageReadError(failed);
  return Object.fromEntries(results);
}

// Lectura para modificar: si la clave no se puede leer, la operación se detiene antes de escribir.
function readForUpdate(key, fallback) {
  const result = ensureReadable([key])[key];
  return result.absent ? fallback : result.value;
}

// Escribe varias claves como una unidad. Antes comprueba que todas siguen siendo legibles, y si una
// escritura falla restaura los valores originales de todas.
function commit(changes) {
  commitRaw(changes.map(([key, value]) => [key, value === undefined ? undefined : JSON.stringify(value)]));
}

// Igual que commit, con el texto exacto que se guarda en cada clave (undefined la elimina).
function commitRaw(changes) {
  const current = ensureReadable(changes.map(([key]) => key));
  try {
    changes.forEach(([key, raw]) => {
      if (raw === undefined) localStorage.removeItem(key);
      else localStorage.setItem(key, raw);
    });
  } catch (error) {
    changes.forEach(([key]) => {
      try {
        const { raw } = current[key];
        if (raw === null) localStorage.removeItem(key);
        else localStorage.setItem(key, raw);
      } catch {
        // Se intenta restaurar el resto de claves aunque una falle.
      }
    });
    throw error;
  }
  changes.forEach(([key]) => problems.delete(key));
}

function write(key, value) {
  commit([[key, value]]);
  return value;
}

function parseLocalDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  if (!match) return null;
  const [, year, month, day] = match.map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? { year, month, day }
    : null;
}

function moveToLocalDate(value, localDate) {
  const target = parseLocalDate(localDate);
  const original = new Date(value);
  if (!target || Number.isNaN(original.getTime())) return null;
  return new Date(target.year, target.month - 1, target.day, original.getHours(), original.getMinutes(), original.getSeconds(), original.getMilliseconds()).toISOString();
}

function localizedEntryDate(value) {
  const date = new Date(value);
  return {
    date: date.toLocaleDateString("es-CO"),
    time: date.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" }),
  };
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
    return entry.sets.map((set, index) => normalizeSet(set, entry.completedSets?.[index] ?? true));
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
    setCount: sets.filter((set) => parts(set).some((part) => part.completed)).length,
    repCount: sets.reduce((sum, set) => sum + setReps(set), 0),
    volume: sets.reduce((sum, set) => sum + setVolume(set), 0),
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

// DATA-03: claves que forman una copia completa de los datos, incluido el historial V0.
const SNAPSHOT_KEYS = Object.freeze([...Object.values(KEYS), LEGACY_ENTRIES_KEY]);

// Texto exacto de cada clave presente. Un error de acceso se propaga: sin lectura no hay copia.
function captureRaw() {
  const data = {};
  SNAPSHOT_KEYS.forEach((key) => {
    const raw = localStorage.getItem(key);
    if (raw !== null) data[key] = raw;
  });
  return data;
}

function validateSnapshotData(data) {
  const valid = isRecord(data) && Object.entries(data).every(([key, raw]) => {
    if (!SNAPSHOT_KEYS.includes(key) || typeof raw !== "string") return false;
    try {
      const parsed = JSON.parse(raw);
      if (SHAPES[key]) SHAPES[key](parsed);
      return true;
    } catch {
      return false;
    }
  });
  if (!valid) throw new Error("La copia está dañada y no se puede restaurar.");
}

// Estado de los datos al cargar esta versión, antes de que la migración V0 o la app escriban nada.
const startupData = (() => {
  try {
    return captureRaw();
  } catch {
    return null;
  }
})();

// La migración V0 solo ocurre si la clave V1 está ausente; un error de lectura no cuenta como ausencia.
try {
  if (localStorage.getItem(KEYS.entries) === null) {
    const legacy = JSON.parse(localStorage.getItem(LEGACY_ENTRIES_KEY));
    if (Array.isArray(legacy) && legacy.length) localStorage.setItem(KEYS.entries, JSON.stringify(legacy));
  }
} catch {
  // Sin migración: los datos V0 y V1 permanecen como estaban.
}

export const storage = {
  // Revisa de nuevo todas las claves y devuelve las que no se pueden leer.
  checkData() {
    Object.values(KEYS).forEach((key) => inspect(key));
    return this.getStorageProblems();
  },
  // Problemas detectados en las últimas lecturas, sin volver a leer el almacenamiento.
  getStorageProblems() { return [...problems.values()].map(publicProblem); },
  // DATA-03: texto de las claves tal como estaban al arrancar (null si no se pudieron leer).
  getStartupData() { return startupData && { ...startupData }; },
  // Texto actual de todas las claves; falla si alguna no se puede leer.
  readRawData() {
    const current = ensureReadable(SNAPSHOT_KEYS);
    return Object.fromEntries(SNAPSHOT_KEYS.filter((key) => current[key].raw !== null).map((key) => [key, current[key].raw]));
  },
  // Falla si una copia está incompleta o dañada, sin tocar los datos.
  validateRawData(data) { validateSnapshotData(data); },
  // Sustituye todas las claves por el texto exacto de una copia; las ausentes en la copia se eliminan.
  restoreRawData(data) {
    validateSnapshotData(data);
    commitRaw(SNAPSHOT_KEYS.map((key) => [key, data[key]]));
    this.checkData();
  },
  getExerciseCatalog({ includeArchived = false } = {}) {
    const catalog = catalogWith();
    return includeArchived ? catalog : catalog.filter((exercise) => !exercise.archived);
  },
  saveCustomExercise(exercise) {
    const custom = readForUpdate(KEYS.customExercises, []);
    const normalized = { ...exercise, custom: true, archived: Boolean(exercise.archived) };
    const duplicate = catalogWith(custom).find((item) => item.id !== normalized.id && item.name.toLocaleLowerCase() === normalized.name.toLocaleLowerCase());
    if (duplicate) throw new Error("Ya existe un ejercicio con ese nombre.");
    const index = custom.findIndex((item) => item.id === normalized.id);
    if (index >= 0) custom[index] = normalized;
    else custom.push(normalized);
    return write(KEYS.customExercises, custom);
  },
  archiveCustomExercise(id) {
    const custom = readForUpdate(KEYS.customExercises, []);
    const item = custom.find((exercise) => exercise.id === id);
    if (item) item.archived = true;
    return write(KEYS.customExercises, custom);
  },
  getEntries() { return read(KEYS.entries, []); },
  getExerciseHistory(exerciseId, exerciseName) {
    return this.getEntries().filter((entry) => entry.exerciseId === exerciseId || entry.exercise === exerciseName).sort((a, b) => new Date(b.recordedAt) - new Date(a.recordedAt));
  },
  getLastExerciseEntry(exerciseId, exerciseName, excludeSessionId = null) {
    return this.getExerciseHistory(exerciseId, exerciseName).find((entry) => !excludeSessionId || entry.sessionId !== excludeSessionId) || null;
  },
  saveWorkoutEntry(entry) {
    const entries = readForUpdate(KEYS.entries, []);
    const normalized = normalizeEntry(entry);
    const index = entries.findIndex((item) => item.id === normalized.id);
    if (index >= 0) entries[index] = normalized;
    else entries.push(normalized);
    return write(KEYS.entries, entries);
  },
  deleteWorkoutEntry(id) {
    return write(KEYS.entries, readForUpdate(KEYS.entries, []).filter((entry) => entry.id !== id));
  },
  getActiveSession() { return read(KEYS.activeSession, null); },
  saveActiveSession(session) { return write(KEYS.activeSession, normalizeActiveSession(session)); },
  clearActiveSession() { commit([[KEYS.activeSession, undefined]]); },
  getCompletedSessions() { return read(KEYS.sessions, []); },
  saveCompletedSession(session) {
    const sessions = readForUpdate(KEYS.sessions, []);
    const index = sessions.findIndex((item) => item.id === session.id);
    if (index >= 0) sessions[index] = session;
    else sessions.push(session);
    return write(KEYS.sessions, sessions);
  },
  changeSessionDate(sessionId, localDate, entryIds = []) {
    if (!parseLocalDate(localDate)) throw new Error("La fecha del entrenamiento no es válida.");
    const ids = new Set(entryIds);
    // Se leen las tres claves antes de escribir para no dejar la sesión y sus entradas con fechas distintas.
    const current = ensureReadable([KEYS.entries, KEYS.sessions, KEYS.activeSession]);
    const valueOf = (key, fallback) => (current[key].absent ? fallback : current[key].value);

    const entries = valueOf(KEYS.entries, []).map((entry) => {
      if (entry.sessionId !== sessionId && !ids.has(entry.id)) return entry;
      const recordedAt = moveToLocalDate(entry.recordedAt, localDate);
      return recordedAt ? { ...entry, recordedAt, ...localizedEntryDate(recordedAt) } : entry;
    });

    const sessions = valueOf(KEYS.sessions, []).map((session) => {
      if (session.id !== sessionId) return session;
      const startedAt = moveToLocalDate(session.startedAt, localDate);
      if (!startedAt) return session;
      const durationSeconds = Math.max(0, Number(session.durationSeconds ?? Number(session.durationMinutes || 0) * 60));
      const endedAt = durationSeconds
        ? new Date(new Date(startedAt).getTime() + durationSeconds * 1000).toISOString()
        : moveToLocalDate(session.endedAt, localDate) || startedAt;
      return { ...session, startedAt, endedAt };
    });

    const changes = [[KEYS.entries, entries], [KEYS.sessions, sessions]];
    const active = valueOf(KEYS.activeSession, null);
    if (active?.id === sessionId) {
      const startedAt = moveToLocalDate(active.startedAt, localDate);
      if (startedAt) changes.push([KEYS.activeSession, normalizeActiveSession({ ...active, clockStartedAt: active.clockStartedAt || active.startedAt, startedAt })]);
    }
    commit(changes);

    return {
      activeSession: this.getActiveSession(),
      completedSession: this.getCompletedSessions().find((session) => session.id === sessionId) || null,
    };
  },
  deleteSession(sessionId, entryIds = []) {
    const ids = new Set(entryIds);
    const entries = readForUpdate(KEYS.entries, []);
    const sessions = readForUpdate(KEYS.sessions, []);
    commit([
      [KEYS.entries, entries.filter((entry) => entry.sessionId !== sessionId && !ids.has(entry.id))],
      [KEYS.sessions, sessions.filter((session) => session.id !== sessionId)],
    ]);
  },
  getSettings() { return { trackingMode: "exercise", ...read(KEYS.settings, {}) }; },
  saveSettings(settings) { return write(KEYS.settings, { trackingMode: "exercise", ...readForUpdate(KEYS.settings, {}), ...settings }); },
  exportData() {
    const backup = { app: "Sterk", version: 4, exportedAt: new Date().toISOString(), entries: this.getEntries(), completedSessions: this.getCompletedSessions(), activeSession: this.getActiveSession(), settings: this.getSettings(), customExercises: read(KEYS.customExercises, []) };
    // Si alguna clave no se puede leer, la copia incluye su texto original para poder recuperarla a mano.
    const unreadable = [...problems.values()].filter((problem) => typeof problem.raw === "string");
    if (unreadable.length) backup.unreadableData = Object.fromEntries(unreadable.map((problem) => [problem.key, problem.raw]));
    return backup;
  },
  importData(data) {
    if (!data || data.app !== "Sterk" || ![1, 2, 3, 4].includes(data.version) || !Array.isArray(data.entries)) throw new Error("El archivo no es un respaldo válido de Sterk.");
    const customExercises = data.version >= 3 && Array.isArray(data.customExercises) ? data.customExercises : [];
    const catalog = catalogWith(customExercises);
    // Se preparan todos los valores antes de escribir; restaurar no reemplaza datos ilegibles.
    commit([
      [KEYS.customExercises, customExercises],
      [KEYS.entries, data.entries.map((entry) => normalizeEntry(entry, catalog))],
      [KEYS.sessions, Array.isArray(data.completedSessions) ? data.completedSessions : []],
      [KEYS.settings, data.settings || { trackingMode: "exercise" }],
      [KEYS.activeSession, data.activeSession ? normalizeActiveSession(data.activeSession, catalog) : undefined],
    ]);
  },
  clearAll() {
    commit(Object.values(KEYS).map((key) => [key, undefined]));
    localStorage.removeItem(LEGACY_ENTRIES_KEY);
  },
};
