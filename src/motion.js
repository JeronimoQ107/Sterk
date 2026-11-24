// UI-03: movimiento de la interfaz, sin librerías. Todo es opcional: sin soporte del navegador o con «Reducir
// movimiento», las mismas funciones cambian la pantalla al instante.
const reduced = () => Boolean(globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
export const canMove = () => !reduced() && typeof Element !== "undefined" && typeof Element.prototype.animate === "function";

// Las mismas curvas que --spring y --soft en styles.css.
export const SPRING = "cubic-bezier(.3, 1.4, .5, 1)";
export const SOFT = "cubic-bezier(.22, 1, .36, 1)";

export function animate(element, keyframes, { duration = 360, delay = 0, easing = SOFT } = {}) {
  if (!element || !canMove()) return Promise.resolve();
  return element.animate(keyframes, { duration, delay, easing, fill: "backwards" }).finished.catch(() => {});
}

// Espera para que se vea una animación antes de seguir. Sin movimiento, sigue sin esperar.
export function afterPause(milliseconds, next) {
  if (canMove()) window.setTimeout(next, milliseconds);
  else next();
}

/* ---------- Actualizar la pantalla sin reconstruirla ---------- */

// Los elementos que siguen existiendo se conservan (con su foco, su desplazamiento y sus transiciones CSS) y solo
// cambia lo distinto. `data-key` identifica filas que pueden añadirse, quitarse o reordenarse; si la clave de un
// bloque cambia, el bloque se sustituye entero.
export function paint(root, html, fresh = false) {
  if (fresh || !root.firstElementChild) { root.innerHTML = html; return; }
  const template = document.createElement("template");
  template.innerHTML = html;
  morphChildren(root, template.content);
}

const keyOf = (node) => node.nodeType === 1 ? node.getAttribute("data-key") || node.id || "" : "";
const leaving = (node) => node.nodeType === 1 && node.hasAttribute("data-leaving");
const skipLeaving = (node) => { while (node && leaving(node)) node = node.nextSibling; return node; };
function alike(current, next) {
  if (current.nodeType !== next.nodeType || current.nodeName !== next.nodeName || keyOf(current) !== keyOf(next)) return false;
  return current.nodeType !== 1 || Boolean(keyOf(next)) || (current.classList[0] || "") === (next.classList[0] || "");
}
function morphChildren(current, next) {
  const keyed = new Map([...current.children].filter((child) => keyOf(child) && !leaving(child)).map((child) => [keyOf(child), child]));
  let cursor = skipLeaving(current.firstChild);
  for (const child of [...next.childNodes]) {
    const key = keyOf(child);
    let match = key ? keyed.get(key) : cursor;
    if (!key) while (match && (leaving(match) || !alike(match, child))) match = match.nextSibling;
    if (match && alike(match, child)) {
      keyed.delete(key);
      if (match === cursor) cursor = skipLeaving(cursor.nextSibling);
      else current.insertBefore(match, cursor);
      morphNode(match, child);
    } else {
      current.insertBefore(child, cursor);
      if (child.nodeType === 1 && child.hasAttribute("data-enter")) unfold(child);
    }
  }
  while (cursor) {
    const gone = cursor;
    cursor = skipLeaving(cursor.nextSibling);
    if (gone.nodeType === 1 && gone.hasAttribute("data-enter") && canMove()) foldAway(gone);
    else gone.remove();
  }
}
function morphNode(current, next) {
  if (current.nodeType !== 1) { if (current.data !== next.data) current.data = next.data; return; }
  for (const { name } of [...current.attributes]) if (!next.hasAttribute(name)) current.removeAttribute(name);
  for (const { name, value } of [...next.attributes]) if (current.getAttribute(name) !== value) current.setAttribute(name, value);
  // Un campo en uso conserva lo que se está escribiendo; los demás toman el valor nuevo.
  if (current.nodeName === "INPUT" && current !== document.activeElement && current.value !== next.value) current.value = next.value;
  if (current.hasAttribute("data-keep")) return; // su contenido lo gestiona el código (el vídeo de la técnica)
  if (current.hasAttribute("data-roll")) { roll(current, next.textContent); return; }
  morphChildren(current, next);
}

function unfold(element) {
  if (!canMove()) return;
  const height = element.offsetHeight, style = getComputedStyle(element);
  const open = { height: `${height}px`, minHeight: "0px", paddingTop: style.paddingTop, paddingBottom: style.paddingBottom, opacity: 1 };
  element.style.overflow = "hidden";
  animate(element, [{ height: "0px", minHeight: "0px", paddingTop: "0px", paddingBottom: "0px", opacity: 0 }, open], { duration: 380 }).then(() => { element.style.overflow = ""; });
}
function foldAway(element) {
  element.setAttribute("data-leaving", "");
  element.removeAttribute("data-key");
  element.inert = true;
  element.style.overflow = "hidden";
  const style = getComputedStyle(element);
  const open = { height: `${element.offsetHeight}px`, minHeight: "0px", paddingTop: style.paddingTop, paddingBottom: style.paddingBottom, opacity: 1 };
  animate(element, [open, { height: "0px", minHeight: "0px", paddingTop: "0px", paddingBottom: "0px", opacity: 0 }], { duration: 260 }).then(() => element.remove());
}

// Dígitos que ruedan al cambiar. Al terminar queda el texto normal, para que VoiceOver lo lea entero.
export function roll(element, text, direction = 0) {
  const previous = element.rollValue ?? element.textContent;
  if (previous === text) return;
  element.rollValue = text;
  if (!canMove()) { element.textContent = text; return; }
  const number = (value) => Number(value.replace(/\./g, "").replace(",", "."));
  const way = direction || (number(text) < number(previous) ? -1 : 1);
  const offset = previous.length - text.length;
  element.replaceChildren(...[...text].map((character, index) => {
    const slot = document.createElement("span"), now = document.createElement("span");
    slot.className = "ui-roll"; now.textContent = character; slot.append(now);
    const before = previous[index + offset];
    if (before === undefined || before === character) return slot;
    const old = document.createElement("i");
    old.textContent = before; old.setAttribute("aria-hidden", "true"); slot.append(old);
    animate(now, [{ transform: `translateY(${way * 80}%)`, opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 340 });
    animate(old, [{ transform: "none", opacity: 1 }, { transform: `translateY(${-way * 80}%)`, opacity: 0 }], { duration: 200, easing: "ease-out" }).then(() => old.remove());
    return slot;
  }));
  window.setTimeout(() => { if (element.rollValue === text) element.textContent = text; }, 380);
}

/* ---------- Cambios de pantalla ---------- */

const TABS = ["home", "history", "progress", "settings"];
export function transitionKind(from, to) {
  if (!from || from === to) return "";
  if (TABS.includes(from) && TABS.includes(to)) return TABS.indexOf(to) > TABS.indexOf(from) ? "tab-next" : "tab-previous";
  if (from === "home" && to === "exercise") return "expand";
  if (from === "exercise" && to === "home") return "collapse";
  if (to === "complete") return "finish";
  if (to === "history-detail" || to === "builder" || (from === "builder" && to === "exercise")) return "push";
  if (from === "history-detail" || from === "builder") return "pop";
  return "fade";
}

// Safari 18 o posterior anima el cambio (View Transitions); en los demás, la pantalla cambia al instante.
export function transition(kind, update) {
  const page = globalThis.document;
  if (!kind || typeof page?.startViewTransition !== "function" || page.visibilityState !== "visible") { update(); return; }
  const root = page.documentElement;
  root.dataset.nav = canMove() ? kind : "fade";
  // Si el navegador tarda en capturar la pantalla, se cambia sin animación: lo que se ve no debe quedar atrás.
  let updated = false;
  const change = page.startViewTransition(() => { updated = true; update(); });
  window.setTimeout(() => { if (!updated) change.skipTransition(); }, 300);
  const done = () => { if (root.dataset.nav === kind || root.dataset.nav === "fade") delete root.dataset.nav; };
  change.ready.catch(() => {});
  change.finished.then(done, done);
  // Un fallo al dibujar debe llegar al aviso general, no perderse en la promesa (DATA-02).
  change.updateCallbackDone.catch((error) => window.setTimeout(() => { throw error; }));
}

/* ---------- Momentos concretos ---------- */

// Marcar una serie: un barrido del color de acento recorre la fila desde el marcador.
export function sweep(row) {
  const layer = row?.querySelector?.(".ex-sweep");
  const at = "at calc(100% - 30px) 50%";
  animate(layer, [{ clipPath: `circle(0px ${at})`, opacity: 1 }, { clipPath: `circle(120% ${at})`, opacity: 1, offset: 0.55 }, { clipPath: `circle(120% ${at})`, opacity: 0 }], { duration: 640, easing: "ease-out" });
}

// Cambiar de ejercicio: el contenido nuevo entra desde el lado del cambio.
export function slideIn(container, direction) {
  [...(container?.children || [])].forEach((element, index) => animate(element, [{ opacity: 0, transform: `translateX(${direction * 56}px)` }, { opacity: 1, transform: "none" }], { duration: 460, delay: index * 30 }));
}

export function fadeIn(elements) {
  [...(elements || [])].slice(0, 4).forEach((element, index) => animate(element, [{ opacity: 0, transform: "translateY(10px)" }, { opacity: 1, transform: "none" }], { duration: 320, delay: index * 40 }));
}

// Reordenar: cada fila se desplaza desde donde estaba.
export function reorder(container, selector, change) {
  const rows = () => [...(container.querySelectorAll?.(selector) || [])];
  const before = new Map(rows().map((row) => [row.dataset.key, row.getBoundingClientRect().top]));
  change();
  rows().forEach((row) => {
    const top = before.get(row.dataset.key), now = row.getBoundingClientRect().top;
    if (top !== undefined && top !== now) animate(row, [{ transform: `translateY(${top - now}px)` }, { transform: "none" }]);
  });
}

// Plegar y desplegar una sección (<details>): el navegador la abre de golpe, así que se anima su contenido.
export function bindFolds(root) {
  root.addEventListener("click", (event) => {
    const summary = event.target.closest?.("summary"), details = summary?.parentElement, content = details?.querySelector(":scope > .ui-fold");
    if (!content || !canMove() || event.defaultPrevented) return;
    event.preventDefault();
    if (details.open && !details.hasAttribute("data-closing")) {
      details.setAttribute("data-closing", "");
      animateHeight(content, content.offsetHeight, 0).then(() => {
        if (!details.hasAttribute("data-closing")) return;
        details.removeAttribute("data-closing");
        details.open = false;
      });
    } else {
      details.removeAttribute("data-closing");
      details.open = true;
      animateHeight(content, 0, content.offsetHeight);
    }
  });
}
function animateHeight(element, from, to) {
  element.style.overflow = "hidden";
  return animate(element, [{ height: `${from}px`, opacity: from ? 1 : 0 }, { height: `${to}px`, opacity: to ? 1 : 0 }], { duration: to ? 380 : 260 }).then(() => { element.style.overflow = ""; });
}

// Resumen final: la marca se dibuja, el volumen cuenta hasta el total y las filas entran en orden.
export function playSummary(root) {
  if (!canMove() || !root.querySelector?.(".complete-mark")) return;
  const find = (selector) => root.querySelector(selector), up = (distance) => [{ opacity: 0, transform: `translateY(${distance}px)` }, { opacity: 1, transform: "none" }];
  animate(find(".complete-mark .ui-check-fill"), [{ transform: "scale(0)" }, { transform: "none" }], { duration: 620, delay: 120, easing: SPRING });
  animate(find(".complete-mark .ui-check-mark"), [{ strokeDashoffset: 1.02 }, { strokeDashoffset: 0 }], { duration: 360, delay: 380, easing: "ease-out" });
  animate(find(".ui-title-center"), up(14), { duration: 460, delay: 260 });
  animate(find(".complete-hero"), up(18), { duration: 500, delay: 380 });
  root.querySelectorAll(".complete-compare i").forEach((bar, index) => {
    const share = getComputedStyle(bar).getPropertyValue("--share");
    bar.animate([{ transform: "scaleX(0)" }, { transform: `scaleX(${share})` }], { pseudoElement: "::after", duration: 900, delay: 560 + index * 90, easing: SOFT, fill: "backwards" });
  });
  root.querySelectorAll("[data-sequence]").forEach((element, index) => animate(element, up(12), { duration: 420, delay: 640 + index * 60 }));
  const counter = find("[data-count]");
  if (!counter) return;
  const total = Number(counter.dataset.count), text = counter.textContent, start = performance.now() + 520;
  const step = (now) => {
    const progress = Math.min(1, Math.max(0, (now - start) / 1000));
    if (!counter.isConnected || progress >= 1) { counter.textContent = text; return; }
    counter.textContent = Math.round(total * (1 - (1 - progress) ** 4)).toLocaleString("es-CO");
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
