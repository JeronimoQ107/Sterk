const STORAGE_KEY = "gym-tracker:v0:workout-entries";

function readEntries() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export const storage = {
  getExerciseHistory(routineId, exercise) {
    return readEntries()
      .filter((entry) => entry.routineId === routineId && entry.exercise === exercise)
      .sort((a, b) => new Date(b.recordedAt) - new Date(a.recordedAt));
  },

  getLastExerciseEntry(routineId, exercise) {
    return this.getExerciseHistory(routineId, exercise)[0] || null;
  },

  saveWorkoutEntry(entry) {
    const entries = readEntries();
    entries.push(entry);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    return entry;
  },
};
