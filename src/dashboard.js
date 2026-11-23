import { icon } from './icons.js';
import { MUSCLE_GROUPS } from './data.js';
import { APP_VERSION } from './version.js';
import { inPeriod, overview, exerciseOptions, availableSides, exerciseSeries, personalRecords, muscleGroupSets } from './progress.js';
import { escapeHtml as escape, formatTotal as number, formatDayMonth as date } from './format.js';
// UI-01: el rendimiento estimado es una estimación; se muestra en libras enteras. Los cálculos conservan el valor exacto.
const estimate = (value) => number(Math.round(value));
// Porcentajes con un decimal; un cambio que redondea a 0 se muestra como "0%", sin signo.
const percentChange = (value) => { const rounded = Math.round(value * 10) / 10 || 0; return `${rounded > 0 ? '+' : ''}${number(rounded)}%`; };
const sideNames = { both: 'Sin lado asignado', left: 'Izquierdo', right: 'Derecho' };
const metrics = (stats) => `<div class="ui-group ui-metrics"><div><strong>${number(stats.sessions)}</strong><span>Entrenamientos</span></div><div><strong>${number(stats.sets)}</strong><span>Series hechas</span></div><div><strong>${number(stats.days)}</strong><span>Días activos</span></div></div>`;
// UI-02: textos con plural correcto y una fila de lista agrupada con flecha.
export const plural = (count, one, many) => `${number(count)} ${count === 1 ? one : many}`;
const chevron = () => `<span class="ui-chevron">${icon('right')}</span>`;
export function sessionSummary(session) {
  return [plural(session.exerciseCount, 'ejercicio', 'ejercicios'), plural(session.setCount, 'serie', 'series'), `${number(session.volume)} lb`].join(' · ');
}

function homeInsight(sessions) {
  const last = sessions[0];
  if (!last) return null;
  const previous = sessions.slice(1);
  for (const entry of last.entries) {
    for (const set of entry.sets) {
      const candidates = set.sides ? [['left', set.sides.left], ['right', set.sides.right]] : [['both', set]];
      for (const [side, part] of candidates) {
        if (!part?.completed || part.reps <= 0) continue;
        const prior = previous.flatMap((session) => session.entries.filter((item) => item.exerciseId === entry.exerciseId).flatMap((item) => item.sets.flatMap((old) => {
          const oldPart = side === 'both' ? (!old.sides ? old : null) : old.sides?.[side];
          return oldPart?.completed && oldPart.weight === part.weight ? [oldPart.reps] : [];
        })));
        const best = Math.max(0, ...prior);
        if (prior.length && part.reps > best) return { title: 'Más repeticiones con el mismo peso', detail: `${entry.exercise} · ${number(part.weight)} lb`, value: `+${part.reps - best} rep${part.reps - best === 1 ? '' : 's'}` };
      }
    }
  }
  return null;
}

// Inicio: la mejora más reciente (si la hay) y el último entrenamiento. El botón de empezar lo pone app.js.
export function homeDashboard(sessions) {
  const last = sessions[0];
  if (!last) return `<p class="ui-empty">Todavía no hay entrenamientos guardados. Cuando termines el primero, aparecerá aquí.</p>`;
  const insight = homeInsight(sessions);
  const insightGroup = insight ? `<h2 class="ui-group-header">Desde la vez anterior</h2><div class="ui-group"><button class="ui-row" data-view="progress"><span class="ui-row-main"><strong>${escape(insight.title)}</strong><small>${escape(insight.detail)}</small></span><span class="ui-value ui-accent">${escape(insight.value)}</span>${chevron()}</button></div>` : '';
  const exercises = last.entries.slice(0, 3).map((entry) => entry.exercise).join(' · ') + (last.entries.length > 3 ? ` · +${last.entries.length - 3}` : '');
  return `${insightGroup}<h2 class="ui-group-header">Último entrenamiento</h2><div class="ui-group"><button class="ui-row" data-history-session="${escape(last.id)}"><span class="ui-row-main"><span class="ui-row-top"><strong>${escape(last.label)}</strong><span class="ui-muted">${date(last.startedAt)}</span></span><small>${escape(exercises)}</small><small>${sessionSummary(last)}</small></span>${chevron()}</button><button class="ui-row ui-row-link" data-view="history">Ver todo el historial</button></div>`;
}

