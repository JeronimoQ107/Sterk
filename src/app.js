import { CATEGORY_LABELS, CATEGORY_ORDER, DEFAULT_ENTRY, EXERCISE_IMAGES, MUSCLE_GROUPS, categoryLabel, matchesExercise, searchText } from "./data.js";
import { storage } from "./storage.js";
import { createSnapshots } from "./snapshots.js";
import { APP_VERSION } from "./version.js";

import { SIDES, parts, countsPart, countsSet, setReps, resetSet } from "./sets.js";
import { openWeightPicker } from "./weight-picker.js";
import { bindWeightControl } from "./weight-control.js";
import { bindRepsControl } from "./reps-control.js";
import { openRepsPicker } from "./reps-picker.js";
import { homeDashboard, progressDashboard, settingsDashboard, plural, sessionSummary } from "./dashboard.js";
import { exerciseOptions } from "./progress.js";
import { icon } from "./icons.js";
import { escapeHtml, formatNumber, formatTotal, formatDayMonth } from "./format.js";

const app = document.querySelector("#app");
const toast = document.querySelector("#toast");
const importInput = document.querySelector("#import-data");
const state = { view: "home", session: null, exerciseIndex: 0, historySessionId: null, historyFilter: "all", historyQuery: "", completion: null, updateWaiting: false, builderSelection: [], builderQuery: "", adding: false };

const uid = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
const capitalize = (text) => text.charAt(0).toLocaleUpperCase("es-CO") + text.slice(1);
const formatDate = (value) => new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
const formatTime = (value) => new Intl.DateTimeFormat("es-CO", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
const inputDate = (value) => {
  const date = new Date(value);
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
};
const todayInputDate = () => inputDate(new Date());
const dateTimeOnWorkoutDate = (time, workoutDate) => {
  const clock = new Date(time);
  const date = new Date(workoutDate);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), clock.getHours(), clock.getMinutes(), clock.getSeconds(), clock.getMilliseconds()).toISOString();
};
const elapsedSeconds = (startedAt, endedAt = Date.now()) => Math.max(0, Math.floor((new Date(endedAt) - new Date(startedAt)) / 1000));
const formatDuration = (seconds) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remaining = seconds % 60;
  return [hours, minutes, remaining].map((value) => String(value).padStart(2, "0")).join(":");
};
const uniqueCategories = (items) => CATEGORY_ORDER.filter((category) => items.some((item) => item.category === category || item.categoryTags?.includes(category)));
const categoryKey = (categories) => CATEGORY_ORDER.filter((category) => categories.includes(category)).join("+");
function draft(index = state.exerciseIndex) { return state.session.exercises[index]; }
function entrySets(entry) { return entry.sets || (entry.reps || []).map((reps, index) => ({ weight: entry.weight || 0, reps, completed: entry.completedSets?.[index] ?? true })); }
function selectedExercises() { const catalog = storage.getExerciseCatalog(); return state.builderSelection.map((id) => catalog.find((exercise) => exercise.id === id)).filter(Boolean); }

