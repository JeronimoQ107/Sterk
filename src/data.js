export const ROUTINES = Object.freeze({
  push: {
    name: "Push",
    exercises: ["Bench Press", "Incline Press", "Shoulder Press", "Triceps Extension"],
  },
  pull: {
    name: "Pull",
    exercises: ["Lat Pulldown", "Seated Row", "Biceps Curl", "Rear Delt Fly"],
  },
  legs: {
    name: "Legs",
    exercises: ["Power Squat", "Leg Extension", "Leg Curl", "Calf Raise"],
  },
});

export const DEFAULT_ENTRY = Object.freeze({
  weight: 25,
  reps: [10, 10, 10],
});