const metricDefinitions = {
  performance: { label: 'Rendimiento', shortLabel: 'Rendimiento estimado', unit: 'lb', field: 'estimatedOneRepMax', format: estimate },
  volume: { label: 'Volumen', shortLabel: 'Volumen total', unit: 'lb', field: 'volume', format: number },
  reps: { label: 'Repeticiones', shortLabel: 'Repeticiones totales', unit: 'reps', field: 'totalReps', format: number },
};

// UI-01: el eje vertical cubre el rango de los datos, no desde 0, con tres marcas enteras y redondas (1, 2 o 5 × 10ⁿ de separación).
// Con valores entre 258 y 263 lb el eje va de 255 a 265 y la línea deja de verse plana.
const niceSteps = [1, 2, 5, 10];
const niceStep = (raw, above = false) => {
  const power = 10 ** Math.floor(Math.log10(raw));
  return niceSteps.map((factor) => factor * power).find((value) => (above ? value > raw : value >= raw));
};
export function chartScale(values) {
  // Si todos los valores son iguales, se abre un margen alrededor para que queden en el centro.
  const pad = Math.min(...values) === Math.max(...values) ? Math.max(1, Math.abs(values[0]) * 0.025) : 0;
  const low = Math.min(...values) - pad, high = Math.max(...values) + pad;
  let step = niceStep(Math.max(1, (high - low) / 2));
  for (;;) {
    const min = Math.max(0, Math.floor(low / step) * step);
    if (min + 2 * step >= high) return { min, max: min + 2 * step };
    step = niceStep(step, true);
  }
}

function chart(points, metricId) {
  const metric = metricDefinitions[metricId] || metricDefinitions.performance;
  const w = 320, h = 160, x0 = 42, x1 = 302, y0 = 16, y1 = 130;
  const { min, max } = chartScale(points.map((point) => point[metric.field]));
  const first = +new Date(points[0].date), last = +new Date(points.at(-1).date);
  const x = (point, index) => last !== first ? x0 + ((+new Date(point.date) - first) / (last - first)) * (x1 - x0) : x0 + index * (x1 - x0) / Math.max(1, points.length - 1);
  const y = (point) => y1 - (point[metric.field] - min) / (max - min) * (y1 - y0);
  const line = points.map((point, index) => `${x(point, index)},${y(point)}`).join(' ');
  return `<svg class="progress-chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="${metric.shortLabel} por entrenamiento. Los valores están en la tabla inferior.">${[0, .5, 1].map((fraction) => `<line x1="${x0}" x2="${x1}" y1="${y1 - fraction * (y1 - y0)}" y2="${y1 - fraction * (y1 - y0)}" class="chart-grid"/><text x="${x0 - 7}" y="${y1 - fraction * (y1 - y0) + 4}" text-anchor="end">${number(min + (max - min) * fraction)}</text>`).join('')}<polyline points="${line}" fill="none" class="chart-line"/>${points.map((point, index) => `<circle cx="${x(point, index)}" cy="${y(point)}" r="3.5" class="chart-dot"><title>${date(point.date)}: ${metric.format(point[metric.field])} ${metric.unit}</title></circle>`).join('')}<text x="${x0}" y="154">${date(points[0].date)}</text><text x="${x1}" y="154" text-anchor="end">${date(points.at(-1).date)}</text></svg>`;
}

