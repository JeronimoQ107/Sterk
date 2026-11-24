// UI-03: movimiento de la interfaz, sin librerías. Todo es opcional: sin soporte del navegador o con «Reducir
// movimiento», las mismas funciones cambian la pantalla al instante.
// Solo se animan transform y opacity: el iPhone los mueve sin volver a dibujar. Nada de alturas, recortes ni desenfoques.
const reduced = () => Boolean(globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
export const canMove = () => !reduced() && typeof Element !== "undefined" && typeof Element.prototype.animate === "function";

// Las mismas curvas que --spring y --soft en styles.css.
export const SPRING = "cubic-bezier(.3, 1.4, .5, 1)";
export const SOFT = "cubic-bezier(.22, 1, .36, 1)";

export function animate(element, keyframes, { duration = 360, delay = 0, easing = SOFT, pseudoElement } = {}) {
  if (!element || !canMove()) return Promise.resolve();
  return element.animate(keyframes, { duration, delay, easing, fill: "backwards", pseudoElement }).finished.catch(() => {});
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
  entered = []; left = [];
  morphChildren(root, template.content);
  moveRows();
}

let entered = [], left = [];
const keyOf = (node) => node.nodeType === 1 ? node.getAttribute("data-key") || node.id || "" : "";
function alike(current, next) {
  if (current.nodeType !== next.nodeType || current.nodeName !== next.nodeName || keyOf(current) !== keyOf(next)) return false;
  return current.nodeType !== 1 || Boolean(keyOf(next)) || (current.classList[0] || "") === (next.classList[0] || "");
}
function discard(node) {
  if (node.nodeType === 1 && node.hasAttribute("data-enter")) left.push({ height: node.offsetHeight, next: node.nextElementSibling });
  node.remove();
}
function morphChildren(current, next) {
  // Primero sale lo que ya no está: así lo que sigue no hay que moverlo de sitio.
  const kept = new Set([...next.children].map(keyOf));
  [...current.children].forEach((child) => { if (keyOf(child) && !kept.has(keyOf(child))) discard(child); });
  const keyed = new Map([...current.children].filter(keyOf).map((child) => [keyOf(child), child]));
  let cursor = current.firstChild;
  for (const child of [...next.childNodes]) {
    const key = keyOf(child);
    let match = key ? keyed.get(key) : cursor;
    if (!key) while (match && !alike(match, child)) match = match.nextSibling;
    if (match && alike(match, child)) {
      keyed.delete(key);
      if (match === cursor) cursor = cursor.nextSibling;
      else current.insertBefore(match, cursor);
      morphNode(match, child);
    } else {
      current.insertBefore(child, cursor);
      if (child.nodeType === 1 && child.hasAttribute("data-enter")) entered.push(child);
    }
  }
  while (cursor) {
    const gone = cursor;
    cursor = cursor.nextSibling;
    discard(gone);
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

// Lo que queda debajo de un elemento dentro de su pantalla, sin las barras fijas.
function below(element) {
  const list = [];
  for (let node = element; node && !node.classList.contains("screen"); node = node.parentElement) {
    for (let sibling = node.nextElementSibling; sibling; sibling = sibling.nextElementSibling) if (!sibling.matches(".ui-dock, .bottom-nav")) list.push(sibling);
  }
  return list;
}
const fromOffset = (offset) => [{ transform: `translateY(${offset}px)` }, { transform: "none" }];

// Una fila añadida o quitada ocupa su sitio al momento; lo de abajo se desliza desde donde estaba.
function moveRows() {
  if (!canMove()) return;
  if (entered.length === 1 && !left.length) {
    const [row] = entered, offset = -row.offsetHeight;
    animate(row, [{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: "linear" });
    below(row).forEach((element) => animate(element, fromOffset(offset)));
  } else if (left.length === 1 && !entered.length && left[0].next) {
    const { height, next } = left[0];
    [next, ...below(next)].forEach((element) => animate(element, fromOffset(height), { duration: 280 }));
  } else entered.forEach((row) => animate(row, [{ opacity: 0 }, { opacity: 1 }], { duration: 240, easing: "linear" }));
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
let navigation = 0;
export function transition(kind, update) {
  const page = globalThis.document;
  if (!kind || typeof page?.startViewTransition !== "function" || page.visibilityState !== "visible") { update(); return; }
  const root = page.documentElement;
  const current = ++navigation;
  root.dataset.nav = canMove() ? kind : "fade";
  // La pantalla del ejercicio crece desde la tarjeta de la sesión (styles.css).
  const card = page.querySelector(".session-card")?.getBoundingClientRect();
  if (card) root.style.setProperty("--nav-y", `${Math.round(card.top + card.height / 2)}px`);
  // Si el navegador tarda en capturar la pantalla, se cambia sin animación: lo que se ve no debe quedar atrás.
  let updated = false;
  const change = page.startViewTransition(() => { updated = true; update(); });
  window.setTimeout(() => { if (!updated) change.skipTransition(); }, 300);
  // Mientras dura el cambio, las animaciones de la pantalla nueva esperan (styles.css); el plazo evita que queden en espera.
  const done = () => { if (current === navigation) delete root.dataset.nav; };
  change.ready.catch(() => {});
  change.finished.then(done, done);
  window.setTimeout(done, 1500);
  // Un fallo al dibujar debe llegar al aviso general, no perderse en la promesa (DATA-02).
  change.updateCallbackDone.catch((error) => window.setTimeout(() => { throw error; }));
}

/* ---------- Momentos concretos ---------- */

// Marcar una serie: un barrido del color de acento recorre toda la fila, desde el marcador hasta el número.
export function sweep(row) {
  animate(row?.querySelector?.(".ex-sweep"), [{ transform: "scaleX(0)", opacity: 1 }, { transform: "none", opacity: 1, offset: 0.5 }, { transform: "none", opacity: 0 }], { duration: 600, easing: "ease-out", pseudoElement: "::before" });
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

// Plegar y desplegar una sección (<details>): el navegador la abre de golpe. El contenido se descubre deslizando un
// recorte (.ui-fold) y su interior (.ui-fold-in) en sentidos opuestos, y lo de abajo se desliza a la vez.
const folding = new WeakMap();
export function bindFolds(root) {
  root.addEventListener("click", (event) => {
    const details = event.target.closest?.("summary")?.parentElement, content = details?.querySelector(":scope > .ui-fold");
    if (!content || !canMove() || event.defaultPrevented) return;
    event.preventDefault();
    const opening = !details.open || details.hasAttribute("data-closing");
    folding.get(details)?.forEach((animation) => animation.cancel());
    details.toggleAttribute("data-closing", !opening);
    if (opening) details.open = true;
    const height = content.offsetHeight;
    const moves = [[content, -height], [content.firstElementChild, height], ...below(details).map((element) => [element, -height])];
    const animations = moves.map(([element, offset]) => element.animate(opening ? fromOffset(offset) : fromOffset(offset).reverse(), { duration: opening ? 360 : 280, easing: opening ? SOFT : "cubic-bezier(.4, 0, .2, 1)", fill: "both" }));
    folding.set(details, animations);
    Promise.all(animations.map((animation) => animation.finished)).then(() => {
      if (!opening) { details.removeAttribute("data-closing"); details.open = false; }
      animations.forEach((animation) => animation.cancel());
    }).catch(() => {});
  });
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
  const total = Number(counter.dataset.count), text = counter.textContent, start = performance.now() + 520, format = new Intl.NumberFormat("es-CO");
  const step = (now) => {
    const progress = Math.min(1, Math.max(0, (now - start) / 1000));
    if (!counter.isConnected || progress >= 1) { counter.textContent = text; return; }
    counter.textContent = format.format(Math.round(total * (1 - (1 - progress) ** 4)));
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
