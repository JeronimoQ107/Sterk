import { DEFAULT_ENTRY, ROUTINES } from "./data.js";
import { storage } from "./storage.js";

const app = document.querySelector("#app");
const toast = document.querySelector("#toast");

const state = {
  view: "home",
  routineId: null,
  exerciseIndex: 0,
  sessionStartedAt: null,
  sessionEntries: [],
  draft: null,
};

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatNumber(value) {
  return Number.isInteger(value) ? String(value) : String(value.toFixed(1)).replace(".", ",");
}

function currentRoutine() {
  return ROUTINES[state.routineId];
}

function currentExercise() {
  return currentRoutine().exercises[state.exerciseIndex];
}

function createDraft() {
  const previous = storage.getLastExerciseEntry(state.routineId, currentExercise());
  state.draft = {
    weight: previous?.weight ?? DEFAULT_ENTRY.weight,
    reps: [...(previous?.reps ?? DEFAULT_ENTRY.reps)],
  };
}

function startRoutine(routineId) {
  state.routineId = routineId;
  state.exerciseIndex = 0;
  state.sessionStartedAt = new Date();
  state.sessionEntries = [];
  state.view = "exercise";
  createDraft();
  render();
}

function renderHome() {
  app.innerHTML = `
    <section class="screen home-screen">
      <header class="brand-lockup">
        <span class="brand-mark" aria-hidden="true">GT</span>
        <h1>Gym Tracker</h1>
      </header>
      <div class="home-copy">
        <p class="eyebrow">LISTO PARA ENTRENAR</p>
        <h2>¿Qué entrenas hoy?</h2>
      </div>
      <div class="routine-list">
        ${Object.entries(ROUTINES).map(([id, routine], index) => `
          <button class="routine-card" data-routine="${id}" type="button">
            <span class="routine-number">0${index + 1}</span>
            <span>
              <strong>${routine.name}</strong>
              <small>${routine.exercises.length} ejercicios</small>
            </span>
            <span class="arrow" aria-hidden="true">→</span>
          </button>
        `).join("")}
      </div>
      <p class="local-note"><span aria-hidden="true">●</span> Tus datos permanecen en este dispositivo</p>
    </section>`;
}

function renderPrevious(previous) {
  if (!previous) {
    return `<div class="previous empty"><span>Última vez</span><strong>Sin registros</strong><small>Este será tu punto de partida</small></div>`;
  }
  return `
    <div class="previous">
      <span>Última vez</span>
      <strong>${formatNumber(previous.weight)} <small>lb</small></strong>
      <p>${previous.reps.map(escapeHtml).join(" · ")}</p>
    </div>`;
}

function renderExercise() {
  const routine = currentRoutine();
  const exercise = currentExercise();
  const previous = storage.getLastExerciseEntry(state.routineId, exercise);
  const { weight, reps } = state.draft;

  app.innerHTML = `
    <section class="screen exercise-screen">
      <header class="exercise-header">
        <button class="icon-button" data-action="home" type="button" aria-label="Volver al inicio">←</button>
        <div class="progress-copy">
          <span>${routine.name}</span>
          <strong>${state.exerciseIndex + 1} de ${routine.exercises.length}</strong>
        </div>
        <div class="progress-track" aria-hidden="true"><i style="width:${((state.exerciseIndex + 1) / routine.exercises.length) * 100}%"></i></div>
      </header>

      <div class="exercise-title">
        <p class="eyebrow">EJERCICIO ${String(state.exerciseIndex + 1).padStart(2, "0")}</p>
        <h1>${escapeHtml(exercise)}</h1>
      </div>

      ${renderPrevious(previous)}

      <section class="control-section weight-section" aria-labelledby="weight-label">
        <div class="section-heading"><h2 id="weight-label">Peso actual</h2><span>LIBRAS</span></div>
        <div class="weight-value"><strong>${formatNumber(weight)}</strong><span>lb</span></div>
        <div class="weight-buttons">
          ${[-5, -2.5, 2.5, 5].map((amount) => `<button type="button" data-weight="${amount}">${amount > 0 ? "+" : ""}${formatNumber(amount)}</button>`).join("")}
        </div>
      </section>

      <section class="control-section sets-section" aria-labelledby="sets-label">
        <div class="section-heading"><h2 id="sets-label">Series</h2><span>${reps.length} TOTAL</span></div>
        <div class="sets-list">
          ${reps.map((rep, index) => `
            <div class="set-row">
              <span class="set-label">${String(index + 1).padStart(2, "0")}</span>
              <button type="button" class="rep-button" data-rep-index="${index}" data-delta="-1" aria-label="Disminuir repeticiones de la serie ${index + 1}">−</button>
              <button type="button" class="rep-value" data-edit-rep="${index}" aria-label="Editar repeticiones de la serie ${index + 1}">${rep}</button>
              <button type="button" class="rep-button" data-rep-index="${index}" data-delta="1" aria-label="Aumentar repeticiones de la serie ${index + 1}">+</button>
            </div>
          `).join("")}
        </div>
        <div class="set-actions">
          <button type="button" data-action="remove-set" ${reps.length <= 1 ? "disabled" : ""}>− Eliminar última</button>
          <button type="button" data-action="add-set">＋ Añadir serie</button>
        </div>
      </section>

      <footer class="sticky-action">
        <button class="primary-button" type="button" data-action="save">Registrar ejercicio <span aria-hidden="true">→</span></button>
      </footer>
    </section>`;
}

