import { DEFAULT_ENTRY, ROUTINES } from "./data.js";
import { storage } from "./storage.js";

const app = document.querySelector("#app");
const toast = document.querySelector("#toast");
const importInput = document.querySelector("#import-data");
const state = { view: "home", session: null, exerciseIndex: 0, historyExercise: null, completion: null, updateWaiting: false };

const uid = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
const escapeHtml = (value) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
const formatNumber = (value) => Number.isInteger(Number(value)) ? String(value) : Number(value).toFixed(1).replace(".", ",");
const formatDate = (value) => new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
function routine() { return ROUTINES[state.session.routineId]; }
function exerciseName(index = state.exerciseIndex) { return routine().exercises[index]; }
function draft(index = state.exerciseIndex) { return state.session.exercises[index]; }

function newExerciseDraft(routineId, exercise) {
  const previous = storage.getLastExerciseEntry(routineId, exercise);
  const reps = [...(previous?.reps ?? DEFAULT_ENTRY.reps)];
  return { weight: previous?.weight ?? DEFAULT_ENTRY.weight, reps, completedSets: reps.map(() => false), status: "pending", entryId: null };
}

function persistSession() {
  if (!state.session) return;
  state.session.exerciseIndex = state.exerciseIndex;
  storage.saveActiveSession(state.session);
}

function startRoutine(routineId) {
  const selected = ROUTINES[routineId];
  state.session = { id: uid(), routineId, startedAt: new Date().toISOString(), trackingMode: storage.getSettings().trackingMode, exerciseIndex: 0, exercises: selected.exercises.map((exercise) => newExerciseDraft(routineId, exercise)) };
  state.exerciseIndex = 0;
  state.view = "exercise";
  persistSession();
  render();
}

function resumeSession() {
  state.session = storage.getActiveSession();
  if (!state.session || !ROUTINES[state.session.routineId]) return goHome();
  state.exerciseIndex = Math.min(state.session.exerciseIndex || 0, routine().exercises.length - 1);
  state.view = "exercise";
  render();
}

function goHome() { state.view = "home"; state.session = null; state.completion = null; render(); }
function brand() { return `<header class="brand-lockup"><span class="brand-mark" aria-hidden="true">S</span><h1>Sterk</h1></header>`; }

function renderShell(content, active = "") {
  app.innerHTML = `${content}${!['exercise', 'complete'].includes(state.view) ? `<nav class="bottom-nav" aria-label="Navegación principal"><button data-view="home" class="${active === "home" ? "active" : ""}"><span>⌂</span>Inicio</button><button data-view="history" class="${active === "history" ? "active" : ""}"><span>↺</span>Historial</button><button data-view="settings" class="${active === "settings" ? "active" : ""}"><span>⚙</span>Ajustes</button></nav>` : ""}`;
}

function currentNameFromStored(session) {
  const selected = ROUTINES[session.routineId];
  return selected?.exercises[Math.min(session.exerciseIndex || 0, selected.exercises.length - 1)] || "";
}

function renderHome() {
  const active = storage.getActiveSession();
  renderShell(`<section class="screen home-screen">${brand()}${state.updateWaiting ? `<button class="update-banner" data-action="update-app">Nueva versión disponible · Actualizar</button>` : ""}${active && ROUTINES[active.routineId] ? `<section class="resume-card"><div><span>SESIÓN EN CURSO</span><strong>${ROUTINES[active.routineId].name}</strong><small>${currentNameFromStored(active)}</small></div><button data-action="resume">Continuar →</button><button class="text-button danger" data-action="discard-session">Descartar sesión</button></section>` : ""}<div class="home-copy"><p class="eyebrow">FUERZA, SIN DISTRACCIONES</p><h2>¿Qué entrenas hoy?</h2></div><div class="routine-list">${Object.entries(ROUTINES).map(([id, item], index) => `<button class="routine-card" data-routine="${id}"><span class="routine-number">0${index + 1}</span><span><strong>${item.name}</strong><small>${item.exercises.length} ejercicios</small></span><span class="arrow">→</span></button>`).join("")}</div><p class="local-note"><span>●</span> Tus datos permanecen en este dispositivo</p></section>`, "home");
}