function sideLabel(side, exercise = draft()) {
  const leg = exercise?.category === "legs";
  return side === "left" ? (leg ? "Pierna izquierda" : "Brazo izquierdo") : (leg ? "Pierna derecha" : "Brazo derecho");
}
function setDescription(set) {
  const describe = (part) => `${formatNumber(part.weight)} lb × ${part.reps}${part.completed === false ? " (pendiente)" : ""}`;
  return set.sides ? SIDES.map((side) => `${side === "left" ? "Izq." : "Der."} ${describe(set.sides[side])}`).join(" · ") : describe(set);
}
function editablePart(index, side) { const set = draft().sets[index]; return side ? set.sides[side] : set; }
function markEdited() {
  const current = draft();
  current.status = "pending";
  current.sets.forEach((set) => { if (set.sides) set.completed = SIDES.every((side) => set.sides[side].completed); });
}
// UX-02: cada serie es una fila de la lista (por lado, dos filas: I y D) con un solo marcador por fila.
function weightButton(part, index, side) {
  return `<button class="weight-value" role="spinbutton" aria-valuemin="0" aria-valuenow="${part.weight}" aria-valuetext="${part.weight} libras" aria-describedby="weight-help" data-edit-weight="${index}" data-side="${side}" aria-label="Peso${side ? ` ${sideLabel(side)}` : ""}, serie ${index + 1}"><span class="weight-neighbor" data-weight-offset="-2" aria-hidden="true">${part.weight >= 5 ? formatNumber(part.weight - 5) : ""}</span><span class="weight-neighbor" data-weight-offset="-1" data-weight-previous aria-hidden="true">${part.weight >= 2.5 ? formatNumber(part.weight - 2.5) : ""}</span><span data-weight-offset="0" data-weight-number>${formatNumber(part.weight)}</span><span class="weight-neighbor" data-weight-offset="1" data-weight-next aria-hidden="true">${formatNumber(part.weight + 2.5)}</span><span class="weight-neighbor" data-weight-offset="2" aria-hidden="true">${formatNumber(part.weight + 5)}</span></button>`;
}
function repsButton(part, index, side) {
  return `<button class="reps-value" role="spinbutton" aria-valuemin="0" aria-valuemax="999" aria-valuenow="${part.reps}" aria-valuetext="${part.reps} repeticiones" aria-describedby="weight-help" data-edit-reps="${index}" data-side="${side}" aria-label="Repeticiones${side ? ` ${sideLabel(side)}` : ""}, serie ${index + 1}"><span data-reps-offset="-2" aria-hidden="true">${part.reps >= 2 ? part.reps - 2 : ""}</span><span data-reps-offset="-1" aria-hidden="true">${part.reps >= 1 ? part.reps - 1 : ""}</span><span data-reps-offset="0">${part.reps}</span><span data-reps-offset="1" aria-hidden="true">${part.reps < 999 ? part.reps + 1 : ""}</span><span data-reps-offset="2" aria-hidden="true">${part.reps < 998 ? part.reps + 2 : ""}</span></button>`;
}
// Resultado de la misma serie (y lado) la última vez; solo cuenta lo que se marcó como hecho, con repeticiones (MET-01).
function previousPart(previousSets, index, side) {
  const set = previousSets?.[index];
  const part = !set ? null : side ? (set.sides ? set.sides[side] : set) : (set.sides ? null : set);
  return countsPart(part) ? part : null;
}
function renderSetRows(set, index, previousSets) {
  const row = (part, side = "") => {
    const previous = previousPart(previousSets, index, side);
    const label = `${side === "right" ? "" : index + 1}${side ? `<small>${side === "left" ? "I" : "D"}</small>` : ""}`;
    return `<div class="ex-row ${part.completed ? "done" : ""}" role="listitem"><span class="ex-n">${label}</span><span class="ex-prev">${previous ? `${formatNumber(previous.weight)} × ${previous.reps}` : "—"}</span>${weightButton(part, index, side)}${repsButton(part, index, side)}<button class="ex-check" data-toggle-set="${index}" ${side ? `data-side="${side}"` : ""} aria-pressed="${part.completed}" aria-label="${part.completed ? "Desmarcar" : "Completar"} serie ${index + 1}${side ? `, ${sideLabel(side)}` : ""}">${icon("check")}</button></div>`;
  };
  return set.sides ? SIDES.map((side) => row(set.sides[side], side)).join("") : row(set);
}
function sessionControls() {
  return `<div class="session-tools"><button data-action="add-exercises">${icon("plus")} Añadir ejercicio</button><button data-action="manage-session">${icon("edit")} Editar</button><button data-action="finish-session">Finalizar</button></div>`;
}
function renderEmptySession() {
  renderShell(`<section class="screen exercise-screen"><header class="detail-header"><button class="icon-button" data-action="leave-session" aria-label="Volver al inicio">${icon("left")}</button>${timer(state.session.clockStartedAt || state.session.startedAt)}</header><h1>Tu sesión sigue abierta</h1><p>Añade el próximo ejercicio cuando estés listo.</p>${sessionControls()}</section>`);
}
function openSessionEditor() {
  const dialog = document.createElement("dialog");
  dialog.className = "session-editor";
  dialog.setAttribute("aria-label", "Editar entrenamiento");
  const draw = () => {
    dialog.innerHTML = `<h2>Tu entrenamiento</h2><label class="session-date-field"><span>Fecha del entrenamiento</span><input type="date" data-session-date value="${inputDate(state.session.startedAt)}" max="${todayInputDate()}"><small>Úsala para registrar un entrenamiento anterior.</small></label>${state.session.exercises.map((exercise, index) => `<div class="selected-row"><span>${index + 1}</span><strong>${escapeHtml(exercise.exercise)}</strong><button data-move="${index}" data-direction="-1" ${index === 0 ? "disabled" : ""} aria-label="Subir ${escapeHtml(exercise.exercise)}">${icon("up")}</button><button data-move="${index}" data-direction="1" ${index === state.session.exercises.length - 1 ? "disabled" : ""} aria-label="Bajar ${escapeHtml(exercise.exercise)}">${icon("down")}</button><button data-remove="${index}" aria-label="Quitar ${escapeHtml(exercise.exercise)}">${icon("close")}</button></div>`).join("") || "<p>No hay ejercicios. Puedes añadir más.</p>"}<button class="primary-button static" data-close>Listo</button>`;
  };
  dialog.addEventListener("change", (event) => {
    if (!event.target.matches?.("[data-session-date]")) return;
    try {
      changeActiveSessionDate(event.target.value);
      draw();
      showToast("Fecha actualizada");
    } catch (error) {
      alert(error.message);
      draw();
    }
  });
  dialog.addEventListener("click", (event) => {
    if (event.target.closest("[data-close]")) return dialog.close();
    const move = event.target.closest("[data-move]");
    const remove = event.target.closest("[data-remove]");
    const current = draft();
    if (move) {
      const from = Number(move.dataset.move), to = from + Number(move.dataset.direction);
      if (to < 0 || to >= state.session.exercises.length) return;
      [state.session.exercises[from], state.session.exercises[to]] = [state.session.exercises[to], state.session.exercises[from]];
    } else if (remove) {
      const index = Number(remove.dataset.remove), exercise = state.session.exercises[index];
      if (!confirm(`¿Quitar ${exercise.exercise} de esta sesión? Se eliminarán sus series y su registro en esta sesión. El historial anterior se conserva.`)) return;
      if (exercise.entryId) storage.deleteWorkoutEntry(exercise.entryId);
      state.session.exercises.splice(index, 1);
    } else return;
    state.exerciseIndex = Math.max(0, state.session.exercises.indexOf(current));
    persistSession(); render(); draw();
  });
  dialog.addEventListener("close", () => dialog.remove());
  draw(); document.body.append(dialog); dialog.showModal();
}
function handleSessionClick(event) {
  const action = event.target.closest("[data-action]")?.dataset.action;
  if (action === "create-custom") {
    const details = app.querySelector(".custom-exercise"); details.open = true;
    details.querySelector("input").focus(); details.scrollIntoView({ block: "center", behavior: "smooth" }); return true;
  }
  if (action === "add-exercises") {
    commitCurrentExercise();
    state.adding = true; state.builderSelection = []; state.builderQuery = ""; state.view = "builder"; persistSession(); render(); return true;
  }
  if (action === "manage-session") { openSessionEditor(); return true; }
  if (action === "exercise-menu") { openExerciseMenu(); return true; }
  if (action === "copy-sides") {
    draft().sets.forEach((set) => { if (set.sides) { set.sides.right.weight = set.sides.left.weight; set.sides.right.reps = set.sides.left.reps; } });
    markEdited(); persistSession(); render(); return true;
  }
  if (action === "finish-session") {
    commitCurrentExercise();
    if (state.session.exercises.some((exercise) => exercise.status === "pending")) { alert("Marca al menos una serie u omite los ejercicios pendientes antes de finalizar. También puedes quitarlos desde Editar entrenamiento."); return true; }
    if (!storage.getEntries().some((entry) => entry.sessionId === state.session.id)) {
      if (confirm("No hay ejercicios registrados. ¿Cerrar esta sesión sin guardarla en el historial?")) { storage.clearActiveSession(); goHome(); }
      return true;
    }
    if (confirm("¿Finalizar el entrenamiento?")) completeSession(); return true;
  }
  if (action === "toggle-unilateral") {
    const current = draft();
    if (current.unilateral) {
      if (!confirm("¿Dejar de registrar por lado? Se conservarán los valores izquierdos y se eliminarán los derechos de este ejercicio en la sesión actual.")) { render(); return true; }
      current.sets = current.sets.map((set) => ({ ...set.sides.left }));
    } else {
      current.sets = current.sets.map((set) => ({ sides: { left: resetSet(set), right: resetSet(set) }, completed: false }));
    }
    current.unilateral = !current.unilateral; markEdited(); persistSession(); render(); return true;
  }
  const copy = event.target.closest("[data-copy-side]");
  if (copy) {
    const set = draft().sets[Number(copy.dataset.copySide)], from = copy.dataset.side, to = from === "left" ? "right" : "left";
    set.sides[to].weight = set.sides[from].weight; set.sides[to].reps = set.sides[from].reps;
    markEdited(); persistSession(); render(); return true;
  }
  return false;
}

app.addEventListener("toggle", (event) => {
  if (!event.target.matches?.(".catalog-group") || state.builderQuery) return;
  state.builderOpen ||= {}; state.builderOpen[event.target.dataset.group] = event.target.open;
}, true);

app.addEventListener("input", (event) => {
  if (event.target.id === "history-search") {
    state.historyQuery = event.target.value;
    const cursor = event.target.selectionStart;
    renderHistory();
    const search = app.querySelector("#history-search");
    search.focus(); search.setSelectionRange(cursor, cursor);
    return;
  }
  if (event.target.id !== "exercise-search") return;
  state.builderQuery = event.target.value;
  const catalog = storage.getExerciseCatalog();
  const items = [...app.querySelectorAll("[data-catalog-id]")];
  items.forEach((item) => { item.hidden = !matchesExercise(catalog.find((exercise) => exercise.id === item.dataset.catalogId), state.builderQuery); });
  app.querySelectorAll(".catalog-group").forEach((group) => { group.hidden = ![...group.querySelectorAll("[data-catalog-id]")].some((item) => !item.hidden); group.open = Boolean(state.builderQuery || state.builderOpen?.[group.dataset.group]); });
  app.querySelector("#search-empty").hidden = items.some((item) => !item.hidden);
  app.querySelector(".custom-exercise input[name=name]").value = state.builderQuery;
});

function newExerciseDraft(exercise) {
  const previous = storage.getLastExerciseEntry(exercise.id, exercise.name, state.session?.id);
  const sets = previous
    ? entrySets(previous).map(resetSet)
    : DEFAULT_ENTRY.reps.map((reps) => ({ weight: DEFAULT_ENTRY.weight, reps, completed: false }));
  return { exerciseId: exercise.id, exercise: exercise.name, muscleGroup: exercise.muscleGroup, category: exercise.category, unilateral: Boolean(sets[0]?.sides), sets, status: "pending", entryId: null };
}