export function progressDashboard(sessions, state) {
  const filtered = inPeriod(sessions, state.progressPeriod || '90');
  const options = exerciseOptions(sessions);
  if (!options.some((option) => option.id === state.progressExercise)) state.progressExercise = options[0]?.id || '';
  const sides = availableSides(sessions, state.progressExercise);
  if (!sides.includes(state.progressSide)) state.progressSide = sides[0] || 'both';
  const points = exerciseSeries(filtered, state.progressExercise, state.progressSide);
  if (!metricDefinitions[state.progressMetric]) state.progressMetric = 'performance';
  const latest = points.at(-1), prior = points.at(-2);
  const currentMetric = metricDefinitions[state.progressMetric];
  const change = latest && prior && prior[currentMetric.field] ? (latest[currentMetric.field] - prior[currentMetric.field]) / prior[currentMetric.field] * 100 : null;
  const records = personalRecords(points);
  const groups = muscleGroupSets(filtered);
  const maxGroupSets = Math.max(1, ...groups.map((group) => group.sets));
  const groupSummary = groups.length ? `<h2 class="ui-group-header"><span>Series por grupo muscular</span><span>${number(groups.reduce((sum, group) => sum + group.sets, 0))} en total</span></h2><section class="ui-group ui-pad muscle-summary"><div class="muscle-bars">${groups.map((group) => `<div><span>${escape(MUSCLE_GROUPS[group.id] || group.id)}</span><i><b style="width:${group.sets / maxGroupSets * 100}%"></b></i><strong>${number(group.sets)}</strong></div>`).join('')}</div></section>` : '';
  const recordCards = records ? `<section class="personal-records"><h3>Récords del periodo</h3><div><article><small>Rendimiento</small><strong>${estimate(records.performance.estimatedOneRepMax)} lb</strong><span>${number(records.performance.weight)} × ${records.performance.reps}</span></article><article><small>Mayor carga</small><strong>${number(records.weight.maxWeight)} lb</strong><span>${records.weight.maxWeightReps} reps</span></article><article><small>Más repeticiones</small><strong>${records.reps.maxReps}</strong><span>con ${number(records.reps.maxRepsWeight)} lb</span></article><article><small>Mayor volumen</small><strong>${number(records.volume.volume)} lb</strong><span>${date(records.volume.date)}</span></article></div></section>` : '';
  return `<header class="ui-title ui-title-row"><h1>Progreso</h1><button class="info-button" data-action="progress-info" aria-label="Cómo se calcula el progreso">${icon('info')}</button></header><div class="ui-segmented" aria-label="Periodo de análisis">${[['30', '30 días'], ['90', '90 días'], ['all', 'Todo']].map(([id, label]) => `<button data-period="${id}" aria-pressed="${(state.progressPeriod || '90') === id}">${label}</button>`).join('')}</div>${metrics(overview(filtered))}${groupSummary}<h2 class="ui-group-header">Por ejercicio</h2><section class="ui-group ui-pad progress-detail">${options.length ? `<label class="field-label">Ejercicio<select id="progress-exercise">${options.map((option) => `<option value="${escape(option.id)}" ${state.progressExercise === option.id ? 'selected' : ''}>${escape(option.name)}</option>`).join('')}</select></label>${sides.length > 1 || sides[0] !== 'both' ? `<label class="field-label">Registro<select id="progress-side">${sides.map((side) => `<option value="${side}" ${state.progressSide === side ? 'selected' : ''}>${sideNames[side]}</option>`).join('')}</select></label>` : ''}${latest ? `<div class="load-summary"><div><small>Rendimiento estimado</small><strong>${estimate(latest.estimatedOneRepMax)} <span>lb</span></strong><p>${number(latest.weight)} lb × ${latest.reps} · ${date(latest.date)}</p></div><div class="load-change"><small>${currentMetric.label} frente al anterior</small><strong>${change === null ? 'Sin comparación' : percentChange(change)}</strong></div></div><div class="session-work"><div><strong>${number(latest.volume)}</strong><span>Volumen · lb</span></div><div><strong>${number(latest.totalReps)}</strong><span>Repeticiones</span></div><div><strong>${number(latest.setCount)}</strong><span>Series</span></div></div><div class="ui-segmented metric-filter" aria-label="Métrica de la gráfica">${Object.entries(metricDefinitions).map(([id, metric]) => `<button data-progress-metric="${id}" aria-pressed="${state.progressMetric === id}">${metric.label}</button>`).join('')}</div>${points.length > 1 ? chart(points, state.progressMetric) : `<p class="quiet-empty">La gráfica aparecerá con el próximo registro.</p>`}${recordCards}<details class="progress-records"><summary>Ver registros (${points.length})</summary><div class="records-scroll"><table><caption class="visually-hidden">Rendimiento, volumen y repeticiones por sesión</caption><thead><tr><th>Fecha</th><th>Mejor serie</th><th>Rendimiento</th><th>Volumen</th><th>Reps</th></tr></thead><tbody>${[...points].reverse().map((point) => `<tr><td>${date(point.date)}</td><td>${number(point.weight)} × ${point.reps}</td><td>${estimate(point.estimatedOneRepMax)} lb</td><td>${number(point.volume)} lb</td><td>${number(point.totalReps)}</td></tr>`).join('')}</tbody></table></div></details>` : `<div class="quiet-empty"><strong>Sin registros en este periodo</strong><p>Prueba otro periodo o completa una sesión con este ejercicio.</p></div>`}` : `<div class="quiet-empty"><strong>Tu progreso empieza con una sesión</strong><p>Completa un entrenamiento para ver tus resultados.</p><button class="text-link" data-action="new-session">Crear entrenamiento</button></div>`}</section>`;
}

