// A bilateral set keeps the V1 shape. A unilateral set contains two independent sides.
export const SIDES = ["left", "right"];
const nonnegative = (value) => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
export function normalizeSet(set, completed = true) {
  if (set.sides) {
    const sides = Object.fromEntries(SIDES.map((side) => [side, normalizeSet({ ...set.sides[side], sides: undefined }, false)]));
    return { sides, completed: SIDES.every((side) => sides[side].completed) };
  }
  return { weight: nonnegative(set.weight), reps: Math.floor(nonnegative(set.reps)), completed: Boolean(set.completed ?? completed) };
}
export function parts(set) { return set.sides ? SIDES.map((side) => set.sides[side]) : [set]; }
export function setReps(set) { return parts(set).reduce((sum, part) => sum + (part.completed ? part.reps : 0), 0); }
export function setVolume(set) { return parts(set).reduce((sum, part) => sum + (part.completed ? part.weight * part.reps : 0), 0); }
export function resetSet(set) {
  const result = structuredClone(set);
  parts(result).forEach((part) => { part.completed = false; });
  result.completed = false;
  return result;
}
export function finishSet(set) {
  const result = structuredClone(set);
  parts(result).forEach((part) => { part.completed = true; });
  result.completed = true;
  return result;
}
