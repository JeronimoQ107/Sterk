import { icon } from './icons.js';
import { MUSCLE_GROUPS } from './data.js';
import { countsPart } from './sets.js';
import { APP_VERSION } from './version.js';
import { PLOT, linePath, dotsPath, plotLeft, plotTop } from './progress-chart.js';
import { inPeriod, overview, exerciseOptions, availableSides, exerciseSeries, personalRecords, muscleGroupSets } from './progress.js';
import { escapeHtml as escape, formatTotal as number, formatDayMonth as date } from './format.js';
// UI-01: el rendimiento estimado es una estimación; se muestra en libras enteras. Los cálculos conservan el valor exacto.
const estimate = (value) => number(Math.round(value));
// Porcentajes con un decimal; un cambio que redondea a 0 se muestra como "0%", sin signo.
const percentChange = (value) => { const rounded = Math.round(value * 10) / 10 || 0; return `${rounded > 0 ? '+' : ''}${number(rounded)}%`; };
const sideNames = { both: 'Sin lado asignado', left: 'Izquierdo', right: 'Derecho' };
// UI-03: fila de cifras y control segmentado con indicador que se desliza; los comparte app.js.
export const metricsRow = (items) => `<div class="ui-group ui-metrics">${items.map(([value, label]) => `<div><strong class="num" data-roll>${value}</strong><span>${label}</span></div>`).join('')}</div>`;
export const segmented = (label, attribute, options, selected) => `<div class="ui-segmented" role="group" aria-label="${label}" style="--count:${options.length};--index:${Math.max(0, options.findIndex(([id]) => id === selected))}"><i class="ui-thumb" aria-hidden="true"></i>${options.map(([id, text]) => `<button ${attribute}="${id}" aria-pressed="${id === selected}">${text}</button>`).join('')}</div>`;
const metrics = (stats) => metricsRow([[number(stats.sessions), 'Entrenamientos'], [number(stats.sets), 'Series hechas'], [number(stats.days), 'Días activos']]);
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
        if (!countsPart(part)) continue;
        const prior = previous.flatMap((session) => session.entries.filter((item) => item.exerciseId === entry.exerciseId).flatMap((item) => item.sets.flatMap((old) => {
          const oldPart = side === 'both' ? (!old.sides ? old : null) : old.sides?.[side];
          return countsPart(oldPart) && oldPart.weight === part.weight ? [oldPart.reps] : [];
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
  const insightGroup = insight ? `<h2 class="ui-group-header">Desde la vez anterior</h2><div class="ui-group"><button class="ui-row" data-view="progress"><span class="ui-row-main"><strong>${escape(insight.title)}</strong><small>${escape(insight.detail)}</small></span><span class="ui-value ui-accent num">${escape(insight.value)}</span>${chevron()}</button></div>` : '';
  const exercises = last.entries.slice(0, 3).map((entry) => entry.exercise).join(' · ') + (last.entries.length > 3 ? ` · +${last.entries.length - 3}` : '');
  return `${insightGroup}<h2 class="ui-group-header">Último entrenamiento</h2><div class="ui-group"><button class="ui-row" data-history-session="${escape(last.id)}"><span class="ui-row-main"><span class="ui-row-top"><strong>${escape(last.label)}</strong><span class="ui-muted">${date(last.startedAt)}</span></span><small>${escape(exercises)}</small><small>${sessionSummary(last)}</small></span>${chevron()}</button><button class="ui-row ui-row-link" data-view="history">Ver todo el historial</button></div>`;
}

const metricDefinitions = {
  performance: { label: 'Rendimiento', shortLabel: 'Rendimiento estimado', unit: 'lb', field: 'estimatedOneRepMax', format: estimate },
  volume: { label: 'Volumen', shortLabel: 'Volumen total', unit: 'lb', field: 'volume', format: number },
  reps: { label: 'Repeticiones', shortLabel: 'Repeticiones totales', unit: 'reps', field: 'totalReps', format: number },
};

// UI-01: el eje vertical cubre el rango de los datos, no desde 0, con marcas enteras y redondas (1, 2 o 5 × 10ⁿ de separación).
// UI-03: admite hasta cuatro tramos (antes, dos) para que la línea ocupe más alto: entre 258 y 263 lb el eje va de 258 a 264.
const niceSteps = [1, 2, 5, 10];
const niceStep = (raw, above = false) => {
  const power = 10 ** Math.floor(Math.log10(raw));
  return niceSteps.map((factor) => factor * power).find((value) => (above ? value > raw : value >= raw));
};
export function chartScale(values) {
  // Si todos los valores son iguales, se abre un margen alrededor para que queden en el centro.
  const pad = Math.min(...values) === Math.max(...values) ? Math.max(1, Math.abs(values[0]) * 0.025) : 0;
  const low = Math.min(...values) - pad, high = Math.max(...values) + pad;
  let step = niceStep(Math.max(1, (high - low) / 4));
  for (;;) {
    const min = Math.max(0, Math.floor(low / step) * step), steps = Math.max(2, Math.ceil((high - min) / step));
    if (steps <= 4) return { min, max: min + steps * step, steps };
    step = niceStep(step, true);
  }
}

const pointDetail = (point, metricId) => `${metricId === 'performance' ? `${number(point.weight)} lb × ${point.reps}` : plural(point.setCount, 'serie', 'series')} · ${date(point.date)}`;
const pointChange = (points, index, field) => {
  const prior = points[index - 1]?.[field];
  return prior ? percentChange((points[index][field] - prior) / prior * 100) : 'Sin comparación';
};

function chart(points, metricId) {
  const metric = metricDefinitions[metricId];
  const x0 = 40, x1 = 316, y0 = 14, y1 = 132, box = `viewBox="0 0 ${PLOT.width} ${PLOT.height}"`;
  const { min, max, steps } = chartScale(points.map((point) => point[metric.field]));
  const first = +new Date(points[0].date), last = +new Date(points.at(-1).date);
  const x = (point, index) => last !== first ? x0 + ((+new Date(point.date) - first) / (last - first)) * (x1 - x0) : x0 + index * (x1 - x0) / Math.max(1, points.length - 1);
  const y = (point) => y1 - (point[metric.field] - min) / (max - min) * (y1 - y0);
  const round = (value) => Math.round(value * 10) / 10;
  const places = points.map((point, index) => ({ x: round(x(point, index)), y: round(y(point)) }));
  // Lo que se lee al recorrer la gráfica con el dedo (progress-chart.js).
  const data = places.map((place, index) => ({ ...place, value: metric.format(points[index][metric.field]), detail: pointDetail(points[index], metricId), change: pointChange(points, index, metric.field) }));
  const grid = Array.from({ length: steps + 1 }, (_, index) => {
    const level = y1 - index / steps * (y1 - y0);
    return `<line x1="${x0}" x2="${x1}" y1="${level}" y2="${level}" class="chart-grid"/><text x="${x0 - 8}" y="${level + 4}" text-anchor="end">${number(min + (max - min) * index / steps)}</text>`;
  }).join('');
  // La cuadrícula es fija y la línea se descubre de izquierda a derecha deslizando un recorte (chart-reveal), sin redibujarla.
  const end = places.at(-1);
  return `<div class="progress-plot"><svg class="chart-base" ${box} aria-hidden="true"><g data-key="grid-${min}-${max}-${steps}">${grid}</g><text data-key="from" x="${x0}" y="158">${date(points[0].date)}</text><text data-key="to" x="${x1}" y="158" text-anchor="end">${date(points.at(-1).date)}</text></svg><div class="chart-reveal"><svg class="progress-chart" ${box} role="img" tabindex="0" data-points="${escape(JSON.stringify(data))}" aria-label="${metric.shortLabel} por entrenamiento. Los valores están en la tabla inferior."><polyline data-key="line" points="${linePath(places)}" fill="none" class="chart-line"/><path data-key="dots" d="${dotsPath(places)}" class="chart-dots"/></svg></div><i class="chart-cross" style="left:${plotLeft(end)}"></i><i class="chart-active" style="left:${plotLeft(end)};top:${plotTop(end)}"></i></div>`;
}

// UI-03: primero la gráfica del ejercicio; después, el resumen del periodo, los grupos musculares y los récords.
export function progressDashboard(sessions, state) {
  const filtered = inPeriod(sessions, state.progressPeriod || '90');
  const options = exerciseOptions(sessions);
  if (!options.some((option) => option.id === state.progressExercise)) state.progressExercise = options[0]?.id || '';
  const sides = availableSides(sessions, state.progressExercise);
  if (!sides.includes(state.progressSide)) state.progressSide = sides[0] || 'both';
  const points = exerciseSeries(filtered, state.progressExercise, state.progressSide);
  if (!metricDefinitions[state.progressMetric]) state.progressMetric = 'performance';
  const latest = points.at(-1);
  const metric = metricDefinitions[state.progressMetric];
  const records = personalRecords(points);
  const groups = muscleGroupSets(filtered);
  const maxGroupSets = Math.max(1, ...groups.map((group) => group.sets));
  const groupSummary = groups.length ? `<h2 class="ui-group-header"><span>Series por grupo muscular</span><span>${number(groups.reduce((sum, group) => sum + group.sets, 0))} en total</span></h2><section class="ui-group ui-pad muscle-bars">${groups.map((group) => `<div data-key="${escape(group.id)}"><span>${escape(MUSCLE_GROUPS[group.id] || group.id)}</span><i style="--share:${group.sets / maxGroupSets}"></i><strong class="num">${number(group.sets)}</strong></div>`).join('')}</section>` : '';
  const record = (name, label, value, detail) => `<div class="ui-row"><span class="ui-row-lead">${icon(name)}${label}</span><span class="record-value"><strong class="num">${value}</strong><small>${detail}</small></span></div>`;
  const recordRows = records ? `<h2 class="ui-group-header">Récords del periodo</h2><div class="ui-group">${record('trophy', 'Rendimiento', `${estimate(records.performance.estimatedOneRepMax)} lb`, `${number(records.performance.weight)} × ${records.performance.reps}`)}${record('barbell', 'Mayor carga', `${number(records.weight.maxWeight)} lb`, `${records.weight.maxWeightReps} reps`)}${record('repeat', 'Más repeticiones', records.reps.maxReps, `con ${number(records.reps.maxRepsWeight)} lb`)}${record('stack', 'Mayor volumen', `${number(records.volume.volume)} lb`, date(records.volume.date))}</div>` : '';
  const table = points.length ? `<details class="ui-group progress-records"><summary>Ver registros (${points.length})${icon('down')}</summary><div class="ui-fold"><div class="ui-fold-in"><div class="records-scroll"><table><caption class="visually-hidden">Rendimiento, volumen y repeticiones por sesión</caption><thead><tr><th>Fecha</th><th>Mejor serie</th><th>Rendimiento</th><th>Volumen</th><th>Reps</th></tr></thead><tbody>${[...points].reverse().map((point) => `<tr><td>${date(point.date)}</td><td>${number(point.weight)} × ${point.reps}</td><td>${estimate(point.estimatedOneRepMax)} lb</td><td>${number(point.volume)} lb</td><td>${number(point.totalReps)}</td></tr>`).join('')}</tbody></table></div></div></div></details>` : '';
  const name = options.find((option) => option.id === state.progressExercise)?.name || '';
  const sideChoice = sides.length > 1 || (sides.length && sides[0] !== 'both') ? segmented('Registro', 'data-progress-side', sides.map((side) => [side, sideNames[side]]), state.progressSide) : '';
  const graph = !latest
    ? '<div class="quiet-empty"><strong>Sin registros en este periodo</strong><p>Prueba otro periodo o completa una sesión con este ejercicio.</p></div>'
    : `<div class="chart-heading"><div><span class="chart-label" data-chart-label>${metric.shortLabel}</span><strong class="chart-hero num"><span data-chart-value data-roll>${metric.format(latest[metric.field])}</span> <small>${metric.unit}</small></strong><span class="chart-detail" data-chart-detail>${pointDetail(latest, state.progressMetric)}</span></div><div class="chart-change"><strong class="num" data-chart-change>${pointChange(points, points.length - 1, metric.field)}</strong><small>frente al anterior</small></div></div>${points.length > 1 ? chart(points, state.progressMetric) : '<p class="quiet-empty">La gráfica aparecerá con el próximo registro.</p>'}${segmented('Métrica de la gráfica', 'data-progress-metric', Object.entries(metricDefinitions).map(([id, item]) => [id, item.label]), state.progressMetric)}`;
  const exercise = options.length
    ? `<section class="ui-group progress-detail" data-chart><button class="ui-row progress-picker-trigger" data-action="progress-picker" aria-label="Ejercicio: ${escape(name)}. Cambiar"><strong>${escape(name)}</strong>${icon('updown')}</button><div class="ui-pad">${sideChoice}${graph}</div></section>`
    : '<section class="quiet-empty"><strong>Tu progreso empieza con una sesión</strong><p>Completa un entrenamiento para ver tus resultados.</p><button class="ui-link" data-action="new-session">Crear entrenamiento</button></section>';
  return `<header class="ui-title ui-title-row"><h1>Progreso</h1><button class="info-button" data-action="progress-info" aria-label="Cómo se calcula el progreso">${icon('info')}</button></header>${segmented('Periodo de análisis', 'data-period', [['30', '30 días'], ['90', '90 días'], ['all', 'Todo']], state.progressPeriod || '90')}${exercise}${metrics(overview(filtered))}${groupSummary}${recordRows}${table}`;
}

// DATA-03: snapshots es null mientras se cargan, 'unavailable' si IndexedDB falla, o la lista de copias.
const snapshotTitle = (snapshot) => (snapshot.reason === 'version' ? `Versión ${escape(snapshot.appVersion)}` : 'Antes de restaurar');
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
    <div class="ui-group"><div class="ui-row"><span>Entrenamientos</span><span class="ui-value num">${number(sessions.length)}</span></div><div class="ui-row"><span>Ejercicios propios</span><span class="ui-value num">${number(customCount)}</span></div></div>
    <p class="ui-group-footer">Se guardan solo en este dispositivo. Exporta una copia para conservarlos fuera de él.</p>
    <div class="ui-group ui-group-gap"><button class="ui-row" data-action="export"><span class="ui-row-icon">${icon('export')}</span><span class="ui-row-main"><strong>Exportar copia</strong><small>Guarda un archivo con todos tus datos</small></span>${chevron()}</button><button class="ui-row" data-action="import"><span class="ui-row-icon">${icon('import')}</span><span class="ui-row-main"><strong>Restaurar copia</strong><small>Reemplaza tus datos por los del archivo</small></span>${chevron()}</button></div>
    ${snapshotSection(snapshots)}
    <h2 class="ui-group-header">Ilustraciones</h2>
    <p class="ui-group-footer">La anatomía de las ilustraciones se basa en BodyParts3D (The Database Center for Life Science, CC BY-SA 2.1 Japón) y Z-Anatomy (CC BY-SA 4.0). Las ilustraciones de Sterk se comparten con la licencia CC BY-SA 4.0.</p>
    <h2 class="ui-group-header">Fuente e iconos</h2>
    <p class="ui-group-footer">Archivo, con licencia SIL Open Font License. Phosphor Icons, con licencia MIT.</p>
    <h2 class="ui-group-header">Borrar datos</h2>
    <div class="ui-group"><button class="ui-row ui-row-danger" data-action="clear-data"><span class="ui-row-icon">${icon('trash')}</span><span class="ui-row-main">Borrar todos los datos</span></button></div>
    <p class="ui-group-footer">Elimina historial, entrenamiento en curso, ejercicios propios y preferencias de este dispositivo. Las copias automáticas se conservan.</p>
    <p class="version">Sterk · Versión ${APP_VERSION}</p>`;
}
