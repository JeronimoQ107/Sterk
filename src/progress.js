import { parts } from './sets.js';

export function inPeriod(sessions, days, now = new Date()) {
  if (days === 'all') return sessions;
  const start = new Date(now); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - Number(days) + 1);
  return sessions.filter((session) => { const date = new Date(session.startedAt); return date >= start && date <= now; });
}
export function completedParts(set) { return parts(set).filter((part) => part.completed && part.reps > 0); }
export function overview(sessions) {
  let sets = 0;
  const dates = new Set();
  for (const session of sessions) {
    const date = new Date(session.startedAt);
    if (Number.isFinite(+date)) dates.add(`${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`);
    for (const entry of session.entries) sets += entry.sets.filter((set) => completedParts(set).length).length;
  }
  return { sessions: sessions.length, sets, days: dates.size };
}
export function exerciseOptions(sessions) {
  const options = new Map();
  for (const session of sessions) for (const entry of session.entries) {
    if (entry.sets.some((set) => completedParts(set).length)) options.set(entry.exerciseId, entry.exercise);
  }
  return [...options].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
}
export function availableSides(sessions, exerciseId) {
  const result = new Set();
  for (const session of sessions) for (const entry of session.entries.filter((entry) => entry.exerciseId === exerciseId)) {
    for (const set of entry.sets) {
      if (set.sides) { for (const side of ['left', 'right']) if (set.sides[side]?.completed && set.sides[side].reps > 0) result.add(side); }
      else if (set.completed && set.reps > 0) result.add('both');
    }
  }
  return ['both', 'left', 'right'].filter((side) => result.has(side));
}

export function estimatedOneRepMax(weight, reps) {
  const load = Math.max(0, Number(weight) || 0);
  const repetitions = Math.max(0, Number(reps) || 0);
  if (!load || !repetitions) return 0;
  return repetitions === 1 ? load : load * (1 + repetitions / 30);
}

// One observation per session and registration type. Bilateral and sided records never mix.
export function exerciseSeries(sessions, exerciseId, side = 'both') {
  return sessions.flatMap((session) => {
    const candidates = session.entries.filter((entry) => entry.exerciseId === exerciseId).flatMap((entry) => entry.sets.flatMap((set) => {
      const part = side === 'both' ? (!set.sides ? set : null) : set.sides?.[side];
      return part?.completed && part.reps > 0 ? [part] : [];
    }));
    if (!candidates.length) return [];
    const best = [...candidates].sort((a, b) => estimatedOneRepMax(b.weight, b.reps) - estimatedOneRepMax(a.weight, a.reps) || b.weight - a.weight)[0];
    const heaviest = [...candidates].sort((a, b) => b.weight - a.weight || b.reps - a.reps)[0];
    const mostReps = [...candidates].sort((a, b) => b.reps - a.reps || b.weight - a.weight)[0];
    return [{
      date: session.startedAt,
      sessionId: session.id,
      weight: best.weight,
      reps: best.reps,
      estimatedOneRepMax: estimatedOneRepMax(best.weight, best.reps),
      maxWeight: heaviest.weight,
      maxWeightReps: heaviest.reps,
      maxReps: mostReps.reps,
      maxRepsWeight: mostReps.weight,
      volume: candidates.reduce((sum, part) => sum + part.weight * part.reps, 0),
      totalReps: candidates.reduce((sum, part) => sum + part.reps, 0),
      setCount: candidates.length,
    }];
  }).sort((a, b) => new Date(a.date) - new Date(b.date));
}

export function personalRecords(points) {
  if (!points.length) return null;
  const highest = (field) => [...points].sort((a, b) => b[field] - a[field])[0];
  return {
    performance: highest('estimatedOneRepMax'),
    weight: highest('maxWeight'),
    reps: highest('maxReps'),
    volume: highest('volume'),
  };
}

export function muscleGroupSets(sessions) {
  const groups = new Map();
  for (const session of sessions) for (const entry of session.entries) {
    const completed = entry.sets.filter((set) => completedParts(set).length).length;
    if (completed) groups.set(entry.muscleGroup || 'other', (groups.get(entry.muscleGroup || 'other') || 0) + completed);
  }
  return [...groups].map(([id, sets]) => ({ id, sets })).sort((a, b) => b.sets - a.sets || a.id.localeCompare(b.id));
}