function persistSession() {
  if (!state.session) return;
  state.session.exerciseIndex = state.exerciseIndex;
  state.session.categoryTags = uniqueCategories(state.session.exercises);
  storage.saveActiveSession(state.session);
}

function startSession() {
  const selected = selectedExercises();
  if (!selected.length) return;
  const startedAt = new Date().toISOString();
  state.session = { id: uid(), startedAt, clockStartedAt: startedAt, categoryTags: uniqueCategories(selected), trackingMode: "set", exerciseIndex: 0, exercises: selected.map(newExerciseDraft) };
  state.exerciseIndex = 0;
  state.view = "exercise";
  persistSession();
  render();
}

function resumeSession() {
  state.session = storage.getActiveSession();
  if (!state.session) return goHome();
  state.exerciseIndex = Math.max(0, Math.min(state.session.exerciseIndex || 0, state.session.exercises.length - 1));
  state.view = "exercise";
  render();
}

function goHome() { state.view = "home"; state.session = null; state.completion = null; render(); }
function timer(startedAt, className = "") { return `<span class="session-timer ${className}" data-session-start="${escapeHtml(startedAt)}">${formatDuration(elapsedSeconds(startedAt))}</span>`; }

function changeActiveSessionDate(localDate) {
  if (!localDate || localDate > todayInputDate()) throw new Error("Elige una fecha válida que no esté en el futuro.");
  storage.changeSessionDate(state.session.id, localDate);
  state.session = storage.getActiveSession();
}

// DATA-02: aviso permanente mientras alguna clave guardada no se pueda leer.
function storageWarning() {
  const problems = storage.getStorageProblems();
  if (!problems.length) return "";
  return `<section class="storage-warning" aria-labelledby="storage-warning-title"><h2 id="storage-warning-title">No se pudieron leer algunos datos</h2><p>Afecta a: ${escapeHtml(problems.map((problem) => problem.label).join(", "))}. Sterk los conserva sin modificarlos, por eso algunas acciones quedan bloqueadas. Exporta una copia y no borres la app.</p><button data-action="export">Exportar copia</button></section>`;
}

function renderShell(content, active = "") {
  content = content.replace(/^<section[^>]*>/, (opening) => `${opening}${storageWarning()}`);
  app.innerHTML = `${content}${!["exercise", "complete", "builder"].includes(state.view) ? `<nav class="bottom-nav" aria-label="Navegación principal"><button data-view="home" class="${active === "home" ? "active" : ""}"><span>${icon("home")}</span>Inicio</button><button data-view="history" class="${active === "history" ? "active" : ""}"><span>${icon("history")}</span>Historial</button><button data-view="progress" class="${active === "progress" ? "active" : ""}"><span>${icon("chart")}</span>Progreso</button><button data-view="settings" class="${active === "settings" ? "active" : ""}"><span>${icon("edit")}</span>Ajustes</button></nav>` : ""}`;
  updateTimers();
}

function renderHome() {
  const active = storage.getActiveSession();
  const activeLabel = active ? categoryLabel(uniqueCategories(active.exercises)) || "Entrenamiento" : "";
  const current = active?.exercises?.[Math.min(active.exerciseIndex || 0, active.exercises.length - 1)];
  const today = capitalize(new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "long" }).format(new Date()));
  const update = state.updateWaiting ? `<button class="ui-banner" data-action="update-app">Hay una versión nueva de Sterk. Toca para actualizar.</button>` : "";
  const start = active
    ? `<h2 class="ui-group-header">Entrenamiento en curso</h2><div class="ui-group"><div class="ui-row"><span class="ui-row-main"><strong>${escapeHtml(activeLabel)}</strong><small>${escapeHtml(current?.exercise || "Sin ejercicios")}</small></span><span class="ui-value">${timer(active.clockStartedAt || active.startedAt)}</span></div></div><button class="ui-button" data-action="resume">Continuar entrenamiento</button>`
    : `<button class="ui-button" data-action="new-session">Empezar entrenamiento</button>`;
  const otherActions = active ? `<div class="ui-group ui-group-end"><button class="ui-row ui-row-link" data-action="new-session">Empezar otro entrenamiento</button><button class="ui-row ui-row-danger" data-action="discard-session">Descartar el entrenamiento en curso</button></div>` : "";
  renderShell(`<section class="screen ui-screen home-screen"><header class="ui-title"><h1>Sterk</h1><p>${today}</p></header>${update}${start}${homeDashboard(getHistorySessions())}${otherActions}</section>`, "home");
}

