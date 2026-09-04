export const CATEGORY_ORDER = Object.freeze(["push", "pull", "legs"]);

export const CATEGORY_LABELS = Object.freeze({
  push: "Push",
  pull: "Pull",
  legs: "Legs",
});

export const MUSCLE_GROUPS = Object.freeze({
  chest: "Pecho",
  back: "Espalda",
  shoulders: "Hombros",
  rearDelts: "Hombro posterior",
  triceps: "Tríceps",
  biceps: "Bíceps",
  quadriceps: "Cuádriceps",
  hamstrings: "Isquiotibiales",
  glutes: "Glúteos",
  calves: "Pantorrillas",
});

export const DEFAULT_EXERCISES = Object.freeze([
  { id: "bench-press", name: "Bench Press", muscleGroup: "chest", category: "push" },
  { id: "incline-press", name: "Incline Press", muscleGroup: "chest", category: "push" },
  { id: "shoulder-press", name: "Shoulder Press", muscleGroup: "shoulders", category: "push" },
  { id: "triceps-extension", name: "Triceps Extension", muscleGroup: "triceps", category: "push" },
  { id: "lat-pulldown", name: "Lat Pulldown", muscleGroup: "back", category: "pull" },
  { id: "seated-row", name: "Seated Row", muscleGroup: "back", category: "pull" },
  { id: "biceps-curl", name: "Biceps Curl", muscleGroup: "biceps", category: "pull" },
  { id: "rear-delt-fly", name: "Rear Delt Fly", muscleGroup: "rearDelts", category: "pull" },
  { id: "power-squat", name: "Power Squat", muscleGroup: "quadriceps", category: "legs" },
  { id: "leg-extension", name: "Leg Extension", muscleGroup: "quadriceps", category: "legs" },
  { id: "leg-curl", name: "Leg Curl", muscleGroup: "hamstrings", category: "legs" },
  { id: "calf-raise", name: "Calf Raise", muscleGroup: "calves", category: "legs" },
]);

export const LEGACY_ROUTINES = Object.freeze({
  push: ["Bench Press", "Incline Press", "Shoulder Press", "Triceps Extension"],
  pull: ["Lat Pulldown", "Seated Row", "Biceps Curl", "Rear Delt Fly"],
  legs: ["Power Squat", "Leg Extension", "Leg Curl", "Calf Raise"],
});

export const DEFAULT_ENTRY = Object.freeze({
  weight: 25,
  reps: [10, 10, 10],
});

export function categoryLabel(categories) {
  const ordered = CATEGORY_ORDER.filter((category) => categories.includes(category));
  if (ordered.length === 3) return "Full Body";
  return ordered.map((category) => CATEGORY_LABELS[category]).join(" + ") || "Entrenamiento";
}
