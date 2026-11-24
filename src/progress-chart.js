// UI-03: gráfica de Progreso. dashboard.js la dibuja completa; aquí se recorre con el dedo y se transforma al cambiar
// de métrica, periodo o ejercicio. Los valores de cada punto viajan en data-points.
import { canMove } from "./motion.js";

export const PLOT = { width: 326, height: 172 };
const pointsOf = (svg) => { try { return JSON.parse(svg?.dataset.points || "[]"); } catch { return []; } };
export const linePath = (points) => points.map(({ x, y }) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
// Todos los puntos en un solo trazo: moverlos es cambiar un atributo.
export const dotsPath = (points) => points.map(({ x, y }) => `M${(x - 4).toFixed(1)} ${y.toFixed(1)}a4 4 0 1 0 8 0a4 4 0 1 0 -8 0`).join("");
const percent = (value, total) => `${(value / total * 100).toFixed(2)}%`;
export const plotLeft = (point) => percent(point.x, PLOT.width);
export const plotTop = (point) => percent(point.y, PLOT.height);

// Estado de la gráfica antes de redibujar, para transformarla después.
export function chartState(root) {
  const svg = root.querySelector?.("svg.progress-chart");
  return svg ? { svg, points: pointsOf(svg) } : null;
}

export function morphChart(root, before) {
  const svg = root.querySelector?.("svg.progress-chart"), points = pointsOf(svg);
  if (!svg || !before?.points.length || svg !== before.svg || !points.length || !canMove()) return;
  // La línea anterior se remuestrea a la cantidad de puntos nueva.
  const at = (index) => {
    const place = points.length < 2 ? 0 : index / (points.length - 1) * (before.points.length - 1);
    const low = Math.floor(place), high = Math.min(before.points.length - 1, low + 1), rest = place - low;
    const mix = (axis) => before.points[low][axis] * (1 - rest) + before.points[high][axis] * rest;
    return { x: mix("x"), y: mix("y") };
  };
  const from = points.map((_, index) => at(index)), started = performance.now();
  const plot = svg.closest(".progress-plot"), path = svg.querySelector(".chart-line"), dots = svg.querySelector(".chart-dots"), active = plot.querySelector(".chart-active"), data = svg.dataset.points;
  const step = (now) => {
    if (!svg.isConnected || svg.dataset.points !== data) return;
    const time = Math.min(1, Math.max(0, (now - started) / 520)), ease = 1 - (1 - time) ** 4;
    const current = points.map((point, index) => ({ x: from[index].x + (point.x - from[index].x) * ease, y: from[index].y + (point.y - from[index].y) * ease }));
    path.setAttribute("points", linePath(current));
    dots.setAttribute("d", dotsPath(current));
    if (!plot.classList.contains("touching")) { active.style.left = plotLeft(current.at(-1)); active.style.top = plotTop(current.at(-1)); }
    if (time < 1) requestAnimationFrame(step);
  };
  step(started);
}

export function bindChart(root) {
  const show = (svg, index, touching) => {
    const point = pointsOf(svg)[index], box = svg.closest("[data-chart]"), plot = svg.closest(".progress-plot");
    if (!point || !box || !plot) return;
    svg.dataset.index = String(index);
    plot.classList.toggle("touching", touching);
    const active = plot.querySelector(".chart-active");
    plot.querySelector(".chart-cross").style.left = plotLeft(point);
    active.style.left = plotLeft(point); active.style.top = plotTop(point);
    const value = box.querySelector("[data-chart-value]");
    value.textContent = point.value; value.rollValue = point.value;
    box.querySelector("[data-chart-detail]").textContent = point.detail;
    box.querySelector("[data-chart-change]").textContent = point.change;
  };
  const nearest = (svg, clientX) => {
    const box = svg.getBoundingClientRect(), x = (clientX - box.left) / box.width * PLOT.width;
    return pointsOf(svg).reduce((best, point, index, all) => (Math.abs(point.x - x) < Math.abs(all[best].x - x) ? index : best), 0);
  };
  let touched = null;
  root.addEventListener("pointerdown", (event) => {
    const svg = event.target.closest?.("svg.progress-chart");
    if (!svg || !event.isPrimary || !pointsOf(svg).length) return;
    touched = svg;
    svg.setPointerCapture?.(event.pointerId);
    show(svg, nearest(svg, event.clientX), true);
  });
  root.addEventListener("pointermove", (event) => {
    if (!touched?.isConnected) return;
    const index = nearest(touched, event.clientX);
    if (String(index) !== touched.dataset.index) show(touched, index, true);
  });
  const release = () => {
    const svg = touched;
    touched = null;
    if (svg?.isConnected) show(svg, pointsOf(svg).length - 1, false);
  };
  root.addEventListener("pointerup", release);
  root.addEventListener("pointercancel", release);
  root.addEventListener("keydown", (event) => {
    const svg = event.target.closest?.("svg.progress-chart");
    if (!svg || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    const last = pointsOf(svg).length - 1, index = Number(svg.dataset.index ?? last) + (event.key === "ArrowLeft" ? -1 : 1);
    show(svg, Math.max(0, Math.min(last, index)), true);
  });
  root.addEventListener("focusout", (event) => { const svg = event.target.closest?.("svg.progress-chart"); if (svg?.isConnected) show(svg, pointsOf(svg).length - 1, false); });
}