// DATA-03: snapshots es null mientras se cargan, 'unavailable' si IndexedDB falla, o la lista de copias.
const snapshotTitle = (snapshot) => (snapshot.reason === 'version' ? `Al abrir la versión ${escape(snapshot.appVersion)}` : 'Antes de restaurar una copia');
const snapshotDate = (value) => new Date(value).toLocaleString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const snapshotDetail = ({ createdAt, summary }) => `${snapshotDate(createdAt)} · ${number(summary.sessions)} ${summary.sessions === 1 ? 'entrenamiento' : 'entrenamientos'}${summary.activeSession ? ' · sesión en curso' : ''}`;

function snapshotSection(snapshots) {
  if (snapshots === null) return '';
  const rows = Array.isArray(snapshots) && snapshots.length
    ? snapshots.map((snapshot) => `<div class="ui-row"><span class="ui-row-main"><strong>${snapshotTitle(snapshot)}</strong><small>${snapshotDetail(snapshot)}</small></span><button class="ui-pill" data-restore-snapshot="${escape(snapshot.id)}">Restaurar</button></div>`).join('')
    : `<div class="ui-row ui-muted">${snapshots === 'unavailable' ? 'Las copias automáticas no están disponibles en este navegador.' : 'Todavía no hay copias. Se guarda una cada vez que Sterk se actualiza.'}</div>`;
  return `<h2 class="ui-group-header">Copias automáticas</h2><div class="ui-group">${rows}</div><p class="ui-group-footer">Al actualizarse, Sterk guarda tus datos en este dispositivo y conserva las tres últimas copias. No sustituyen exportar: se pierden si borras la app.</p>`;
}

export function settingsDashboard(sessions, customCount, snapshots = null) {
  return `<header class="ui-title"><h1>Ajustes</h1></header>
    <h2 class="ui-group-header">Tus datos</h2>
    <div class="ui-group"><div class="ui-row"><span>Entrenamientos</span><span class="ui-value">${number(sessions.length)}</span></div><div class="ui-row"><span>Ejercicios propios</span><span class="ui-value">${number(customCount)}</span></div></div>
    <p class="ui-group-footer">Se guardan solo en este dispositivo. Exporta una copia para conservarlos fuera de él.</p>
    <div class="ui-group"><button class="ui-row" data-action="export"><span class="ui-row-main"><strong>Exportar copia</strong><small>Guarda un archivo con todos tus datos</small></span>${chevron()}</button><button class="ui-row" data-action="import"><span class="ui-row-main"><strong>Restaurar copia</strong><small>Reemplaza los datos actuales por los del archivo</small></span>${chevron()}</button></div>
    ${snapshotSection(snapshots)}
    <h2 class="ui-group-header">Borrar datos</h2>
    <div class="ui-group"><button class="ui-row ui-row-danger" data-action="clear-data">Borrar todos los datos</button></div>
    <p class="ui-group-footer">Elimina historial, entrenamiento en curso, ejercicios propios y preferencias de este dispositivo. Las copias automáticas se conservan.</p>
    <p class="version">Sterk · Versión ${APP_VERSION}</p>`;
}