function renderBuilder() {
  const catalog = storage.getExerciseCatalog();
  const visible = catalog.filter((exercise) => !state.adding || !state.session.exercises.some((item) => item.exerciseId === exercise.id));
  const groups = [...new Set(visible.map((exercise) => exercise.muscleGroup))];
  const selected = selectedExercises();
  const rows = (items) => items.map((exercise) => {
    const isSelected = state.builderSelection.includes(exercise.id);
    const image = EXERCISE_IMAGES[exercise.id];
    const initials = exercise.name.split(/[\s-]+/).map((part) => part[0] || '').join('').slice(0, 2).toUpperCase();
    return `<article class="catalog-item ${image ? 'illustrated' : ''} ${isSelected ? 'selected' : ''}" data-catalog-id="${escapeHtml(exercise.id)}" ${matchesExercise(exercise, state.builderQuery) ? '' : 'hidden'}><button class="catalog-select" data-select-exercise="${escapeHtml(exercise.id)}" aria-pressed="${isSelected}"><span class="catalog-thumbnail${image ? '' : ' image-pending'}">${image ? `<img src="${image}" alt="" loading="lazy">` : escapeHtml(initials)}</span><span class="catalog-copy"><strong>${escapeHtml(exercise.name)}</strong><small>${escapeHtml(CATEGORY_LABELS[exercise.category])}</small></span><span class="selection-mark">${icon(isSelected ? 'check' : 'plus')}</span></button>${exercise.custom ? `<button class="catalog-archive" data-archive-exercise="${escapeHtml(exercise.id)}" aria-label="Archivar ${escapeHtml(exercise.name)}">${icon('close')}</button>` : ''}</article>`;
  }).join('');
  renderShell(`<section class="screen ui-screen builder-screen"><nav class="ui-nav"><button class="ui-back" data-action="cancel-builder">${icon('left')}<span>${state.adding ? 'Entrenamiento' : 'Inicio'}</span></button></nav><header class="ui-title"><h1>${state.adding ? 'Añadir ejercicios' : 'Nuevo entrenamiento'}</h1><p>Busca por nombre, en español o inglés, o explora por grupo muscular.</p></header><label class="ui-search"><span class="visually-hidden">Buscar ejercicio</span>${icon('search')}<input id="exercise-search" type="search" placeholder="Buscar ejercicio" value="${escapeHtml(state.builderQuery)}" autocomplete="off"></label>
  ${selected.length ? `<details class="selection-preview" open><summary>Tu selección <span>${plural(selected.length, 'ejercicio', 'ejercicios')}</span>${icon('down')}</summary>${selected.map((exercise, index) => `<div class="selected-row"><span>${index + 1}</span><strong>${escapeHtml(exercise.name)}</strong><button data-move-exercise="${index}" data-direction="-1" ${index === 0 ? 'disabled' : ''} aria-label="Subir ${escapeHtml(exercise.name)}">${icon('up')}</button><button data-move-exercise="${index}" data-direction="1" ${index === selected.length - 1 ? 'disabled' : ''} aria-label="Bajar ${escapeHtml(exercise.name)}">${icon('down')}</button><button data-remove-exercise="${escapeHtml(exercise.id)}" aria-label="Quitar ${escapeHtml(exercise.name)}">${icon('close')}</button></div>`).join('')}</details>` : ''}
  <div class="exercise-catalog grouped-catalog"><p class="ui-empty" id="search-empty" ${visible.some((exercise) => matchesExercise(exercise, state.builderQuery)) ? 'hidden' : ''}>No hay ningún ejercicio con ese nombre. <button class="ui-link" data-action="create-custom">Crear ejercicio</button></p>${groups.map((group) => { const items = visible.filter((exercise) => exercise.muscleGroup === group); return `<details class="catalog-group" data-group="${escapeHtml(group)}" ${state.builderQuery || state.builderOpen?.[group] ? 'open' : ''} ${items.some((exercise) => matchesExercise(exercise, state.builderQuery)) ? '' : 'hidden'}><summary><strong>${escapeHtml(MUSCLE_GROUPS[group] || group)}</strong><span>${plural(items.length, 'ejercicio', 'ejercicios')}</span>${icon('down')}</summary><div>${rows(items)}</div></details>`; }).join('')}</div>
  <details class="custom-exercise"><summary>${icon('plus')} Crear ejercicio propio</summary><form id="custom-exercise-form"><label>Nombre<input name="name" required maxlength="50" autocomplete="off" value="${escapeHtml(state.builderQuery)}"></label><label>Grupo muscular<select name="muscleGroup">${Object.entries(MUSCLE_GROUPS).map(([id, label]) => `<option value="${id}">${label}</option>`).join('')}</select></label><label>Categoría<select name="category">${CATEGORY_ORDER.map((id) => `<option value="${id}">${CATEGORY_LABELS[id]}</option>`).join('')}</select></label><button type="submit">Guardar ejercicio</button></form></details>
  ${selected.length ? `<footer class="ui-action-bar"><button class="ui-button" data-action="start-session">${state.adding ? 'Añadir al entrenamiento' : 'Empezar entrenamiento'} (${selected.length})</button></footer>` : ''}</section>`);
}
// UX-02: pantalla de ejercicio con aspecto de lista de iOS (docs/design-principles.md).
function renderExercise() {
  const current = draft();
  if (!current) return renderEmptySession();
  const previous = storage.getLastExerciseEntry(current.exerciseId, current.exercise, state.session.id);
  const previousSets = previous ? entrySets(previous) : null;
  const exercises = state.session.exercises;
  const index = state.exerciseIndex;
  const done = current.sets.filter((set) => parts(set).every(countsPart)).length;
  const total = current.sets.length;
  const statusLabel = { registered: "registrado", skipped: "omitido", pending: "pendiente" };
  const steps = exercises.map((exercise, position) => `<button data-jump="${position}" class="${position === index ? "now" : exercise.status}" ${position === index ? 'aria-current="step"' : ""} aria-label="${position + 1}. ${escapeHtml(exercise.exercise)}, ${statusLabel[exercise.status] || exercise.status}"></button>`).join("");
  const details = [escapeHtml(MUSCLE_GROUPS[current.muscleGroup] || current.muscleGroup), `${done} de ${total} ${total === 1 ? "serie" : "series"}`];
  if (current.status === "skipped") details.push("omitido");
  else if (!previous) details.push("primera vez");
  const before = exercises[index - 1], after = exercises[index + 1];
  const dateLabel = inputDate(state.session.startedAt) === todayInputDate() ? "" : `${formatDate(state.session.startedAt)} · `;
  renderShell(`<section class="screen exercise-screen ex"><header class="ex-nav"><button class="ex-back" data-action="leave-session" aria-label="Volver al inicio">${icon("left")}<span>${escapeHtml(categoryLabel(uniqueCategories(exercises)))}</span></button><span class="ex-clock">${dateLabel}${index + 1} de ${exercises.length} · ${timer(state.session.clockStartedAt || state.session.startedAt)}</span><button class="ex-more" data-action="exercise-menu" aria-label="Opciones del entrenamiento" aria-haspopup="dialog">${icon("more")}</button></header><nav class="ex-steps" aria-label="Ejercicios del entrenamiento">${steps}</nav><div class="ex-heading"><h1>${escapeHtml(current.exercise)}</h1><p>${details.join(" · ")}</p></div><div class="ex-cols" aria-hidden="true"><span>Serie</span><span>Anterior</span><span>lb</span><span>Reps</span><span></span></div><div class="ex-group ${current.status === "skipped" ? "skipped" : ""}" role="list" aria-label="Series">${current.sets.map((set, position) => renderSetRows(set, position, previousSets)).join("")}<button class="ex-add" data-action="add-set">${icon("plus")}<span>Añadir serie</span></button></div><p class="ex-note" id="weight-help">Desliza un número para ajustarlo o tócalo para escribir.</p><footer class="ex-bar">${before ? `<button class="ex-bar-prev" data-action="previous">${icon("left")}<span>${escapeHtml(before.exercise)}</span></button>` : "<span></span>"}${after ? `<button class="ex-bar-next" data-action="next"><span>${escapeHtml(after.exercise)}</span>${icon("right")}</button>` : `<button class="ex-bar-next" data-action="finish-session"><span>Finalizar</span></button>`}</footer></section>`);
}

// Menú ⋯: acciones de la sesión y del ejercicio. Vive dentro de #app para que sus botones usen los mismos manejadores.
function openExerciseMenu() {
  const current = draft();
  if (!current) return;
  const item = (action, label, className = "") => `<button class="${className}" data-action="${action}">${label}</button>`;
  const exerciseItems = [
    item("toggle-unilateral", current.unilateral ? "Registrar sin lados" : "Registrar por lado"),
    current.unilateral ? item("copy-sides", "Copiar el lado izquierdo al derecho") : "",
    current.sets.length > 1 ? item("copy-first-weight", "Copiar el peso de la primera serie") : "",
    current.sets.length > 1 ? item("remove-set", "Eliminar la última serie") : "",
    item("skip", current.status === "skipped" ? "Recuperar este ejercicio" : "Omitir este ejercicio"),
  ].join("");
  const dialog = document.createElement("dialog");
  dialog.className = "action-sheet";
  dialog.setAttribute("aria-label", "Opciones del entrenamiento");
  dialog.innerHTML = `<div class="sheet-group">${item("add-exercises", "Añadir ejercicio")}${item("manage-session", "Editar entrenamiento")}${item("finish-session", "Finalizar entrenamiento")}</div><div class="sheet-group">${exerciseItems}</div><div class="sheet-group"><button data-close>Cancelar</button></div>`;
  dialog.addEventListener("click", (event) => { if (event.target === dialog || event.target.closest("[data-close], [data-action]")) dialog.close(); });
  dialog.addEventListener("close", () => dialog.remove());
  app.append(dialog);
  dialog.showModal();
}

// UX-02: al dejar un ejercicio con alguna serie o lado marcado, se registra; sin nada marcado sigue pendiente.
function commitCurrentExercise() {
  if (state.view !== "exercise" || !state.session) return false;
  const current = draft();
  if (!current || current.status !== "pending" || !current.sets.some((set) => parts(set).some((part) => part.completed))) return false;
  registerExercise(current);
  showToast("Ejercicio registrado");
  return true;
}