function renderComplete() {
  const routine = currentRoutine();
  const totalVolume = state.sessionEntries.reduce((sum, entry) => sum + entry.volume, 0);
  const minutes = Math.max(1, Math.round((Date.now() - state.sessionStartedAt.getTime()) / 60000));
  app.innerHTML = `
    <section class="screen complete-screen">
      <div class="completion-mark" aria-hidden="true">✓</div>
      <p class="eyebrow">RUTINA FINALIZADA</p>
      <h1>Entrenamiento<br>completado</h1>
      <p class="routine-name">${routine.name}</p>
      <div class="summary-grid">
        <div><strong>${state.sessionEntries.length}</strong><span>Ejercicios</span></div>
        <div><strong>${formatNumber(totalVolume)}</strong><span>Volumen · lb</span></div>
        <div><strong>~${minutes}</strong><span>Minutos</span></div>
      </div>
      <button class="primary-button" type="button" data-action="home">Volver al inicio</button>
    </section>`;
}

function render() {
  if (state.view === "home") renderHome();
  if (state.view === "exercise") renderExercise();
  if (state.view === "complete") renderComplete();
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  window.setTimeout(() => toast.classList.remove("visible"), 850);
}

function goHome() {
  state.view = "home";
  state.routineId = null;
  state.draft = null;
  render();
}

function saveExercise() {
  const now = new Date();
  const reps = [...state.draft.reps];
  const entry = {
    id: globalThis.crypto?.randomUUID?.() ?? `${now.getTime()}-${Math.random()}`,
    recordedAt: now.toISOString(),
    date: now.toLocaleDateString("es-CO"),
    time: now.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" }),
    routineId: state.routineId,
    routine: currentRoutine().name,
    exercise: currentExercise(),
    weight: state.draft.weight,
    reps,
    setCount: reps.length,
    volume: state.draft.weight * reps.reduce((sum, rep) => sum + rep, 0),
  };

  storage.saveWorkoutEntry(entry);
  state.sessionEntries.push(entry);
  showToast("Ejercicio registrado ✓");

  if (state.exerciseIndex === currentRoutine().exercises.length - 1) {
    window.setTimeout(() => {
      state.view = "complete";
      render();
    }, 500);
    return;
  }

  window.setTimeout(() => {
    state.exerciseIndex += 1;
    createDraft();
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, 500);
}

app.addEventListener("click", (event) => {
  const routineButton = event.target.closest("[data-routine]");
  if (routineButton) return startRoutine(routineButton.dataset.routine);

  const weightButton = event.target.closest("[data-weight]");
  if (weightButton) {
    state.draft.weight = Math.max(0, state.draft.weight + Number(weightButton.dataset.weight));
    return render();
  }

  const repButton = event.target.closest("[data-rep-index]");
  if (repButton) {
    const index = Number(repButton.dataset.repIndex);
    state.draft.reps[index] = Math.max(0, state.draft.reps[index] + Number(repButton.dataset.delta));
    return render();
  }

  const editButton = event.target.closest("[data-edit-rep]");
  if (editButton) {
    const index = Number(editButton.dataset.editRep);
    const value = window.prompt("Repeticiones", state.draft.reps[index]);
    if (value !== null && /^\d+$/.test(value.trim())) {
      state.draft.reps[index] = Number(value);
      render();
    }
    return;
  }

  const action = event.target.closest("[data-action]")?.dataset.action;
  if (action === "home") goHome();
  if (action === "add-set") {
    state.draft.reps.push(state.draft.reps.at(-1) ?? 10);
    render();
  }
  if (action === "remove-set" && state.draft.reps.length > 1) {
    state.draft.reps.pop();
    render();
  }
  if (action === "save") saveExercise();
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./service-worker.js"));
}

render();
