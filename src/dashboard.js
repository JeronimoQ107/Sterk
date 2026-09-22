import { icon } from './icons.js';
import { MUSCLE_GROUPS } from './data.js';
import { inPeriod, overview, exerciseOptions, availableSides, exerciseSeries, personalRecords, muscleGroupSets } from './progress.js';
const escape = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const number = (value) => Number(value).toLocaleString('es-CO', { maximumFractionDigits: 2 });
const date = (value) => new Date(value).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
const sideNames = { both: 'Sin lado asignado', left: 'Izquierdo', right: 'Derecho' };
const metrics = (stats) => `<div class="overview-metrics"><div><strong>${stats.sessions}</strong><span>Entrenamientos</span></div><div><strong>${stats.sets}</strong><span>Series hechas</span></div><div><strong>${stats.days}</strong><span>Días activos</span></div></div>`;

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
  return { title: 'Tu sesión más reciente', detail: `${last.exerciseCount} ${last.exerciseCount === 1 ? 'ejercicio' : 'ejercicios'} · ${last.setCount} ${last.setCount === 1 ? 'serie' : 'series'}`, value: `${number(last.volume)} lb` };
}

export function homeDashboard(sessions) {
  const last = sessions[0];
  const insight = homeInsight(sessions);
  return `<div class="home-intro"><p class="eyebrow">ENTRENA A TU MANERA</p><h2>Tu próximo<br><em>entrenamiento.</em></h2></div><button class="new-session-card" data-action="new-session"><span><strong>Empezar entrenamiento</strong><small>Elige ejercicios y registra tus series</small></span><i>${icon('plus')}</i></button>${insight ? `<section class="home-insight"><div><span class="eyebrow">EN TU ÚLTIMA SESIÓN</span><h3>${escape(insight.title)}</h3><p>${escape(insight.detail)}</p></div><strong>${escape(insight.value)}</strong><button data-view="progress">Ver progreso ${icon('right')}</button></section>` : `<section class="home-insight empty"><span class="eyebrow">AQUÍ EMPIEZA</span><h3>Tu primer registro</h3><p>Los detalles de tus entrenamientos aparecerán aquí.</p></section>`}<section class="home-recent"><div class="card-heading"><h2>Actividad reciente</h2><button data-view="history">Ver historial</button></div>${last ? `<button class="recent-session" data-history-session="${escape(last.id)}"><div><small>${date(last.startedAt)}</small><strong>${escape(last.label)}</strong><p>${escape(last.entries.slice(0, 3).map((entry) => entry.exercise).join(' · '))}</p></div>${icon('right')}</button>` : `<div class="quiet-empty">No hay entrenamientos guardados.</div>`}</section>`;
}

const metricDefinitions = {
  performance: { label: 'Rendimiento', shortLabel: 'Rendimiento estimado', unit: 'lb', field: 'estimatedOneRepMax' },
  volume: { label: 'Volumen', shortLabel: 'Volumen total', unit: 'lb', field: 'volume' },
  reps: { label: 'Repeticiones', shortLabel: 'Repeticiones totales', unit: 'reps', field: 'totalReps' },
};