function renderPrevious(previous) {
  if (!previous) return `<div class="previous empty"><span>Última vez</span><strong>Sin registros</strong><small>Este será tu punto de partida</small></div>`;
  return `<div class="previous"><span>Última vez</span><strong>${formatNumber(previous.weight)} <small>lb</small></strong><p>${previous.reps.join(" · ")}</p></div>`;
}

function renderExercise() {
  const current = draft();
  const previous = storage.getLastExerciseEntry(state.session.routineId, exerciseName());
  const setMode = state.session.trackingMode === "set";
  const completed = current.completedSets.filter(Boolean).length;
  renderShell(`<section class="screen exercise-screen"><header class="exercise-header"><button class="icon-button" data-action="leave-session" aria-label="Volver al inicio">←</button><div class="progress-copy"><span>${routine().name}</span><strong>${state.exerciseIndex + 1} de ${routine().exercises.length}</strong></div><div class="progress-track"><i style="width:${((state.exerciseIndex + 1) / routine().exercises.length) * 100}%"></i></div></header><div class="exercise-jump" aria-label="Ejercicios">${routine().exercises.map((name, index) => `<button data-jump="${index}" class="${index === state.exerciseIndex ? "active" : ""} ${state.session.exercises[index].status}"><span>${index + 1}</span><small>${escapeHtml(name)}</small></button>`).join("")}</div><div class="exercise-title"><p class="eyebrow">${current.status === "skipped" ? "EJERCICIO OMITIDO" : `EJERCICIO ${String(state.exerciseIndex + 1).padStart(2, "0")}`}</p><h1>${escapeHtml(exerciseName())}</h1></div>${renderPrevious(previous)}<section class="control-section weight-section"><div class="section-heading"><h2>Peso actual</h2><span>LIBRAS</span></div><div class="weight-value"><strong>${formatNumber(current.weight)}</strong><span>lb</span></div><div class="weight-buttons">${[-5, -2.5, 2.5, 5].map((amount) => `<button data-weight="${amount}">${amount > 0 ? "+" : ""}${formatNumber(amount)}</button>`).join("")}</div></section><section class="control-section sets-section"><div class="section-heading"><h2>Series</h2><span>${setMode ? `${completed}/${current.reps.length} HECHAS` : `${current.reps.length} TOTAL`}</span></div><div class="sets-list">${current.reps.map((rep, index) => `<div class="set-row ${current.completedSets[index] ? "done" : ""} ${setMode ? "set-mode" : ""}">${setMode ? `<button class="set-check" data-toggle-set="${index}" aria-label="${current.completedSets[index] ? "Desmarcar" : "Completar"} serie ${index + 1}">${current.completedSets[index] ? "✓" : String(index + 1).padStart(2, "0")}</button>` : `<span class="set-label">${String(index + 1).padStart(2, "0")}</span>`}<button class="rep-button" data-rep-index="${index}" data-delta="-1" aria-label="Disminuir repeticiones de la serie ${index + 1}">−</button><button class="rep-value" data-edit-rep="${index}" aria-label="Editar repeticiones de la serie ${index + 1}">${rep}</button><button class="rep-button" data-rep-index="${index}" data-delta="1" aria-label="Aumentar repeticiones de la serie ${index + 1}">+</button></div>`).join("")}</div><div class="set-actions"><button data-action="remove-set" ${current.reps.length <= 1 ? "disabled" : ""}>− Eliminar última</button><button data-action="add-set">＋ Añadir serie</button></div></section><div class="exercise-secondary-actions"><button data-action="previous" ${state.exerciseIndex === 0 ? "disabled" : ""}>← Anterior</button><button data-action="skip">${current.status === "skipped" ? "Recuperar" : "Omitir"}</button><button data-action="next" ${state.exerciseIndex === routine().exercises.length - 1 ? "disabled" : ""}>Siguiente →</button></div><footer class="sticky-action"><button class="primary-button" data-action="save">${current.entryId ? "Actualizar ejercicio" : "Registrar ejercicio"}<span>→</span></button></footer></section>`);
}

