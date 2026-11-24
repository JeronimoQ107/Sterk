// UI-03: gráfica de Progreso. dashboard.js la dibuja completa; aquí se recorre con el dedo y se transforma al cambiar
// de métrica, periodo o ejercicio. Los valores de cada punto viajan en data-points.
import { canMove } from "./motion.js";

const WIDTH = 326;
const pointsOf = (svg) => { try { return JSON.parse(svg?.dataset.points || "[]"); } catch { return []; } };
const line = (points) => points.map(({ x, y }) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

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
  const path = svg.querySelector(".chart-line"), dots = [...svg.querySelectorAll(".chart-dot")], active = svg.querySelector(".chart-active");
  const step = (now) => {
    if (!svg.isConnected || pointsOf(svg).length !== points.length) return;
    const time = Math.min(1, Math.max(0, (now - started) / 520)), ease = 1 - (1 - time) ** 4;
    const current = points.map((point, index) => ({ x: from[index].x + (point.x - from[index].x) * ease, y: from[index].y + (point.y - from[index].y) * ease }));
    path.setAttribute("points", line(current));
    dots.forEach((dot, index) => { if (!current[index]) return; dot.setAttribute("cx", current[index].x); dot.setAttribute("cy", current[index].y); });
    if (!svg.classList.contains("touching")) { active.setAttribute("cx", current.at(-1).x); active.setAttribute("cy", current.at(-1).y); }
    if (time < 1) requestAnimationFrame(step);
  };
  step(started);
}

export function bindChart(root) {
  const show = (svg, index, touching) => {
    const points = pointsOf(svg), point = points[index], box = svg.closest("[data-chart]");
    if (!point || !box) return;
    svg.dataset.index = String(index);
    svg.classList.toggle("touching", touching);
    const cross = svg.querySelector(".chart-cross"), active = svg.querySelector(".chart-active");
    cross.setAttribute("x1", point.x); cross.setAttribute("x2", point.x);
    active.setAttribute("cx", point.x); active.setAttribute("cy", point.y);
    const value = box.querySelector("[data-chart-value]");
    value.textContent = point.value; value.rollValue = point.value;
    box.querySelector("[data-chart-detail]").textContent = point.detail;
    box.querySelector("[data-chart-change]").textContent = point.change;
  };
  const nearest = (svg, clientX) => {
    const box = svg.getBoundingClientRect(), x = (clientX - box.left) / box.width * WIDTH;
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
