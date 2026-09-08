import { CATEGORY_LABELS, CATEGORY_ORDER, DEFAULT_ENTRY, MUSCLE_GROUPS, categoryLabel, matchesExercise } from "./data.js";
import { storage } from "./storage.js";

import { SIDES, parts, setReps, resetSet, finishSet } from "./sets.js";
import { openWeightPicker } from "./weight-picker.js";
import { bindWeightControl } from "./weight-control.js";
import { icon } from "./icons.js";

const app = document.querySelector("#app");
const toast = document.querySelector("#toast");
const importInput = document.querySelector("#import-data");
const state = { view: "home", session: null, exerciseIndex: 0, historySessionId: null, completion: null, updateWaiting: false, builderSelection: [], builderFilter: "all", builderQuery: "", adding: false };

const uid = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
const escapeHtml = (value) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
const formatNumber = (value) => Number(value).toLocaleString("es-CO", { useGrouping: false, maximumFractionDigits: 10 });
const formatDate = (value) => new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
const formatTime = (value) => new Intl.DateTimeFormat("es-CO", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
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
function renderSet(set, index, setMode) {
  const controls = (part, side = "") => `<div class="side-row">${side ? `<div class="side-heading"><strong>${sideLabel(side)}</strong><div class="side-utilities"><button class="copy-side" data-copy-side="${index}" data-side="${side}" aria-label="Copiar valores de ${sideLabel(side)} al otro lado" title="Copiar al otro lado">${icon("copy")}</button>${setMode ? `<button class="set-check" data-toggle-set="${index}" data-side="${side}" aria-label="${part.completed ? "Desmarcar" : "Completar"} ${sideLabel(side)} serie ${index + 1}" aria-pressed="${part.completed}">${part.completed ? icon("check") : ""}</button>` : ""}</div></div>` : ""}<div class="set-controls"><div><small>PESO · LB</small><button class="weight-value" role="spinbutton" aria-valuemin="0" aria-valuenow="${part.weight}" aria-valuetext="${part.weight} libras" aria-describedby="weight-help" data-edit-weight="${index}" data-side="${side}" aria-label="Editar peso ${side ? sideLabel(side) : ""} serie ${index + 1}"><span data-weight-number>${formatNumber(part.weight)}</span></button></div><div><small>REPETICIONES</small><div class="stepper"><button data-set-reps="${index}" data-side="${side}" data-delta="-1" aria-label="Disminuir repeticiones">${icon("minus")}</button><button class="stepper-value" data-edit-reps="${index}" data-side="${side}" aria-label="Editar repeticiones">${part.reps}</button><button data-set-reps="${index}" data-side="${side}" data-delta="1" aria-label="Aumentar repeticiones">${icon("plus")}</button></div></div></div></div>`;
  return `<article class="set-card ${set.completed ? "done" : ""}"><div class="set-card-heading">${setMode && !set.sides ? `<button class="set-check" data-toggle-set="${index}" aria-label="Completar serie ${index + 1}" aria-pressed="${set.completed}">${set.completed ? icon("check") : index + 1}</button>` : `<span class="set-label">SERIE ${index + 1}</span>`}<span>${set.completed ? "COMPLETADA" : ""}</span></div>${set.sides ? SIDES.map((side) => controls(set.sides[side], side)).join("") : controls(set)}</article>`;
}
function sessionControls() {
  return `<div class="session-tools"><button data-action="add-exercises">${icon("plus")} Añadir ejercicio</button><button data-action="manage-session">${icon("edit")} Editar</button><button data-action="finish-session">Finalizar</button></div>`;
}
function renderEmptySession() {
  renderShell(`<section class="screen exercise-screen"><header class="detail-header"><button class="icon-button" data-action="leave-session" aria-label="Volver al inicio">${icon("left")}</button>${timer(state.session.startedAt)}</header><h1>Tu sesión sigue abierta</h1><p>Añade el próximo ejercicio cuando estés listo.</p>${sessionControls()}</section>`);
}
function openSessionEditor() {
  const dialog = document.createElement("dialog");
  dialog.className = "session-editor";
  dialog.setAttribute("aria-label", "Editar entrenamiento");
  const draw = () => {
    dialog.innerHTML = `<h2>Tu entrenamiento</h2>${state.session.exercises.map((exercise, index) => `<div class="selected-row"><span>${index + 1}</span><strong>${escapeHtml(exercise.exercise)}</strong><button data-move="${index}" data-direction="-1" ${index === 0 ? "disabled" : ""} aria-label="Subir ${escapeHtml(exercise.exercise)}">${icon("up")}</button><button data-move="${index}" data-direction="1" ${index === state.session.exercises.length - 1 ? "disabled" : ""} aria-label="Bajar ${escapeHtml(exercise.exercise)}">${icon("down")}</button><button data-remove="${index}" aria-label="Quitar ${escapeHtml(exercise.exercise)}">${icon("close")}</button></div>`).join("") || "<p>No hay ejercicios. Puedes añadir más.</p>"}<button class="primary-button static" data-close>Listo</button>`;
  };
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
    state.adding = true; state.builderSelection = []; state.builderFilter = "all"; state.builderQuery = ""; state.view = "builder"; persistSession(); render(); return true;
  }
  if (action === "manage-session") { openSessionEditor(); return true; }
  if (action === "finish-session") {
    if (state.session.exercises.some((exercise) => exercise.status === "pending")) { alert("Registra u omite los ejercicios pendientes antes de finalizar. También puedes quitarlos desde Editar entrenamiento."); return true; }
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

app.addEventListener("input", (event) => {
  if (event.target.id !== "exercise-search") return;
  state.builderQuery = event.target.value;
  const catalog = storage.getExerciseCatalog();
  const items = [...app.querySelectorAll("[data-catalog-id]")];
  items.forEach((item) => { item.hidden = !matchesExercise(catalog.find((exercise) => exercise.id === item.dataset.catalogId), state.builderQuery); });
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
  state.session = { id: uid(), startedAt: new Date().toISOString(), categoryTags: uniqueCategories(selected), trackingMode: storage.getSettings().trackingMode, exerciseIndex: 0, exercises: selected.map(newExerciseDraft) };
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
function brand() { return `<header class="brand-lockup"><span class="brand-mark" aria-hidden="true">S</span><h1>Sterk</h1></header>`; }
function timer(startedAt, className = "") { return `<span class="session-timer ${className}" data-session-start="${escapeHtml(startedAt)}">${formatDuration(elapsedSeconds(startedAt))}</span>`; }

function renderShell(content, active = "") {
  app.innerHTML = `${content}${!["exercise", "complete", "builder"].includes(state.view) ? `<nav class="bottom-nav" aria-label="Navegación principal"><button data-view="home" class="${active === "home" ? "active" : ""}"><span>${icon("home")}</span>Inicio</button><button data-view="history" class="${active === "history" ? "active" : ""}"><span>${icon("history")}</span>Historial</button><button data-view="settings" class="${active === "settings" ? "active" : ""}"><span>${icon("edit")}</span>Ajustes</button></nav>` : ""}`;
  updateTimers();
}

function renderHome() {
  const active = storage.getActiveSession();
  const activeLabel = active ? categoryLabel(uniqueCategories(active.exercises)) : "";
  const current = active?.exercises?.[Math.min(active.exerciseIndex || 0, active.exercises.length - 1)];
  renderShell(`<section class="screen home-screen">${brand()}${state.updateWaiting ? `<button class="update-banner" data-action="update-app">Nueva versión disponible · Actualizar</button>` : ""}${active ? `<section class="resume-card"><div><span>SESIÓN EN CURSO</span><strong>${escapeHtml(activeLabel)}</strong><small>${escapeHtml(current?.exercise || "")}</small>${timer(active.startedAt, "resume-timer")}</div><button data-action="resume">Continuar ${icon("right")}</button><button class="text-button danger" data-action="discard-session">Descartar sesión</button></section>` : ""}<div class="home-copy"><p class="eyebrow">FUERZA, SIN DISTRACCIONES</p><h2>¿Qué entrenas hoy?</h2></div><button class="new-session-card" data-action="new-session"><span><strong>Crear entrenamiento</strong><small>Elige y combina tus ejercicios</small></span><i>${icon("plus")}</i></button><p class="local-note"><span>●</span> Tus datos permanecen en este dispositivo</p></section>`, "home");
}

function renderBuilder() {
  const catalog = storage.getExerciseCatalog();
  const groups = [...new Set(catalog.map((exercise) => exercise.muscleGroup))];
  const visible = catalog.filter((exercise) => (state.builderFilter === "all" || exercise.muscleGroup === state.builderFilter) && (!state.adding || !state.session.exercises.some((item) => item.exerciseId === exercise.id)));
  const selected = selectedExercises();
  const filters = [{ id: "all", label: "Todos" }, ...groups.map((id) => ({ id, label: MUSCLE_GROUPS[id] || id }))];
  renderShell(`<section class="screen builder-screen"><header class="detail-header"><button class="icon-button" data-action="cancel-builder">${icon("left")}</button><span>${state.adding ? "AÑADIR EJERCICIOS" : "NUEVO ENTRENAMIENTO"}</span></header><div class="builder-heading"><p class="eyebrow">${selected.length ? categoryLabel(uniqueCategories(selected)).toLocaleUpperCase() : "SELECCIÓN LIBRE"}</p><h1>Elige tus ejercicios</h1></div><label class="search-label">Buscar ejercicio<input id="exercise-search" type="search" placeholder="Nombre en español o inglés" value="${escapeHtml(state.builderQuery)}" autocomplete="off"></label><button class="create-shortcut" data-action="create-custom">${icon("plus")} Crear ejercicio personalizado</button><div class="muscle-filters">${filters.map((filter) => `<button data-filter="${escapeHtml(filter.id)}" class="${state.builderFilter === filter.id ? "active" : ""}">${escapeHtml(filter.label)}</button>`).join("")}</div><div class="exercise-catalog"><p class="empty-state" id="search-empty" ${visible.some((exercise) => matchesExercise(exercise, state.builderQuery)) ? "hidden" : ""}>No hay resultados. Puedes crear tu ejercicio.</p>${visible.map((exercise) => { const isSelected = state.builderSelection.includes(exercise.id); return `<article data-catalog-id="${escapeHtml(exercise.id)}" ${matchesExercise(exercise, state.builderQuery) ? "" : "hidden"} class="catalog-item ${isSelected ? "selected" : ""}"><button class="catalog-select" data-select-exercise="${escapeHtml(exercise.id)}"><span class="selection-mark">${isSelected ? icon("check") : icon("plus")}</span><span><strong>${escapeHtml(exercise.name)}</strong><small>${escapeHtml(MUSCLE_GROUPS[exercise.muscleGroup] || exercise.muscleGroup)} · ${escapeHtml(CATEGORY_LABELS[exercise.category])}</small></span></button>${exercise.custom ? `<button class="catalog-archive" data-archive-exercise="${escapeHtml(exercise.id)}" aria-label="Archivar ${escapeHtml(exercise.name)}">${icon("close")}</button>` : ""}</article>`; }).join("")}</div><details class="custom-exercise"><summary>${icon("plus")} Crear ejercicio personalizado</summary><form id="custom-exercise-form"><label>Nombre<input name="name" required maxlength="50" autocomplete="off" value="${escapeHtml(state.builderQuery)}"></label><label>Grupo muscular<select name="muscleGroup">${Object.entries(MUSCLE_GROUPS).map(([id, label]) => `<option value="${id}">${label}</option>`).join("")}</select></label><label>Categoría<select name="category">${CATEGORY_ORDER.map((id) => `<option value="${id}">${CATEGORY_LABELS[id]}</option>`).join("")}</select></label><button type="submit">Guardar ejercicio</button></form></details>${selected.length ? `<section class="selected-exercises"><div class="section-heading"><h2>Tu entrenamiento</h2><span>${selected.length} ${selected.length === 1 ? "EJERCICIO" : "EJERCICIOS"}</span></div>${selected.map((exercise, index) => `<div class="selected-row"><span>${index + 1}</span><strong>${escapeHtml(exercise.name)}</strong><button data-move-exercise="${index}" data-direction="-1" ${index === 0 ? "disabled" : ""} aria-label="Subir">${icon("up")}</button><button data-move-exercise="${index}" data-direction="1" ${index === selected.length - 1 ? "disabled" : ""} aria-label="Bajar">${icon("down")}</button><button data-remove-exercise="${escapeHtml(exercise.id)}" aria-label="Quitar">${icon("close")}</button></div>`).join("")}</section>` : ""}<footer class="builder-action"><button class="primary-button" data-action="start-session" ${selected.length ? "" : "disabled"}>${state.adding ? "Añadir a la sesión" : "Comenzar entrenamiento"} <span>${icon("right")}</span></button></footer></section>`);
}

function renderPrevious(previous) {
  if (!previous) return `<div class="previous-compact empty"><span>Primera vez con este ejercicio</span></div>`;
  const summary = entrySets(previous).map((set) => setDescription(set)).join(" · ");
  return `<details class="previous-compact"><summary><span>Anterior · ${formatDate(previous.recordedAt)}</span><strong>${summary}</strong></summary><div>${entrySets(previous).map((set, index) => `<p><span>Serie ${index + 1}</span><strong>${setDescription(set)}</strong></p>`).join("")}</div></details>`;
}

function renderExercise() {
  const current = draft();
  if (!current) return renderEmptySession();
  const previous = storage.getLastExerciseEntry(current.exerciseId, current.exercise, state.session.id);
  const setMode = state.session.trackingMode === "set";
  const completed = current.sets.filter((set) => set.completed).length;
  const setRows = current.sets.map((set, index) => renderSet(set, index, setMode)).join("");
  renderShell(`<section class="screen exercise-screen"><header class="exercise-header"><button class="icon-button" data-action="leave-session" aria-label="Volver al inicio">${icon("left")}</button><div class="progress-copy"><span>${categoryLabel(uniqueCategories(state.session.exercises))}</span><strong>${state.exerciseIndex + 1} de ${state.session.exercises.length}</strong></div><div class="workout-clock"><small>SESIÓN</small>${timer(state.session.startedAt)}</div><div class="progress-track"><i style="width:${((state.exerciseIndex + 1) / state.session.exercises.length) * 100}%"></i></div></header><div class="exercise-jump" aria-label="Ejercicios">${state.session.exercises.map((exercise, index) => `<button data-jump="${index}" class="${index === state.exerciseIndex ? "active" : ""} ${exercise.status}"><span>${index + 1}</span><small>${escapeHtml(exercise.exercise)}</small></button>`).join("")}</div><div class="exercise-title"><p class="eyebrow">${current.status === "skipped" ? "EJERCICIO OMITIDO" : `${escapeHtml(MUSCLE_GROUPS[current.muscleGroup] || current.muscleGroup)} · ${escapeHtml(CATEGORY_LABELS[current.category])}`}</p><h1>${escapeHtml(current.exercise)}</h1></div>${sessionControls()}${renderPrevious(previous)}<section class="control-section sets-section"><div class="section-heading"><h2>Series</h2><label class="side-option"><input type="checkbox" aria-label="Registrar por lado" data-action="toggle-unilateral" ${current.unilateral ? "checked" : ""}> Por lado</label><span>${setMode ? `${completed}/${current.sets.length} HECHAS` : `${current.sets.length} TOTAL`}</span></div><p class="weight-help" id="weight-help">Desliza el peso para ajustar · Toca para escribir</p><div class="sets-list">${setRows}</div><div class="set-actions"><button data-action="remove-set" ${current.sets.length <= 1 ? "disabled" : ""}>${icon("minus")} Eliminar última</button><button data-action="add-set">${icon("plus")} Añadir serie</button></div><button class="copy-weight" data-action="copy-first-weight" ${current.sets.length <= 1 ? "disabled" : ""}>Copiar peso de la primera serie</button></section><div class="exercise-secondary-actions"><button data-action="previous" ${state.exerciseIndex === 0 ? "disabled" : ""}>${icon("left")} Anterior</button><button data-action="skip">${current.status === "skipped" ? "Recuperar" : "Omitir"}</button><button data-action="next" ${state.exerciseIndex === state.session.exercises.length - 1 ? "disabled" : ""}>Siguiente ${icon("right")}</button></div><footer class="sticky-action"><button class="primary-button" data-action="save">${current.entryId ? "Actualizar ejercicio" : "Registrar ejercicio"}<span>${icon("right")}</span></button></footer></section>`);
}

function saveExercise() {
  const current = draft();
  const now = new Date();
  const sets = current.sets.map((set) => state.session.trackingMode === "exercise" ? finishSet(set) : structuredClone(set));
  if (!sets.some((set) => parts(set).some((part) => part.completed))) { showToast("Marca al menos una serie o lado"); return; }
  const entry = { id: current.entryId || uid(), sessionId: state.session.id, recordedAt: now.toISOString(), date: now.toLocaleDateString("es-CO"), time: now.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" }), exerciseId: current.exerciseId, exercise: current.exercise, muscleGroup: current.muscleGroup, category: current.category, unilateral: current.unilateral, sets, trackingMode: state.session.trackingMode };
  storage.saveWorkoutEntry(entry);
  current.sets = sets;
  current.entryId = entry.id;
  current.status = "registered";
  persistSession();
  showToast("Ejercicio registrado");
  const pending = state.session.exercises.map((item, index) => ({ item, index })).filter(({ item }) => item.status === "pending");
  const next = pending.find(({ index }) => index > state.exerciseIndex) || pending[0];
  if (next) goToExercise(next.index); else render();
}

function completeSession() {
  const entries = storage.getEntries().filter((entry) => entry.sessionId === state.session.id);
  const endedAt = new Date();
  const durationSeconds = elapsedSeconds(state.session.startedAt, endedAt);
  const categoryTags = uniqueCategories(entries);
  const label = categoryLabel(categoryTags);
  const summary = { id: state.session.id, categoryTags, categoryLabel: label, startedAt: state.session.startedAt, endedAt: endedAt.toISOString(), durationSeconds, durationMinutes: Math.max(1, Math.round(durationSeconds / 60)), exerciseCount: entries.length, skippedCount: state.session.exercises.filter((item) => item.status === "skipped").length, setCount: entries.reduce((sum, entry) => sum + entry.setCount, 0), repCount: entries.reduce((sum, entry) => sum + entry.sets.reduce((total, set) => total + setReps(set), 0), 0), volume: entries.reduce((sum, entry) => sum + entry.volume, 0) };
  const key = categoryKey(categoryTags);
  const previous = storage.getCompletedSessions().filter((item) => categoryKey(item.categoryTags || [item.routineId].filter(Boolean)) === key).at(-1) || null;
  storage.saveCompletedSession(summary);
  storage.clearActiveSession();
  state.completion = { summary, previous };
  state.view = "complete";
  render();
}

function renderComplete() {
  const { summary, previous } = state.completion;
  const difference = previous ? summary.volume - previous.volume : null;
  renderShell(`<section class="screen complete-screen"><div class="completion-mark">${icon("check")}</div><p class="eyebrow">SESIÓN FINALIZADA</p><h1>Entrenamiento<br>completado</h1><p class="routine-name">${escapeHtml(summary.categoryLabel)}</p><div class="summary-grid"><div><strong>${summary.exerciseCount}</strong><span>Ejercicios</span></div><div><strong>${summary.setCount}</strong><span>Series</span></div><div><strong>${summary.repCount}</strong><span>Repeticiones</span></div><div><strong>${formatNumber(summary.volume)}</strong><span>Volumen · lb</span></div><div><strong>${formatDuration(summary.durationSeconds)}</strong><span>Duración</span></div><div><strong>${summary.skippedCount}</strong><span>Omitidos</span></div></div><div class="comparison">${difference === null ? "Primera sesión de esta categoría" : `${difference >= 0 ? "+" : ""}${formatNumber(difference)} lb de volumen frente a la anterior`}</div><button class="primary-button static" data-action="home">Volver al inicio</button></section>`);
}

function sessionMetadata(session, entries) {
  const categoryTags = session.categoryTags?.length ? session.categoryTags : uniqueCategories(entries.length ? entries : [{ category: session.routineId }]);
  return { categoryTags, label: session.categoryLabel || categoryLabel(categoryTags) || session.routine || "Entrenamiento" };
}

function getHistorySessions() {
  const entries = storage.getEntries();
  const completed = storage.getCompletedSessions();
  const activeSessionId = storage.getActiveSession()?.id;
  const completedIds = new Set(completed.map((session) => session.id));
  const result = completed.map((session) => { const sessionEntries = entries.filter((entry) => entry.sessionId === session.id); return { ...session, ...sessionMetadata(session, sessionEntries), durationSeconds: session.durationSeconds ?? Math.max(0, Number(session.durationMinutes || 0) * 60), entries: sessionEntries, synthetic: false }; });
  const orphanGroups = new Map();
  entries.filter((entry) => entry.sessionId !== activeSessionId && (!entry.sessionId || !completedIds.has(entry.sessionId))).forEach((entry) => {
    const key = entry.sessionId || `legacy:${entry.category}:${entry.date || entry.recordedAt?.slice(0, 10)}`;
    if (!orphanGroups.has(key)) orphanGroups.set(key, []);
    orphanGroups.get(key).push(entry);
  });
  orphanGroups.forEach((group, id) => {
    const sorted = group.sort((a, b) => new Date(a.recordedAt) - new Date(b.recordedAt));
    const first = sorted[0];
    const categoryTags = uniqueCategories(group);
    result.push({ id, categoryTags, label: categoryLabel(categoryTags), startedAt: first.recordedAt, endedAt: sorted.at(-1).recordedAt, durationSeconds: 0, exerciseCount: group.length, skippedCount: 0, setCount: group.reduce((sum, entry) => sum + entry.setCount, 0), repCount: group.reduce((sum, entry) => sum + entry.sets.reduce((total, set) => total + setReps(set), 0), 0), volume: group.reduce((sum, entry) => sum + entry.volume, 0), entries: group, synthetic: true });
  });
  return result.filter((session) => session.entries.length).sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
}

function renderHistory() {
  const sessions = getHistorySessions();
  renderShell(`<section class="screen page-screen">${brand()}<div class="page-title"><p class="eyebrow">TU PROGRESO</p><h2>Historial</h2></div>${sessions.length ? `<div class="history-groups">${sessions.map((session) => `<button class="history-card" data-history-session="${escapeHtml(session.id)}"><span>${formatDate(session.startedAt)} · ${formatTime(session.startedAt)}</span><strong>${escapeHtml(session.label)}</strong><small>${session.entries.map((entry) => escapeHtml(entry.exercise)).join(" · ")}</small><div class="history-metrics"><b>${session.exerciseCount} ejercicios</b><b>${session.setCount} series</b><b>${formatNumber(session.volume)} lb</b>${session.durationSeconds ? `<b>${formatDuration(session.durationSeconds)}</b>` : ""}</div><i>${icon("right")}</i></button>`).join("")}</div>` : `<div class="empty-state"><strong>Aún no hay historial</strong><p>Completa un entrenamiento y aparecerá aquí.</p></div>`}</section>`, "history");
}

function renderHistoryDetail() {
  const session = getHistorySessions().find((item) => item.id === state.historySessionId);
  if (!session) { state.view = "history"; return render(); }
  const entries = session.entries.sort((a, b) => new Date(a.recordedAt) - new Date(b.recordedAt));
  renderShell(`<section class="screen page-screen"><header class="detail-header"><button class="icon-button" data-view="history">${icon("left")}</button><span>${formatDate(session.startedAt)}</span></header><div class="page-title"><p class="eyebrow">ENTRENAMIENTO COMPLETO</p><h2>${escapeHtml(session.label)}</h2><p class="session-detail-meta">${formatTime(session.startedAt)}${session.durationSeconds ? ` · ${formatDuration(session.durationSeconds)}` : ""} · ${formatNumber(session.volume)} lb</p></div><div class="session-entry-list">${entries.map((entry) => `<article class="session-entry"><header><div><strong>${escapeHtml(entry.exercise)}</strong><small>${escapeHtml(MUSCLE_GROUPS[entry.muscleGroup] || entry.muscleGroup)}</small></div><span>${formatNumber(entry.volume)} lb</span></header><div class="history-set-list">${entry.sets.map((set, index) => `<div><span>Serie ${index + 1}</span><strong class="history-set-description">${setDescription(set)}</strong></div>`).join("")}</div></article>`).join("")}</div><button class="delete-session" data-action="delete-session">Eliminar entrenamiento</button></section>`);
}

function renderSettings() {
  const settings = storage.getSettings();
  renderShell(`<section class="screen page-screen">${brand()}<div class="page-title"><p class="eyebrow">PREFERENCIAS Y DATOS</p><h2>Ajustes</h2></div><section class="settings-section"><h3>Modo de registro</h3><p>Elige cómo quieres confirmar las series.</p><div class="segmented"><button data-mode="exercise" class="${settings.trackingMode === "exercise" ? "active" : ""}"><strong>Por ejercicio</strong><small>Guarda todas juntas</small></button><button data-mode="set" class="${settings.trackingMode === "set" ? "active" : ""}"><strong>Por serie</strong><small>Marca cada serie</small></button></div></section><section class="settings-section"><h3>Copia de seguridad</h3><p>Exporta tus datos a un archivo o restaura un respaldo anterior.</p><div class="settings-actions"><button data-action="export">Exportar datos</button><button data-action="import">Importar respaldo</button></div></section><section class="settings-section danger-zone"><h3>Borrar datos</h3><p>Elimina historial, sesiones, ejercicios personalizados y preferencias.</p><button data-action="clear-data">Borrar todos los datos</button></section><p class="version">Sterk · Versión 1.3</p></section>`, "settings");
}

function render() {
  if (state.view === "home") renderHome();
  if (state.view === "builder") renderBuilder();
  if (state.view === "exercise") renderExercise();
  if (state.view === "complete") renderComplete();
  if (state.view === "history") renderHistory();
  if (state.view === "history-detail") renderHistoryDetail();
  if (state.view === "settings") renderSettings();
}

function updateTimers() { document.querySelectorAll("[data-session-start]").forEach((element) => { element.textContent = formatDuration(elapsedSeconds(element.dataset.sessionStart)); }); }
function showToast(message) { toast.textContent = message; toast.classList.add("visible"); window.setTimeout(() => toast.classList.remove("visible"), 1000); }
function goToExercise(index) { state.exerciseIndex = Math.max(0, Math.min(index, state.session.exercises.length - 1)); persistSession(); render(); window.scrollTo({ top: 0, behavior: "smooth" }); }
function parseDecimal(value) { return Number(String(value).trim().replace(",", ".")); }
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

app.addEventListener("submit", (event) => {
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
    state.builderFilter = "all";
    render();
    showToast("Ejercicio creado");
  } catch (error) { alert(error.message); }
});

app.addEventListener("click", (event) => {
  const viewButton = event.target.closest("[data-view]");
  if (viewButton) { state.view = viewButton.dataset.view; return render(); }
  const filterButton = event.target.closest("[data-filter]");
  if (filterButton) { state.builderFilter = filterButton.dataset.filter; return render(); }
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
  const weightButton = event.target.closest("[data-set-weight]");
  if (weightButton) { const set = draft().sets[Number(weightButton.dataset.setWeight)]; set.weight = Math.max(0, set.weight + Number(weightButton.dataset.delta)); persistSession(); return render(); }
  const repButton = event.target.closest("[data-set-reps]");
  if (repButton) { const set = editablePart(Number(repButton.dataset.setReps), repButton.dataset.side); set.reps = Math.max(0, set.reps + Number(repButton.dataset.delta)); markEdited(); persistSession(); return render(); }
  const setButton = event.target.closest("[data-toggle-set]");
  if (setButton) { const set = editablePart(Number(setButton.dataset.toggleSet), setButton.dataset.side); set.completed = !set.completed; markEdited(); persistSession(); return render(); }
  const jumpButton = event.target.closest("[data-jump]");
  if (jumpButton) return goToExercise(Number(jumpButton.dataset.jump));
  const editWeight = event.target.closest("[data-edit-weight]");
  if (editWeight) { const set = editablePart(Number(editWeight.dataset.editWeight), editWeight.dataset.side); openWeightPicker(set.weight, (weight) => { set.weight = weight; markEdited(); persistSession(); render(); }); return; }
  const editReps = event.target.closest("[data-edit-reps]");
  if (editReps) { const set = editablePart(Number(editReps.dataset.editReps), editReps.dataset.side); const value = prompt("Repeticiones", set.reps); if (value !== null && /^\d+$/.test(value.trim())) { set.reps = Number(value); markEdited(); persistSession(); render(); } return; }
  const modeButton = event.target.closest("[data-mode]");
  if (modeButton) { storage.saveSettings({ trackingMode: modeButton.dataset.mode }); showToast("Preferencia guardada"); return render(); }
  const action = event.target.closest("[data-action]")?.dataset.action;
  if (action === "new-session") { const active = storage.getActiveSession(); if (active && !confirm("Esto reemplazará la sesión en curso. ¿Continuar?")) return; if (active) storage.deleteSession(active.id); storage.clearActiveSession(); state.adding = false; state.builderQuery = ""; state.builderSelection = []; state.builderFilter = "all"; state.view = "builder"; render(); }
  if (action === "cancel-builder") { if (state.adding) { state.adding = false; state.view = "exercise"; render(); } else goHome(); }
  if (action === "start-session") { if (state.adding) { const selected = selectedExercises(); if (!selected.length) return; const first = state.session.exercises.length; state.session.exercises.push(...selected.map(newExerciseDraft)); state.adding = false; state.view = "exercise"; goToExercise(first); } else startSession(); }
  if (action === "resume") resumeSession();
  if (action === "home" || action === "leave-session") goHome();
  if (action === "discard-session" && confirm("¿Descartar la sesión en curso y sus registros?")) { const active = storage.getActiveSession(); if (active) storage.deleteSession(active.id); storage.clearActiveSession(); goHome(); }
  if (action === "add-set") { const previous = draft().sets.at(-1) || { weight: DEFAULT_ENTRY.weight, reps: 10 }; draft().sets.push(resetSet(previous)); markEdited(); persistSession(); render(); }
  if (action === "remove-set" && draft().sets.length > 1) { if (parts(draft().sets.at(-1)).some((part) => part.completed) && !confirm("¿Eliminar esta serie y sus datos?")) return; draft().sets.pop(); markEdited(); persistSession(); render(); }
  if (action === "copy-first-weight") { const first = draft().sets[0]; draft().sets.forEach((set) => { if (set.sides) SIDES.forEach((side) => { set.sides[side].weight = first.sides[side].weight; }); else set.weight = first.weight; }); markEdited(); persistSession(); render(); }
  if (action === "previous") goToExercise(state.exerciseIndex - 1);
  if (action === "next") goToExercise(state.exerciseIndex + 1);
  if (action === "skip") { const current = draft(); if (current.status === "skipped") current.status = "pending"; else { if (current.entryId && !confirm("¿Omitir este ejercicio y eliminar su registro de esta sesión?")) return; if (current.entryId) storage.deleteWorkoutEntry(current.entryId); current.entryId = null; current.status = "skipped"; } persistSession(); const pending = state.session.exercises.map((item, index) => ({ item, index })).filter(({ item }) => item.status === "pending"); if (!pending.length) render(); else { const next = pending.find(({ index }) => index > state.exerciseIndex) || pending[0]; goToExercise(next.index); } }
  if (action === "save") saveExercise();
  if (action === "delete-session" && confirm("¿Eliminar este entrenamiento completo? Esta acción no se puede deshacer.")) { const session = getHistorySessions().find((item) => item.id === state.historySessionId); if (session) storage.deleteSession(session.id, session.entries.map((entry) => entry.id)); state.view = "history"; render(); showToast("Entrenamiento eliminado"); }
  if (action === "export") exportData();
  if (action === "import") importInput.click();
  if (action === "clear-data" && confirm("¿Borrar todos los datos de Sterk en este dispositivo? Esta acción no se puede deshacer.")) { storage.clearAll(); goHome(); showToast("Todos los datos fueron eliminados"); }
  if (action === "update-app") location.reload();
});

importInput.addEventListener("change", async () => {
  const file = importInput.files[0];
  if (!file) return;
  try { storage.importData(JSON.parse(await file.text())); goHome(); showToast("Respaldo restaurado"); }
  catch (error) { alert(error.message); }
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
window.setInterval(updateTimers, 1000);
render();