function saveExercise() {
  const current = draft();
  const now = new Date();
  const entry = { id: current.entryId || uid(), sessionId: state.session.id, recordedAt: now.toISOString(), date: now.toLocaleDateString("es-CO"), time: now.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" }), routineId: state.session.routineId, routine: routine().name, exercise: exerciseName(), weight: current.weight, reps: [...current.reps], completedSets: [...current.completedSets], setCount: current.reps.length, volume: current.weight * current.reps.reduce((sum, rep) => sum + rep, 0), trackingMode: state.session.trackingMode };
  storage.saveWorkoutEntry(entry);
  current.entryId = entry.id;
  current.status = "registered";
  persistSession();
  showToast("Ejercicio registrado ✓");
  const pending = state.session.exercises.map((item, index) => ({ item, index })).filter(({ item }) => item.status === "pending");
  const next = pending.find(({ index }) => index > state.exerciseIndex) || pending[0];
  window.setTimeout(() => next ? goToExercise(next.index) : completeSession(), 400);
}

function completeSession() {
  const entries = storage.getEntries().filter((entry) => entry.sessionId === state.session.id);
  const endedAt = new Date();
  const summary = { id: state.session.id, routineId: state.session.routineId, routine: routine().name, startedAt: state.session.startedAt, endedAt: endedAt.toISOString(), durationMinutes: Math.max(1, Math.round((endedAt - new Date(state.session.startedAt)) / 60000)), exerciseCount: entries.length, skippedCount: state.session.exercises.filter((item) => item.status === "skipped").length, setCount: entries.reduce((sum, entry) => sum + entry.setCount, 0), repCount: entries.reduce((sum, entry) => sum + entry.reps.reduce((a, b) => a + b, 0), 0), volume: entries.reduce((sum, entry) => sum + entry.volume, 0) };
  const previous = storage.getCompletedSessions().filter((item) => item.routineId === summary.routineId).at(-1) || null;
  storage.saveCompletedSession(summary);
  storage.clearActiveSession();
  state.completion = { summary, previous };
  state.view = "complete";
  render();
}

function renderComplete() {
  const { summary, previous } = state.completion;
  const difference = previous ? summary.volume - previous.volume : null;
  renderShell(`<section class="screen complete-screen"><div class="completion-mark">✓</div><p class="eyebrow">RUTINA FINALIZADA</p><h1>Entrenamiento<br>completado</h1><p class="routine-name">${summary.routine}</p><div class="summary-grid"><div><strong>${summary.exerciseCount}</strong><span>Ejercicios</span></div><div><strong>${summary.setCount}</strong><span>Series</span></div><div><strong>${summary.repCount}</strong><span>Repeticiones</span></div><div><strong>${formatNumber(summary.volume)}</strong><span>Volumen · lb</span></div><div><strong>${summary.durationMinutes}</strong><span>Minutos aprox.</span></div><div><strong>${summary.skippedCount}</strong><span>Omitidos</span></div></div><div class="comparison">${difference === null ? "Primera sesión de esta rutina" : `${difference >= 0 ? "+" : ""}${formatNumber(difference)} lb de volumen frente a la anterior`}</div><button class="primary-button static" data-action="home">Volver al inicio</button></section>`);
}

function renderHistory() {
  const entries = storage.getEntries().sort((a, b) => new Date(b.recordedAt) - new Date(a.recordedAt));
  const groups = Object.entries(ROUTINES).flatMap(([routineId, item]) => item.exercises.map((exercise) => ({ routineId, routine: item.name, exercise, history: entries.filter((entry) => entry.routineId === routineId && entry.exercise === exercise) }))).filter((group) => group.history.length);
  renderShell(`<section class="screen page-screen">${brand()}<div class="page-title"><p class="eyebrow">TU PROGRESO</p><h2>Historial</h2></div>${groups.length ? `<div class="history-groups">${groups.map((group) => { const latest = group.history[0]; return `<button class="history-card" data-history-id="${group.routineId}" data-history-exercise="${escapeHtml(group.exercise)}"><span>${group.routine}</span><strong>${escapeHtml(group.exercise)}</strong><small>${formatNumber(latest.weight)} lb · ${latest.reps.join(" · ")} · ${group.history.length} registros</small><i>→</i></button>`; }).join("")}</div>` : `<div class="empty-state"><strong>Aún no hay historial</strong><p>Completa un ejercicio y aparecerá aquí.</p></div>`}</section>`, "history");
}

function renderHistoryDetail() {
  const [routineId, exercise] = state.historyExercise;
  const entries = storage.getExerciseHistory(routineId, exercise);
  renderShell(`<section class="screen page-screen"><header class="detail-header"><button class="icon-button" data-view="history">←</button><span>${ROUTINES[routineId].name}</span></header><div class="page-title"><p class="eyebrow">HISTORIAL DEL EJERCICIO</p><h2>${escapeHtml(exercise)}</h2></div><div class="entry-list">${entries.map((entry) => `<article class="entry-card"><div><strong>${formatNumber(entry.weight)} <small>lb</small></strong><span>${entry.reps.join(" · ")}</span></div><div><time>${formatDate(entry.recordedAt)}</time><small>${formatNumber(entry.volume)} lb de volumen</small><button class="delete-entry" data-delete-entry="${entry.id}">Eliminar</button></div></article>`).join("")}</div></section>`);
}

function renderSettings() {
  const settings = storage.getSettings();
  renderShell(`<section class="screen page-screen">${brand()}<div class="page-title"><p class="eyebrow">PREFERENCIAS Y DATOS</p><h2>Ajustes</h2></div><section class="settings-section"><h3>Modo de registro</h3><p>Elige cómo confirmar las series. Ningún modo utiliza temporizadores.</p><div class="segmented"><button data-mode="exercise" class="${settings.trackingMode === "exercise" ? "active" : ""}"><strong>Por ejercicio</strong><small>Guarda todas juntas</small></button><button data-mode="set" class="${settings.trackingMode === "set" ? "active" : ""}"><strong>Por serie</strong><small>Marca cada serie libremente</small></button></div></section><section class="settings-section"><h3>Copia de seguridad</h3><p>Exporta tus datos a un archivo o restaura un respaldo anterior.</p><div class="settings-actions"><button data-action="export">Exportar datos</button><button data-action="import">Importar respaldo</button></div></section><section class="settings-section danger-zone"><h3>Borrar datos</h3><p>Elimina historial, sesiones y preferencias de este dispositivo.</p><button data-action="clear-data">Borrar todos los datos</button></section><p class="version">Sterk · Versión 1</p></section>`, "settings");
}

function render() {
  if (state.view === "home") renderHome();
  if (state.view === "exercise") renderExercise();
  if (state.view === "complete") renderComplete();
  if (state.view === "history") renderHistory();
  if (state.view === "history-detail") renderHistoryDetail();
  if (state.view === "settings") renderSettings();
}

function showToast(message) { toast.textContent = message; toast.classList.add("visible"); window.setTimeout(() => toast.classList.remove("visible"), 1000); }
function goToExercise(index) { state.exerciseIndex = Math.max(0, Math.min(index, routine().exercises.length - 1)); persistSession(); render(); window.scrollTo({ top: 0, behavior: "smooth" }); }
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
  showToast("Respaldo exportado ✓");
}

