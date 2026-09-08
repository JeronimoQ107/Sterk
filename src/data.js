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
  ...[
    ["bayesian-curl", "Bayesian Curl", "biceps", "pull", "curl bayesiano polea brazo"],
    ["hammer-curl", "Hammer Curl", "biceps", "pull", "curl martillo mancuernas"],
    ["preacher-curl", "Preacher Curl", "biceps", "pull", "curl predicador scott"],
    ["incline-dumbbell-curl", "Incline Dumbbell Curl", "biceps", "pull", "curl inclinado mancuernas"],
    ["cable-curl", "Cable Curl", "biceps", "pull", "curl polea cable"],
    ["concentration-curl", "Concentration Curl", "biceps", "pull", "curl concentrado"],
    ["ez-bar-curl", "EZ Bar Curl", "biceps", "pull", "curl barra z"],
    ["dumbbell-bench-press", "Dumbbell Bench Press", "chest", "push", "press banca mancuernas plano"],
    ["incline-dumbbell-press", "Incline Dumbbell Press", "chest", "push", "press inclinado mancuernas"],
    ["chest-press-machine", "Chest Press Machine", "chest", "push", "press pecho maquina"],
    ["cable-fly", "Cable Fly", "chest", "push", "aperturas cruces poleas"],
    ["pec-deck", "Pec Deck", "chest", "push", "aperturas maquina mariposa"],
    ["push-up", "Push-Up", "chest", "push", "flexiones lagartijas"],
    ["chest-dip", "Chest Dip", "chest", "push", "fondos pecho paralelas"],
    ["lateral-raise", "Lateral Raise", "shoulders", "push", "elevaciones laterales mancuernas"],
    ["cable-lateral-raise", "Cable Lateral Raise", "shoulders", "push", "elevacion lateral polea"],
    ["front-raise", "Front Raise", "shoulders", "push", "elevaciones frontales"],
    ["arnold-press", "Arnold Press", "shoulders", "push", "press arnold mancuernas"],
    ["face-pull", "Face Pull", "rearDelts", "pull", "tiron cara polea cuerda"],
    ["reverse-pec-deck", "Reverse Pec Deck", "rearDelts", "pull", "aperturas inversas maquina"],
    ["triceps-pushdown", "Triceps Pushdown", "triceps", "push", "extension triceps polea cuerda jalon"],
    ["overhead-triceps-extension", "Overhead Triceps Extension", "triceps", "push", "extension triceps sobre cabeza"],
    ["skull-crusher", "Skull Crusher", "triceps", "push", "press frances rompecraneos"],
    ["triceps-kickback", "Triceps Kickback", "triceps", "push", "patada triceps"],
    ["pull-up", "Pull-Up", "back", "pull", "dominadas pronas"],
    ["chin-up", "Chin-Up", "back", "pull", "dominadas supinas"],
    ["barbell-row", "Barbell Row", "back", "pull", "remo barra inclinado"],
    ["single-arm-dumbbell-row", "Single-Arm Dumbbell Row", "back", "pull", "remo mancuerna unilateral brazo"],
    ["chest-supported-row", "Chest Supported Row", "back", "pull", "remo pecho apoyado"],
    ["t-bar-row", "T-Bar Row", "back", "pull", "remo barra t"],
    ["straight-arm-pulldown", "Straight-Arm Pulldown", "back", "pull", "pullover polea brazos rectos"],
    ["barbell-squat", "Barbell Squat", "quadriceps", "legs", "sentadilla barra libre"],
    ["hack-squat", "Hack Squat", "quadriceps", "legs", "sentadilla hack maquina"],
    ["leg-press", "Leg Press", "quadriceps", "legs", "prensa piernas"],
    ["bulgarian-split-squat", "Bulgarian Split Squat", "quadriceps", "legs", "sentadilla bulgara unilateral"],
    ["lunge", "Lunge", "quadriceps", "legs", "zancadas desplantes"],
    ["goblet-squat", "Goblet Squat", "quadriceps", "legs", "sentadilla copa mancuerna"],
    ["romanian-deadlift", "Romanian Deadlift", "hamstrings", "legs", "peso muerto rumano rdl"],
    ["seated-leg-curl", "Seated Leg Curl", "hamstrings", "legs", "curl femoral sentado"],
    ["lying-leg-curl", "Lying Leg Curl", "hamstrings", "legs", "curl femoral acostado tumbado"],
    ["hip-thrust", "Hip Thrust", "glutes", "legs", "empuje cadera puente gluteos"],
    ["cable-kickback", "Cable Kickback", "glutes", "legs", "patada gluteo polea"],
    ["hip-abduction", "Hip Abduction", "glutes", "legs", "abduccion cadera abductores"],
    ["seated-calf-raise", "Seated Calf Raise", "calves", "legs", "elevacion pantorrillas sentado gemelos"],
    ["standing-calf-raise", "Standing Calf Raise", "calves", "legs", "elevacion pantorrillas de pie gemelos"],
  ].map(([id, name, muscleGroup, category, aliases]) => ({ id, name, muscleGroup, category, aliases })),
]);

const LEGACY_ALIASES = {
  "bench-press": "press banca pecho plano barra", "incline-press": "press inclinado pecho",
  "shoulder-press": "press hombros militar", "triceps-extension": "extension triceps",
  "lat-pulldown": "jalon pecho dorsal polea", "seated-row": "remo sentado polea",
  "biceps-curl": "curl biceps", "rear-delt-fly": "aperturas hombro posterior pajaros",
  "power-squat": "sentadilla maquina", "leg-extension": "extension piernas cuadriceps",
  "leg-curl": "curl femoral isquiotibiales", "calf-raise": "elevacion pantorrillas gemelos",
};
export function searchText(value) { return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase(); }
export function matchesExercise(exercise, query) {
  const text = searchText([exercise.name, exercise.aliases || "", LEGACY_ALIASES[exercise.id] || "", MUSCLE_GROUPS[exercise.muscleGroup] || ""].join(" "));
  return searchText(query).trim().split(/\s+/).every((word) => text.includes(word));
}

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
