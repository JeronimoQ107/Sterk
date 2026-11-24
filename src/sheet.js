// UX-04: hojas inferiores y confirmaciones propias en lugar de alert() y confirm().
import { escapeHtml } from "./format.js";
import { canMove } from "./motion.js";

const CLOSE_MS = 240;

// Convierte un <dialog> en hoja inferior: entra y sale animada, y se cierra con Escape, tocando fuera o arrastrándola.
// `dialog.close()` se puede seguir llamando igual; el evento "close" llega cuando termina de salir.
export function showSheet(dialog) {
  dialog.classList.add("ui-sheet");
  const handle = document.createElement("span");
  handle.className = "ui-sheet-handle";
  handle.setAttribute("aria-hidden", "true");
  const addHandle = () => { if (dialog.firstChild !== handle) dialog.prepend(handle); };
  addHandle();
  // Las hojas que se redibujan con innerHTML conservan el tirador.
  new MutationObserver(addHandle).observe(dialog, { childList: true });
  const finish = dialog.close.bind(dialog);
  let closing = false;
  dialog.close = () => {
    if (closing || !dialog.open) return;
    closing = true;
    if (!canMove()) { finish(); return; }
    dialog.classList.add("closing");
    window.setTimeout(finish, CLOSE_MS);
  };
  dialog.addEventListener("cancel", (event) => { event.preventDefault(); dialog.close(); });
  dialog.addEventListener("click", (event) => {
    if (event.target !== dialog || dragged) return;
    const box = dialog.getBoundingClientRect(); // tocar el borde interior de la hoja no la cierra
    if (event.clientY < box.top || event.clientX < box.left || event.clientX > box.right) dialog.close();
  });

  let drag = null, dragged = false;
  dialog.addEventListener("pointerdown", (event) => {
    dragged = false;
    if (!event.isPrimary || event.target.closest("input, select, textarea, [data-scroll]")) return;
    drag = { y: event.clientY, distance: 0, time: performance.now() };
  });
  dialog.addEventListener("pointermove", (event) => {
    if (!drag || closing) return;
    drag.distance = event.clientY - drag.y;
    if (Math.abs(drag.distance) < 6) return;
    dragged = true;
    dialog.style.transition = "none";
    dialog.style.transform = `translateY(${drag.distance > 0 ? drag.distance : drag.distance / 6}px)`;
  });
  const release = () => {
    if (!drag) return;
    const { distance, time } = drag;
    drag = null;
    dialog.style.transition = "";
    const thrown = distance > 30 && distance / (performance.now() - time) > 0.6;
    if (distance > 90 || thrown) { dialog.style.setProperty("--from", `${distance}px`); dialog.style.transform = ""; dialog.close(); }
    else dialog.style.transform = "";
    window.setTimeout(() => { dragged = false; }, 80);
  };
  dialog.addEventListener("pointerup", release);
  dialog.addEventListener("pointercancel", release);
  // Un arrastre no cuenta como toque en el botón donde empezó.
  dialog.addEventListener("click", (event) => { if (dragged) { event.preventDefault(); event.stopImmediatePropagation(); } }, true);
  dialog.showModal();
}

function build({ title, text, buttons }) {
  const opener = document.activeElement;
  const dialog = document.createElement("dialog");
  dialog.className = "ui-ask";
  dialog.setAttribute("aria-label", title);
  dialog.innerHTML = `<h2 tabindex="-1" autofocus>${escapeHtml(title)}</h2>${text ? `<p>${escapeHtml(text)}</p>` : ""}${buttons}`;
  dialog.addEventListener("close", () => { dialog.remove(); if (opener?.isConnected) opener.focus?.({ preventScroll: true }); });
  document.body.append(dialog);
  return dialog;
}

// Pregunta antes de una acción. Solo llama a `onAccept` si se pulsa el botón de aceptar; `onCancel` es opcional.
export function ask({ title, text = "", action, danger = false, cancel = "Cancelar" }, onAccept, onCancel) {
  const dialog = build({ title, text, buttons: `<button class="ui-button ${danger ? "ui-button-danger" : ""}" data-accept>${escapeHtml(action)}</button><button class="ui-button-plain" data-dismiss>${escapeHtml(cancel)}</button>` });
  let accepted = false;
  dialog.addEventListener("click", (event) => {
    if (event.target.closest("[data-accept]")) { accepted = true; dialog.close(); onAccept(); }
    else if (event.target.closest("[data-dismiss]")) dialog.close();
  });
  dialog.addEventListener("close", () => { if (!accepted) onCancel?.(); });
  showSheet(dialog);
}

// Aviso que requiere leerlo (un error, por ejemplo). Los avisos breves usan el toast.
export function notice(text, title = "No se pudo completar") {
  const dialog = build({ title, text, buttons: `<button class="ui-button" data-dismiss>Entendido</button>` });
  dialog.addEventListener("click", (event) => { if (event.target.closest("[data-dismiss]")) dialog.close(); });
  showSheet(dialog);
}