app.addEventListener("click", (event) => {
  const routineButton = event.target.closest("[data-routine]");
  if (routineButton) { if (storage.getActiveSession() && !confirm("Esto reemplazará la sesión en curso. ¿Continuar?")) return; storage.clearActiveSession(); return startRoutine(routineButton.dataset.routine); }
  const viewButton = event.target.closest("[data-view]");
  if (viewButton) { state.view = viewButton.dataset.view; return render(); }
  const historyButton = event.target.closest("[data-history-id]");
  if (historyButton) { state.historyExercise = [historyButton.dataset.historyId, historyButton.dataset.historyExercise]; state.view = "history-detail"; return render(); }
  const weightButton = event.target.closest("[data-weight]");
  if (weightButton) { draft().weight = Math.max(0, draft().weight + Number(weightButton.dataset.weight)); persistSession(); return render(); }
  const repButton = event.target.closest("[data-rep-index]");
  if (repButton) { const index = Number(repButton.dataset.repIndex); draft().reps[index] = Math.max(0, draft().reps[index] + Number(repButton.dataset.delta)); persistSession(); return render(); }
  const setButton = event.target.closest("[data-toggle-set]");
  if (setButton) { const index = Number(setButton.dataset.toggleSet); draft().completedSets[index] = !draft().completedSets[index]; persistSession(); return render(); }
  const jumpButton = event.target.closest("[data-jump]");
  if (jumpButton) return goToExercise(Number(jumpButton.dataset.jump));
  const editButton = event.target.closest("[data-edit-rep]");
  if (editButton) { const index = Number(editButton.dataset.editRep); const value = prompt("Repeticiones", draft().reps[index]); if (value !== null && /^\d+$/.test(value.trim())) { draft().reps[index] = Number(value); persistSession(); render(); } return; }
  const modeButton = event.target.closest("[data-mode]");
  if (modeButton) { storage.saveSettings({ trackingMode: modeButton.dataset.mode }); showToast("Preferencia guardada ✓"); return render(); }
  const deleteButton = event.target.closest("[data-delete-entry]");
  if (deleteButton && confirm("¿Eliminar este registro? Esta acción no se puede deshacer.")) { storage.deleteWorkoutEntry(deleteButton.dataset.deleteEntry); render(); showToast("Registro eliminado"); return; }
  const action = event.target.closest("[data-action]")?.dataset.action;
  if (action === "resume") resumeSession();
  if (action === "home" || action === "leave-session") goHome();
  if (action === "discard-session" && confirm("¿Descartar la sesión en curso? Los ejercicios ya registrados permanecerán en el historial.")) { storage.clearActiveSession(); goHome(); }
  if (action === "add-set") { draft().reps.push(draft().reps.at(-1) ?? 10); draft().completedSets.push(false); persistSession(); render(); }
  if (action === "remove-set" && draft().reps.length > 1) { draft().reps.pop(); draft().completedSets.pop(); persistSession(); render(); }
  if (action === "previous") goToExercise(state.exerciseIndex - 1);
  if (action === "next") goToExercise(state.exerciseIndex + 1);
  if (action === "skip") { draft().status = draft().status === "skipped" ? "pending" : "skipped"; persistSession(); const pending = state.session.exercises.map((item, index) => ({ item, index })).filter(({ item }) => item.status === "pending"); if (!pending.length) completeSession(); else { const next = pending.find(({ index }) => index > state.exerciseIndex) || pending[0]; goToExercise(next.index); } }
  if (action === "save") saveExercise();
  if (action === "export") exportData();
  if (action === "import") importInput.click();
  if (action === "clear-data" && confirm("¿Borrar todos los datos de Sterk en este dispositivo? Esta acción no se puede deshacer.")) { storage.clearAll(); goHome(); showToast("Todos los datos fueron eliminados"); }
  if (action === "update-app") location.reload();
});

importInput.addEventListener("change", async () => {
  const file = importInput.files[0];
  if (!file) return;
  try { storage.importData(JSON.parse(await file.text())); goHome(); showToast("Respaldo restaurado ✓"); }
  catch (error) { alert(error.message); }
  finally { importInput.value = ""; }
});

if ("serviceWorker" in navigator) window.addEventListener("load", async () => {
  const registration = await navigator.serviceWorker.register("./service-worker.js");
  registration.addEventListener("updatefound", () => { const worker = registration.installing; worker?.addEventListener("statechange", () => { if (worker.state === "installed" && navigator.serviceWorker.controller) { state.updateWaiting = true; if (state.view === "home") render(); } }); });
});

render();