// Guarda las series marcadas del ejercicio como una entrada del historial; no cambia de pantalla.
function registerExercise(current = draft()) {
  const now = new Date();
  const sets = current.sets.map((set) => structuredClone(set));
  const previousEntry = current.entryId ? storage.getEntries().find((entry) => entry.id === current.entryId) : null;
  const recordedAt = previousEntry?.recordedAt || dateTimeOnWorkoutDate(now, state.session.startedAt);
  const recordedDate = new Date(recordedAt);
  const entry = { id: current.entryId || uid(), sessionId: state.session.id, recordedAt, date: recordedDate.toLocaleDateString("es-CO"), time: recordedDate.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" }), exerciseId: current.exerciseId, exercise: current.exercise, muscleGroup: current.muscleGroup, category: current.category, unilateral: current.unilateral, sets, trackingMode: "set" };
  storage.saveWorkoutEntry(entry);
  current.sets = sets;
  current.entryId = entry.id;
  current.status = "registered";
  persistSession();
}

// Registro al completar la última serie: guarda y pasa al siguiente ejercicio pendiente.
function saveExercise() {
  const current = draft();
  if (!current.sets.some((set) => parts(set).some((part) => part.completed))) { showToast("Marca al menos una serie o lado"); return; }
  registerExercise(current);
  showToast("Ejercicio registrado");
  const pending = state.session.exercises.map((item, index) => ({ item, index })).filter(({ item }) => item.status === "pending");
  const next = pending.find(({ index }) => index > state.exerciseIndex) || pending[0];
  if (next) goToExercise(next.index); else render();
}

function completeSession() {
  const entries = storage.getEntries().filter((entry) => entry.sessionId === state.session.id);
  const durationSeconds = elapsedSeconds(state.session.clockStartedAt || state.session.startedAt);
  const endedAt = new Date(new Date(state.session.startedAt).getTime() + durationSeconds * 1000);
  const categoryTags = uniqueCategories(entries);
  const label = categoryLabel(categoryTags);
  const summary = { id: state.session.id, categoryTags, categoryLabel: label, startedAt: state.session.startedAt, endedAt: endedAt.toISOString(), durationSeconds, durationMinutes: Math.max(1, Math.round(durationSeconds / 60)), ...entryTotals(entries), skippedCount: state.session.exercises.filter((item) => item.status === "skipped").length };
  const key = categoryKey(categoryTags);
  const previousSession = storage.getCompletedSessions().filter((item) => categoryKey(item.categoryTags || [item.routineId].filter(Boolean)) === key && new Date(item.startedAt) < new Date(summary.startedAt)).sort((a, b) => new Date(a.startedAt) - new Date(b.startedAt)).at(-1) || null;
  const previous = previousSession && { ...previousSession, ...sessionTotals(previousSession, storage.getEntries().filter((entry) => entry.sessionId === previousSession.id)) };
  storage.saveCompletedSession(summary);
  storage.clearActiveSession();
  state.completion = { summary, previous };
  state.view = "complete";
  render();
}

function renderComplete() {
  const { summary, previous } = state.completion;
  const difference = previous ? summary.volume - previous.volume : null;
  const label = summary.categoryLabel || "Entrenamiento";
  const stats = [["Ejercicios", formatTotal(summary.exerciseCount)], ["Series", formatTotal(summary.setCount)], ["Repeticiones", formatTotal(summary.repCount)], ["Volumen", `${formatTotal(summary.volume)} lb`], ["Duración", formatDuration(summary.durationSeconds)], ["Omitidos", formatTotal(summary.skippedCount)]];
  const comparison = difference === null ? `Es tu primer entrenamiento de ${escapeHtml(label)}.` : `${difference >= 0 ? "+" : "−"}${formatTotal(Math.abs(difference))} lb de volumen frente a tu anterior entrenamiento de ${escapeHtml(label)}.`;
  renderShell(`<section class="screen ui-screen complete-screen"><div class="ui-complete-mark">${icon("check")}</div><header class="ui-title ui-title-center"><h1>Entrenamiento guardado</h1><p>${escapeHtml(label)} · ${formatDate(summary.startedAt)}</p></header><div class="ui-group">${stats.map(([name, value]) => `<div class="ui-row"><span>${name}</span><span class="ui-value">${value}</span></div>`).join("")}</div><p class="ui-group-footer">${comparison}</p><button class="ui-button" data-action="home">Volver al inicio</button></section>`);
}

function sessionMetadata(session, entries) {
  const categoryTags = session.categoryTags?.length ? session.categoryTags : uniqueCategories(entries.length ? entries : [{ category: session.routineId }]);
  return { categoryTags, label: session.categoryLabel || categoryLabel(categoryTags) || session.routine || "Entrenamiento" };
}

// HIST-03: totales de un grupo de entradas. Las sesiones finalizadas con el formato antiguo
// (routineId y durationMinutes) no guardan estos campos; se calculan al mostrarlas, sin escribirlos.
function entryTotals(entries) {
  return {
    exerciseCount: entries.length,
    setCount: entries.reduce((sum, entry) => sum + entry.sets.filter(countsSet).length, 0),
    repCount: entries.reduce((sum, entry) => sum + entry.sets.reduce((total, set) => total + setReps(set), 0), 0),
    volume: entries.reduce((sum, entry) => sum + entry.volume, 0),
  };
}

// MET-01: las series se cuentan siempre de las entradas, porque hasta 1.9.2 el total guardado incluía las de
// 0 repeticiones (y el setCount de cada entrada las sigue incluyendo). Los datos guardados no se modifican;
// los demás totales no cambian con esa regla y conservan el valor guardado.
function sessionTotals(session, entries) {
  const totals = entryTotals(entries);
  return { ...Object.fromEntries(Object.entries(totals).map(([key, value]) => [key, Number.isFinite(session[key]) ? session[key] : value])), setCount: totals.setCount, skippedCount: Number.isFinite(session.skippedCount) ? session.skippedCount : 0 };
}

function getHistorySessions() {
  const entries = storage.getEntries();
  const completed = storage.getCompletedSessions();
  const activeSessionId = storage.getActiveSession()?.id;
  const completedIds = new Set(completed.map((session) => session.id));
  const result = completed.map((session) => { const sessionEntries = entries.filter((entry) => entry.sessionId === session.id); return { ...session, ...sessionMetadata(session, sessionEntries), ...sessionTotals(session, sessionEntries), durationSeconds: session.durationSeconds ?? Math.max(0, Number(session.durationMinutes || 0) * 60), entries: sessionEntries, synthetic: false }; });
  const orphanGroups = new Map();
  // HIST-02: las entradas sin sesión (historial V0) siempre se muestran; sin sesión activa, activeSessionId también es undefined.
  entries.filter((entry) => !entry.sessionId || (entry.sessionId !== activeSessionId && !completedIds.has(entry.sessionId))).forEach((entry) => {
    const key = entry.sessionId || `legacy:${entry.category}:${entry.date || entry.recordedAt?.slice(0, 10)}`;
    if (!orphanGroups.has(key)) orphanGroups.set(key, []);
    orphanGroups.get(key).push(entry);
  });
  orphanGroups.forEach((group, id) => {
    const sorted = group.sort((a, b) => new Date(a.recordedAt) - new Date(b.recordedAt));
    const first = sorted[0];
    const categoryTags = uniqueCategories(group);
    result.push({ id, categoryTags, label: categoryLabel(categoryTags), startedAt: first.recordedAt, endedAt: sorted.at(-1).recordedAt, durationSeconds: 0, ...entryTotals(group), skippedCount: 0, entries: group, synthetic: true });
  });
  return result.filter((session) => session.entries.length).sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
}

function renderHistory() {
  const sessions = getHistorySessions();
  const matchCategory = (session) => state.historyFilter === "all" || (state.historyFilter === "mixed" ? session.categoryTags.length > 1 : session.categoryTags.length === 1 && session.categoryTags[0] === state.historyFilter);
  const visible = sessions.filter((session) => matchCategory(session) && searchText([session.label, ...session.entries.map((entry) => entry.exercise)].join(" ")).includes(searchText(state.historyQuery).trim()));
  const months = new Map();
  visible.forEach((session) => {
    const key = capitalize(new Intl.DateTimeFormat("es-CO", { month: "long", year: "numeric" }).format(new Date(session.startedAt)));
    if (!months.has(key)) months.set(key, []);
    months.get(key).push(session);
  });
  const row = (session) => `<button class="ui-row" data-history-session="${escapeHtml(session.id)}"><span class="ui-row-main"><span class="ui-row-top"><strong>${escapeHtml(session.label)}</strong><span class="ui-muted">${formatDayMonth(session.startedAt)}</span></span><small>${session.entries.slice(0, 3).map((entry) => escapeHtml(entry.exercise)).join(" · ")}${session.entries.length > 3 ? ` · +${session.entries.length - 3}` : ""}</small><small>${sessionSummary(session)}</small></span><span class="ui-chevron">${icon("right")}</span></button>`;
  const filters = [["all", "Todos"], ["push", "Push"], ["pull", "Pull"], ["legs", "Legs"], ["mixed", "Mixtos"]].map(([id, label]) => `<button data-history-filter="${id}" aria-pressed="${state.historyFilter === id}">${label}</button>`).join("");
  const results = [...months].map(([month, items]) => `<h2 class="ui-group-header">${escapeHtml(month)}</h2><div class="ui-group">${items.map(row).join("")}</div>`).join("") || `<p class="ui-empty">No hay entrenamientos con ese filtro o búsqueda.</p>`;
  renderShell(`<section class="screen ui-screen history-screen"><header class="ui-title"><h1>Historial</h1><p>${plural(sessions.length, "entrenamiento", "entrenamientos")}</p></header>${sessions.length ? `<label class="ui-search"><span class="visually-hidden">Buscar ejercicio</span>${icon("search")}<input id="history-search" type="search" placeholder="Buscar ejercicio" value="${escapeHtml(state.historyQuery)}" autocomplete="off"></label><div class="ui-segmented" aria-label="Filtrar entrenamientos">${filters}</div><div id="history-results">${results}</div>` : `<p class="ui-empty">Todavía no hay entrenamientos guardados. Cuando termines el primero, aparecerá aquí.</p>`}</section>`, "history");
}

function renderHistoryDetail() {
  const session = getHistorySessions().find((item) => item.id === state.historySessionId);
  if (!session) { state.view = "history"; return render(); }
  const entries = session.entries.sort((a, b) => new Date(a.recordedAt) - new Date(b.recordedAt));
  const meta = [formatDate(session.startedAt), formatTime(session.startedAt), session.durationSeconds ? formatDuration(session.durationSeconds) : "", `${formatTotal(session.volume)} lb`].filter(Boolean).join(" · ");
  const exercise = (entry) => `<h2 class="ui-group-header"><span>${escapeHtml(entry.exercise)} · ${escapeHtml(MUSCLE_GROUPS[entry.muscleGroup] || entry.muscleGroup)}</span><span>${formatTotal(entry.volume)} lb</span></h2><div class="ui-group">${entry.sets.map((set, index) => `<div class="ui-row"><span class="ui-muted">Serie ${index + 1}</span><span class="ui-value history-set-description">${setDescription(set)}</span></div>`).join("")}</div>`;
  renderShell(`<section class="screen ui-screen history-detail-screen"><nav class="ui-nav"><button class="ui-back" data-view="history">${icon("left")}<span>Historial</span></button></nav><header class="ui-title"><h1>${escapeHtml(session.label)}</h1><p>${meta}</p></header>${entries.map(exercise).join("")}<h2 class="ui-group-header">Fecha del entrenamiento</h2><form id="history-date-form" class="ui-group"><div class="ui-row"><label for="history-date" class="visually-hidden">Fecha del entrenamiento</label><input id="history-date" name="date" type="date" value="${inputDate(session.startedAt)}" max="${todayInputDate()}" required><button class="ui-pill" type="submit">Guardar</button></div></form><p class="ui-group-footer">Cámbiala si registraste este entrenamiento otro día. La duración no cambia.</p><div class="ui-group ui-group-end"><button class="ui-row ui-row-danger" data-action="delete-session">Eliminar entrenamiento</button></div></section>`);
}

function renderSettings() {
  renderShell(`<section class="screen ui-screen settings-screen">${settingsDashboard(getHistorySessions(), storage.getExerciseCatalog().filter((exercise) => exercise.custom).length, state.snapshots)}</section>`, "settings");
}

// DATA-03: copias automáticas. state.snapshots es null hasta cargarlas y "unavailable" si fallan.
const snapshots = createSnapshots({ storage, version: APP_VERSION, describe: () => ({ sessions: getHistorySessions().length }) });
state.snapshots = null;

async function refreshSnapshots() {
  try { state.snapshots = await snapshots.list(); } catch { state.snapshots = "unavailable"; }
  if (state.view === "settings") render();
}

async function restoreSnapshot(id) {
  const snapshot = Array.isArray(state.snapshots) ? state.snapshots.find((item) => item.id === id) : null;
  if (!snapshot || !confirm(`¿Restaurar la copia del ${formatDate(snapshot.createdAt)}? Reemplazará tus datos actuales. Antes se guardará una copia de los datos actuales para poder deshacerlo.`)) return;
  try {
    await snapshots.restore(id);
    await refreshSnapshots();
    goHome();
    showToast("Copia restaurada");
  } catch (error) {
    alert(error.message);
    await refreshSnapshots();
    render();
  }
}

function renderProgress() {
  renderShell(`<section class="screen ui-screen progress-screen">${progressDashboard(getHistorySessions(), state)}</section>`, "progress");
  const select = app.querySelector("#progress-exercise");
  if (select) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "progress-picker-trigger";
    button.dataset.action = "progress-picker";
    button.textContent = select.selectedOptions[0]?.textContent || "Elegir ejercicio";
    select.replaceWith(button);
  }
}

