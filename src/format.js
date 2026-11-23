// TECH-03: un solo sitio para escapar HTML y dar formato a números y fechas (es-CO, separador de miles en todas partes).
export const escapeHtml = (value) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
// Pesos: se conservan todos los decimales que se hayan escrito.
export const formatNumber = (value) => Number(value).toLocaleString("es-CO", { maximumFractionDigits: 10 });
// Totales, conteos y métricas: hasta dos decimales.
export const formatTotal = (value) => Number(value).toLocaleString("es-CO", { maximumFractionDigits: 2 });
export const formatDayMonth = (value) => new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short" }).format(new Date(value));