function chart(points, metricId) {
  const metric = metricDefinitions[metricId] || metricDefinitions.performance;
  const w = 320, h = 160, x0 = 42, x1 = 302, y0 = 16, y1 = 130;
  const highest = Math.max(1, ...points.map((point) => point[metric.field]));
  const step = 10 ** Math.max(0, Math.floor(Math.log10(highest)) - 1);
  const max = Math.ceil(highest / step) * step;
  const first = +new Date(points[0].date), last = +new Date(points.at(-1).date);
  const x = (point, index) => last !== first ? x0 + ((+new Date(point.date) - first) / (last - first)) * (x1 - x0) : x0 + index * (x1 - x0) / Math.max(1, points.length - 1);
  const y = (point) => y1 - point[metric.field] / max * (y1 - y0);
  const line = points.map((point, index) => `${x(point, index)},${y(point)}`).join(' ');
  return `<svg class="progress-chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="${metric.shortLabel} por entrenamiento. Los valores están en la tabla inferior.">${[0, .5, 1].map((fraction) => `<line x1="${x0}" x2="${x1}" y1="${y1 - fraction * (y1 - y0)}" y2="${y1 - fraction * (y1 - y0)}" class="chart-grid"/><text x="${x0 - 7}" y="${y1 - fraction * (y1 - y0) + 4}" text-anchor="end">${number(max * fraction)}</text>`).join('')}<polyline points="${line}" fill="none" class="chart-line"/>${points.map((point, index) => `<circle cx="${x(point, index)}" cy="${y(point)}" r="3.5" class="chart-dot"><title>${date(point.date)}: ${number(point[metric.field])} ${metric.unit}</title></circle>`).join('')}<text x="${x0}" y="154">${date(points[0].date)}</text><text x="${x1}" y="154" text-anchor="end">${date(points.at(-1).date)}</text></svg>`;
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
  const groupSummary = groups.length ? `<section class="dashboard-card muscle-summary"><div class="card-heading"><h2>Series por grupo</h2><span>${groups.reduce((sum, group) => sum + group.sets, 0)} total</span></div><div class="muscle-bars">${groups.map((group) => `<div><span>${escape(MUSCLE_GROUPS[group.id] || group.id)}</span><i><b style="width:${group.sets / maxGroupSets * 100}%"></b></i><strong>${group.sets}</strong></div>`).join('')}</div></section>` : '';
  const recordCards = records ? `<section class="personal-records"><h3>Récords del periodo</h3><div><article><small>Rendimiento</small><strong>${number(records.performance.estimatedOneRepMax)} lb</strong><span>${number(records.performance.weight)} × ${records.performance.reps}</span></article><article><small>Mayor carga</small><strong>${number(records.weight.maxWeight)} lb</strong><span>${records.weight.maxWeightReps} reps</span></article><article><small>Más repeticiones</small><strong>${records.reps.maxReps}</strong><span>con ${number(records.reps.maxRepsWeight)} lb</span></article><article><small>Mayor volumen</small><strong>${number(records.volume.volume)} lb</strong><span>${date(records.volume.date)}</span></article></div></section>` : '';
  return `<div class="progress-title-row"><div class="page-title compact-title"><p class="eyebrow">TU CONSTANCIA, A LA VISTA</p><h2>Progreso</h2></div><button class="info-button" data-action="progress-info" aria-label="Cómo se calcula el progreso">${icon('info')}</button></div><div class="period-filter" aria-label="Periodo de análisis">${[['30', '30 días'], ['90', '90 días'], ['all', 'Todo']].map(([id, label]) => `<button data-period="${id}" aria-pressed="${(state.progressPeriod || '90') === id}">${label}</button>`).join('')}</div>${metrics(overview(filtered))}${groupSummary}<section class="dashboard-card progress-detail"><div class="card-heading"><h2>Por ejercicio</h2>${icon('chart')}</div>${options.length ? `<label class="field-label">Ejercicio<select id="progress-exercise">${options.map((option) => `<option value="${escape(option.id)}" ${state.progressExercise === option.id ? 'selected' : ''}>${escape(option.name)}</option>`).join('')}</select></label>${sides.length > 1 || sides[0] !== 'both' ? `<label class="field-label">Registro<select id="progress-side">${sides.map((side) => `<option value="${side}" ${state.progressSide === side ? 'selected' : ''}>${sideNames[side]}</option>`).join('')}</select></label>` : ''}${latest ? `<div class="load-summary"><div><small>Rendimiento estimado</small><strong>${number(latest.estimatedOneRepMax)} <span>lb</span></strong><p>${number(latest.weight)} lb × ${latest.reps} · ${date(latest.date)}</p></div><div class="load-change"><small>Frente al anterior</small><strong>${change === null ? 'Sin comparación' : `${change > 0 ? '+' : ''}${number(change)}%`}</strong></div></div><div class="session-work"><div><strong>${number(latest.volume)}</strong><span>Volumen · lb</span></div><div><strong>${latest.totalReps}</strong><span>Repeticiones</span></div><div><strong>${latest.setCount}</strong><span>Series</span></div></div><div class="metric-filter" aria-label="Métrica de la gráfica">${Object.entries(metricDefinitions).map(([id, metric]) => `<button data-progress-metric="${id}" aria-pressed="${state.progressMetric === id}">${metric.label}</button>`).join('')}</div>${points.length > 1 ? chart(points, state.progressMetric) : `<p class="quiet-empty">La gráfica aparecerá con el próximo registro.</p>`}${recordCards}<details class="progress-records"><summary>Ver registros (${points.length})</summary><div class="records-scroll"><table><caption class="visually-hidden">Rendimiento, volumen y repeticiones por sesión</caption><thead><tr><th>Fecha</th><th>Mejor serie</th><th>Rendimiento</th><th>Volumen</th></tr></thead><tbody>${[...points].reverse().map((point) => `<tr><td>${date(point.date)}</td><td>${number(point.weight)} × ${point.reps}</td><td>${number(point.estimatedOneRepMax)} lb</td><td>${number(point.volume)} lb</td></tr>`).join('')}</tbody></table></div></details>` : `<div class="quiet-empty"><strong>Sin registros en este periodo</strong><p>Prueba otro periodo o completa una sesión con este ejercicio.</p></div>`}` : `<div class="quiet-empty"><strong>Tu progreso empieza con una sesión</strong><p>Completa un entrenamiento para ver tus resultados.</p><button class="text-link" data-action="new-session">Crear entrenamiento</button></div>`}</section>`;
}

export function settingsDashboard(sessions, customCount) {
  return `<div class="page-title compact-title"><p class="eyebrow">TUS DATOS</p><h2>Ajustes</h2></div>
    <section class="dashboard-card"><div class="card-heading"><h2>Tu biblioteca</h2>${icon('history')}</div>
      <div class="library-summary"><span><strong>${sessions.length}</strong> ${sessions.length === 1 ? 'entrenamiento' : 'entrenamientos'}</span><span><strong>${customCount}</strong> ${customCount === 1 ? 'ejercicio propio' : 'ejercicios propios'}</span></div>
      <p class="section-description">Se guarda en este navegador. Exporta una copia para conservarla fuera del dispositivo.</p>
      <div class="backup-actions"><button data-action="export"><strong>Exportar copia</strong><small>Guardar un archivo JSON</small>${icon('right')}</button><button data-action="import"><strong>Restaurar copia</strong><small>Reemplaza los datos actuales</small>${icon('right')}</button></div>
    </section><details class="danger-settings"><summary>Administrar borrado</summary><p>Elimina historial, sesión activa, ejercicios propios y preferencias de este navegador.</p><button data-action="clear-data">Borrar todos los datos</button></details><p class="version">Sterk · Versión 1.7.2<br>Hecho para entrenar a tu ritmo.</p>`;
}