function openProgressPicker() {
  const options = exerciseOptions(getHistorySessions());
  const dialog = document.createElement("dialog");
  dialog.className = "progress-picker-dialog";
  dialog.setAttribute("aria-labelledby", "progress-picker-title");
  dialog.innerHTML = `<div class="dialog-heading"><h2 id="progress-picker-title">Elegir ejercicio</h2><button data-close aria-label="Cerrar">${icon("close")}</button></div><input type="search" placeholder="Buscar ejercicio" aria-label="Buscar ejercicio" autocomplete="off"><div class="progress-picker-list">${options.map((exercise, index) => `<button data-exercise="${escapeHtml(exercise.id)}" data-search="${escapeHtml(searchText(exercise.name))}" ${state.progressExercise === exercise.id ? 'aria-current="true"' : ''}><span>${escapeHtml(exercise.name)}</span>${index < 4 ? '<small>Reciente</small>' : ''}</button>`).join("")}</div><p class="quiet-empty" data-no-results hidden>Sin resultados.</p>`;
  dialog.addEventListener("click", (event) => {
    if (event.target.closest("[data-close]")) return dialog.close();
    const choice = event.target.closest("[data-exercise]");
    if (!choice) return;
    state.progressExercise = choice.dataset.exercise;
    state.progressSide = null;
    dialog.close(); renderProgress();
  });
  dialog.querySelector("input").addEventListener("input", (event) => {
    const query = searchText(event.target.value).trim();
    const buttons = dialog.querySelectorAll("[data-exercise]");
    buttons.forEach((button) => { button.hidden = !button.dataset.search.includes(query); });
    dialog.querySelector("[data-no-results]").hidden = [...buttons].some((button) => !button.hidden);
  });
  dialog.addEventListener("close", () => dialog.remove());
  document.body.append(dialog);
  dialog.showModal();
  dialog.querySelector("input").focus();
}

