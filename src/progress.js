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
// One observation per session: highest completed load, with reps from that same set.
// Never combine an old unspecified side with left/right records.
export function exerciseSeries(sessions, exerciseId, side = 'both') {
  return sessions.flatMap((session) => {
    const candidates = session.entries.filter((entry) => entry.exerciseId === exerciseId).flatMap((entry) => entry.sets.flatMap((set) => {
      const part = side === 'both' ? (!set.sides ? set : null) : set.sides?.[side];
      return part?.completed && part.reps > 0 ? [part] : [];
    }));
    candidates.sort((a, b) => b.weight - a.weight || b.reps - a.reps);
    return candidates.length ? [{ date: session.startedAt, sessionId: session.id, weight: candidates[0].weight, reps: candidates[0].reps }] : [];
  }).sort((a, b) => new Date(a.date) - new Date(b.date));
}