function openProgressInfo() {
  const dialog = document.createElement("dialog");
  dialog.className = "progress-info-dialog";
  dialog.setAttribute("aria-labelledby", "progress-info-title");
  dialog.innerHTML = `<div class="dialog-heading"><h2 id="progress-info-title">Cómo leer tu progreso</h2><button data-close aria-label="Cerrar">${icon("close")}</button></div><section><h3>Rendimiento estimado</h3><p>Combina el peso y las repeticiones de tu mejor serie completada. Se estima con <strong>peso × (1 + repeticiones ÷ 30)</strong>; es una referencia para comparar sesiones, no una prueba real de repetición máxima.</p></section><section><h3>Volumen</h3><p>Suma peso × repeticiones de todas las series completadas del ejercicio. Mide trabajo realizado y puede cambiar si haces más o menos series.</p></section><section><h3>Repeticiones</h3><p>Suma las repeticiones completadas. Úsala junto con el peso y el volumen.</p></section><section><h3>Récords</h3><p>Destaca el mejor rendimiento estimado, la mayor carga, el máximo de repeticiones y el mayor volumen dentro del periodo elegido.</p></section><section><h3>Series por grupo</h3><p>Agrupa las series completadas por músculo. Los registros izquierdo y derecho se mantienen separados en el análisis por ejercicio.</p></section><button class="primary-button static" data-close>Entendido</button>`;
  dialog.addEventListener("click", (event) => { if (event.target.closest("[data-close]")) dialog.close(); });
  dialog.addEventListener("close", () => dialog.remove());
  document.body.append(dialog);
  dialog.showModal();
}

// UI-01: al cambiar de vista (también al empezar la sesión) se vuelve arriba; los renderizados dentro de una misma vista conservan la posición.
let renderedView = null;
function render() {
  if (state.view === "progress") renderProgress();
  if (state.view === "home") renderHome();
  if (state.view === "builder") renderBuilder();
  if (state.view === "exercise") renderExercise();
  if (state.view === "complete") renderComplete();
  if (state.view === "history") renderHistory();
  if (state.view === "history-detail") renderHistoryDetail();
  if (state.view === "settings") renderSettings();
  if (state.view !== renderedView) { renderedView = state.view; window.scrollTo(0, 0); }
}

function updateTimers() { document.querySelectorAll("[data-session-start]").forEach((element) => { element.textContent = formatDuration(elapsedSeconds(element.dataset.sessionStart)); }); }
// UI-01: cada aviso se ve 2,5 s; si llega otro antes, el plazo empieza de nuevo.
const TOAST_MS = 2500;
let toastSequence = 0;
function showToast(message) { const current = ++toastSequence; toast.textContent = message; toast.classList.add("visible"); window.setTimeout(() => { if (current === toastSequence) toast.classList.remove("visible"); }, TOAST_MS); }
function goToExercise(index) { const target = Math.max(0, Math.min(index, state.session.exercises.length - 1)); if (target !== state.exerciseIndex) commitCurrentExercise(); state.exerciseIndex = target; persistSession(); render(); window.scrollTo({ top: 0, behavior: "smooth" }); }
function exportData() {
  const blob = new Blob([JSON.stringify(storage.exportData(), null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = `sterk-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast("Respaldo exportado");
}

app.addEventListener("change", (event) => {
  if (event.target.id === "progress-exercise") { state.progressExercise = event.target.value; renderProgress(); }
  if (event.target.id === "progress-side") { state.progressSide = event.target.value; renderProgress(); }
});

app.addEventListener("submit", (event) => {
  if (event.target.id === "history-date-form") {
    event.preventDefault();
    const localDate = String(new FormData(event.target).get("date") || "");
    if (!localDate || localDate > todayInputDate()) return alert("Elige una fecha válida que no esté en el futuro.");
    const session = getHistorySessions().find((item) => item.id === state.historySessionId);
    storage.changeSessionDate(state.historySessionId, localDate, session?.entries.map((entry) => entry.id));
    if (session?.synthetic) state.view = "history";
    renderHistoryDetail();
    showToast("Fecha actualizada");
    return;
  }
  if (event.target.id !== "custom-exercise-form") return;
  event.preventDefault();
  const data = new FormData(event.target);
  const name = String(data.get("name") || "").trim();
  if (!name) return;
  try {
    const exercise = { id: `custom-${uid()}`, name, muscleGroup: data.get("muscleGroup"), category: data.get("category") };
    storage.saveCustomExercise(exercise);
    state.builderSelection.push(exercise.id);
    state.builderQuery = "";
   
    render();
    showToast("Ejercicio creado");
  } catch (error) { alert(error.message); }
});

app.addEventListener("click", (event) => {
  const historyFilter = event.target.closest("[data-history-filter]");
  if (historyFilter) { state.historyFilter = historyFilter.dataset.historyFilter; return renderHistory(); }
  const progressMetric = event.target.closest("[data-progress-metric]");
  if (progressMetric) { state.progressMetric = progressMetric.dataset.progressMetric; return renderProgress(); }
  const periodButton = event.target.closest("[data-period]");
  if (periodButton) { state.progressPeriod = periodButton.dataset.period; return renderProgress(); }
  const viewButton = event.target.closest("[data-view]");
  if (viewButton) { state.view = viewButton.dataset.view; return render(); }
  const restoreButton = event.target.closest("[data-restore-snapshot]");
  if (restoreButton) { restoreSnapshot(restoreButton.dataset.restoreSnapshot); return; }
  const archiveButton = event.target.closest("[data-archive-exercise]");
  if (archiveButton) { const id = archiveButton.dataset.archiveExercise; if (confirm("¿Archivar este ejercicio personalizado? El historial no se eliminará.")) { storage.archiveCustomExercise(id); state.builderSelection = state.builderSelection.filter((item) => item !== id); render(); } return; }
  const selectButton = event.target.closest("[data-select-exercise]");
  if (selectButton) { const id = selectButton.dataset.selectExercise; state.builderSelection = state.builderSelection.includes(id) ? state.builderSelection.filter((item) => item !== id) : [...state.builderSelection, id]; return render(); }
  const removeButton = event.target.closest("[data-remove-exercise]");
  if (removeButton) { state.builderSelection = state.builderSelection.filter((id) => id !== removeButton.dataset.removeExercise); return render(); }
  const moveButton = event.target.closest("[data-move-exercise]");
  if (moveButton) { const from = Number(moveButton.dataset.moveExercise); const to = from + Number(moveButton.dataset.direction); if (to >= 0 && to < state.builderSelection.length) [state.builderSelection[from], state.builderSelection[to]] = [state.builderSelection[to], state.builderSelection[from]]; return render(); }
  const historyButton = event.target.closest("[data-history-session]");
  if (historyButton) { state.historySessionId = historyButton.dataset.historySession; state.view = "history-detail"; return render(); }
  if (handleSessionClick(event)) return;
  const setButton = event.target.closest("[data-toggle-set]");
  if (setButton) {
    const set = draft().sets[Number(setButton.dataset.toggleSet)];
    const side = setButton.dataset.side;
    const wasCompleted = side ? set.sides[side].completed : parts(set).every((part) => part.completed);
    if (side) set.sides[side].completed = !wasCompleted;
    else parts(set).forEach((part) => { part.completed = !wasCompleted; });
    markEdited(); persistSession();
    if (!wasCompleted && draft().sets.every((item) => parts(item).every(countsPart))) return saveExercise();
    return render();
  }
  const jumpButton = event.target.closest("[data-jump]");
  if (jumpButton) return goToExercise(Number(jumpButton.dataset.jump));
  const editWeight = event.target.closest("[data-edit-weight]");
  if (editWeight) { const set = editablePart(Number(editWeight.dataset.editWeight), editWeight.dataset.side); openWeightPicker(set.weight, (weight) => { set.weight = weight; markEdited(); persistSession(); render(); }); return; }
  const editReps = event.target.closest("[data-edit-reps]");
  if (editReps) { const set = editablePart(Number(editReps.dataset.editReps), editReps.dataset.side); openRepsPicker(set.reps, (reps) => { set.reps = reps; markEdited(); persistSession(); render(); }); return; }
  const action = event.target.closest("[data-action]")?.dataset.action;
  if (action === "progress-info") openProgressInfo();
  if (action === "progress-picker") openProgressPicker();
  if (action === "new-session") { const active = storage.getActiveSession(); if (active && !confirm("Esto reemplazará la sesión en curso. ¿Continuar?")) return; if (active) storage.deleteSession(active.id); storage.clearActiveSession(); state.adding = false; state.builderQuery = ""; state.builderSelection = []; state.view = "builder"; render(); }
  if (action === "cancel-builder") { if (state.adding) { state.adding = false; state.view = "exercise"; render(); } else goHome(); }
  if (action === "start-session") { if (state.adding) { const selected = selectedExercises(); if (!selected.length) return; const first = state.session.exercises.length; state.session.exercises.push(...selected.map(newExerciseDraft)); state.adding = false; state.view = "exercise"; goToExercise(first); } else startSession(); }
  if (action === "resume") resumeSession();
  if (action === "home" || action === "leave-session") { commitCurrentExercise(); goHome(); }
  if (action === "discard-session" && confirm("¿Descartar la sesión en curso y sus registros?")) { const active = storage.getActiveSession(); if (active) storage.deleteSession(active.id); storage.clearActiveSession(); goHome(); }
  if (action === "add-set") { const previous = draft().sets.at(-1) || { weight: DEFAULT_ENTRY.weight, reps: 10 }; draft().sets.push(resetSet(previous)); markEdited(); persistSession(); render(); }
  if (action === "remove-set" && draft().sets.length > 1) { if (parts(draft().sets.at(-1)).some((part) => part.completed) && !confirm("¿Eliminar esta serie y sus datos?")) return; draft().sets.pop(); markEdited(); persistSession(); render(); }
  if (action === "copy-first-weight") { const first = draft().sets[0]; draft().sets.forEach((set) => { if (set.sides) SIDES.forEach((side) => { set.sides[side].weight = first.sides[side].weight; }); else set.weight = first.weight; }); markEdited(); persistSession(); render(); }
  if (action === "previous") goToExercise(state.exerciseIndex - 1);
  if (action === "next") goToExercise(state.exerciseIndex + 1);
  if (action === "skip") { const current = draft(); if (current.status === "skipped") current.status = "pending"; else { if (current.entryId && !confirm("¿Omitir este ejercicio y eliminar su registro de esta sesión?")) return; if (current.entryId) storage.deleteWorkoutEntry(current.entryId); current.entryId = null; current.status = "skipped"; } persistSession(); const pending = state.session.exercises.map((item, index) => ({ item, index })).filter(({ item }) => item.status === "pending"); if (!pending.length) render(); else { const next = pending.find(({ index }) => index > state.exerciseIndex) || pending[0]; goToExercise(next.index); } }
  if (action === "delete-session" && confirm("¿Eliminar este entrenamiento completo? Esta acción no se puede deshacer.")) { const session = getHistorySessions().find((item) => item.id === state.historySessionId); if (session) storage.deleteSession(session.id, session.entries.map((entry) => entry.id)); state.view = "history"; render(); showToast("Entrenamiento eliminado"); }
  if (action === "export") exportData();
  if (action === "import") importInput.click();
  if (action === "clear-data" && confirm("¿Borrar todos los datos de Sterk en este dispositivo? Esta acción no se puede deshacer.")) { storage.clearAll(); goHome(); showToast("Todos los datos fueron eliminados"); }
  if (action === "update-app") location.reload();
});

importInput.addEventListener("change", async () => {
  const file = importInput.files[0];
  if (!file) return;
  // DATA-01: el respaldo se lee y valida entero antes de pedir confirmación; si falla, nada cambia.
  try {
    let backup;
    try { backup = JSON.parse(await file.text()); } catch { throw new Error("No se pudo leer el archivo: no es un respaldo de Sterk o está incompleto. No se modificó ningún dato."); }
    storage.validateBackup(backup);
    if (!confirm("¿Restaurar esta copia? Reemplazará el historial, la sesión activa y las preferencias actuales.")) return;
    storage.importData(backup); goHome(); showToast("Respaldo restaurado");
  }
  catch (error) { alert(error.message); render(); }
  finally { importInput.value = ""; }
});

if ("serviceWorker" in navigator) window.addEventListener("load", async () => {
  const registration = await navigator.serviceWorker.register("./service-worker.js");
  registration.addEventListener("updatefound", () => { const worker = registration.installing; worker?.addEventListener("statechange", () => { if (worker.state === "installed" && navigator.serviceWorker.controller) { state.updateWaiting = true; if (state.view === "home") render(); } }); });
});

bindWeightControl(app,
  (button) => editablePart(Number(button.dataset.editWeight), button.dataset.side).weight,
  (button, weight) => {
    editablePart(Number(button.dataset.editWeight), button.dataset.side).weight = weight;
    markEdited(); persistSession();
    const jump = app.querySelector(`[data-jump="${state.exerciseIndex}"]`);
    if (jump) { jump.classList.remove("registered", "skipped"); jump.classList.add("pending"); }
  });
bindRepsControl(app,
  (button) => editablePart(Number(button.dataset.editReps), button.dataset.side).reps,
  (button, reps) => {
    editablePart(Number(button.dataset.editReps), button.dataset.side).reps = reps;
    markEdited(); persistSession();
    const jump = app.querySelector(`[data-jump="${state.exerciseIndex}"]`);
    if (jump) { jump.classList.remove("registered", "skipped"); jump.classList.add("pending"); }
  });
// Una acción bloqueada porque hay datos ilegibles no debe pasar en silencio.
window.addEventListener("error", (event) => {
  if (event.error?.name !== "StorageReadError") return;
  event.preventDefault();
  alert(event.error.message);
  render();
});
window.setInterval(updateTimers, 1000);
storage.checkData();
render();
// DATA-03: pedir almacenamiento persistente y guardar la copia de esta versión sin retrasar el inicio.
navigator.storage?.persisted?.().then((persisted) => persisted || navigator.storage.persist()).catch(() => {});
snapshots.ensureVersionSnapshot().catch(() => {}).finally(refreshSnapshots);
