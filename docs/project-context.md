# Sterk — contexto del proyecto

> Contexto de producto y decisiones duraderas. Estado revisado: **1.7.3, 2026-10-08**. Actualizar cuando cambien el alcance o las decisiones; los pendientes viven en [roadmap.md](roadmap.md).

## Visión y prioridades

Sterk es una aplicación personal para registrar el progreso en el gimnasio desde un iPhone con la menor fricción posible. Es una PWA instalable mediante **Añadir a pantalla de inicio**.

Desde noviembre de 2026, varias personas cercanas la prueban instalada en sus iPhone. Sus datos solo existen en sus dispositivos, así que ninguna actualización puede ponerlos en riesgo; las reglas están en [AGENTS.md](../AGENTS.md#datos-de-quienes-prueban-la-app).

1. Minimizar toques y escritura y facilitar el uso con una mano.
2. Mostrar el entrenamiento anterior y registrar peso y repeticiones por serie.
3. Recuperar una sesión interrumpida y conservar el historial y sus respaldos.
4. Mantener una arquitectura local-first; añadir sincronización solo cuando aporte valor.
5. Evitar servicios de pago cuando exista una alternativa gratuita razonable.
6. Considerar Excel como exportación opcional para análisis, sin convertirlo en base de datos.

## Estado implementado — 1.7.4

- HTML, CSS y JavaScript vanilla, sin frameworks ni backend. Persistencia mediante una capa `storage` sobre `localStorage`.
- Catálogo de **60 ejercicios predeterminados**, búsqueda por nombres y alias en español e inglés sin distinguir acentos, grupos musculares y categorías Push/Pull/Legs. Se pueden crear y archivar ejercicios personalizados.
- Una ilustración disponible: **Pec Deck**. Los demás ejercicios muestran iniciales; la biblioteca completa de imágenes está pendiente.
- Sesiones construidas mediante selección y orden libre. Durante la sesión se pueden añadir, crear, quitar y reordenar ejercicios, navegar entre ellos y omitir o recuperar pendientes.
- **Registro por serie obligatorio**: marcado independiente y peso/repeticiones por serie. El selector de modo se eliminó; los campos históricos `trackingMode` se conservan por compatibilidad, pero no permiten desactivar los checks.
- Registro opcional por lado, con valores y marcado independientes para izquierda/derecha. Copiar valores no marca automáticamente el lado de destino. Los registros anteriores permanecen sin lado asignado.
- Controles de peso y repeticiones por deslizamiento y entrada manual. El peso utiliza libras y pasos de 2,5 lb; las repeticiones admiten enteros de 0 a 999.
- Referencia al entrenamiento anterior, persistencia de la sesión activa y duración automática. Completar todas las series válidas registra el ejercicio; el entrenamiento se termina mediante una acción explícita.
- Historial por entrenamiento con detalles, cambio de fecha y eliminación. **Todavía no permite editar peso, repeticiones o series de una sesión finalizada**.
- Inicio con acceso al último entrenamiento; Progreso con periodos de 30/90 días o todo el historial, actividad, rendimiento estimado, volumen, repeticiones, récords del periodo y series por grupo muscular.
- Respaldo JSON **V4**, importación compatible con V1–V4 y migración del historial V0. Una clave ilegible se conserva sin sobrescribirla y la app avisa (DATA-02); la validación completa de respaldos sigue pendiente (DATA-01).
- PWA con manifiesto, iconos y service worker para recursos offline. La validación completa en un iPhone físico sigue pendiente.

## Reglas de producto

- La categoría prevista se deriva de la selección; la categoría final se deriva de los ejercicios registrados.
- La sesión activa debe conservarse al cerrar, recargar o bloquear el teléfono. El historial usado por Progreso excluye esa sesión.
- Registrar u omitir el último ejercicio no cierra el entrenamiento. Para finalizar hay que registrar, omitir o quitar los ejercicios pendientes.
- La fecha histórica y el comienzo real del cronómetro son conceptos distintos: cambiar la fecha no debe inflar la duración.
- El rendimiento es una estimación comparativa basada en peso y repeticiones, no una medición real de 1RM.
- Las discrepancias entre métricas y los riesgos de persistencia están documentados en [architecture.md](architecture.md) y [roadmap.md](roadmap.md). No se consideran resueltos por esta actualización documental.

## Fuera de alcance actual

Backend, autenticación, sincronización remota, Cloudflare Worker, Microsoft Graph, OneDrive, temporizadores manuales de ejercicio o descanso, RIR/RPE, velocidad de ejecución y analítica predictiva avanzada permanecen pospuestos. IndexedDB y la exportación CSV/XLSX son posibilidades futuras, no componentes implementados.

Las propuestas del análisis de la aplicación —plantillas, edición del historial, unidades y mejores comparaciones, entre otras— **no constituyen aprobación para implementarlas**. Su prioridad y estado se consultan en el roadmap.

## Organización del desarrollo

El contexto compartido reside en archivos versionados: `AGENTS.md` orienta el trabajo, este documento conserva producto y decisiones, `architecture.md` describe la implementación y `roadmap.md` concentra pendientes. El flujo operativo está en [development-workflow.md](development-workflow.md).

Una mejora puede afectar varias carpetas y seguir siendo un solo objetivo. Se utiliza un worktree por objetivo cuando aporte aislamiento; crear otro chat no sustituye la actualización de documentos ni la integración de código. Se conserva la estructura actual de la PWA y se pospone mover módulos hasta que una necesidad concreta lo justifique.

## Registro de decisiones

| Fecha | Decisión | Estado |
|---|---|---|
| 2026-09-02 | Construir Sterk como PWA vanilla y usar `localStorage` detrás de una abstracción sustituible. | Vigente |
| 2026-09-02 | Posponer backend, autenticación, Microsoft Graph y Excel; adoptar el nombre Sterk. | Vigente |
| 2026-09-02 | Añadir recuperación de sesión, historial básico y respaldo JSON en V1. | Implementada |
| 2026-09-02 | Ofrecer registro por ejercicio y por serie. | Histórica; el selector se retiró y el registro actual es por serie |
| 2026-09-03 | Medir la duración automáticamente, permitir peso por serie y agrupar el historial por sesión. | Implementada |
| 2026-09-03 | Construir sesiones libremente desde un catálogo clasificado. | Implementada |
| 2026-09-03 | Mantener Excel fuera del camino crítico y como posible exportación. | Vigente |
| 2026-10-08 | Organizar el desarrollo con `AGENTS.md`, documentos versionados y worktrees por objetivo cuando aporten aislamiento, conservando por ahora la estructura del código. | Aprobada |
| 2026-11-16 | Con personas probando la app, preservar sus datos locales en cada actualización tiene prioridad sobre las mejoras de funcionalidad. | Vigente |
| 2026-11-16 | Trabajar también con Claude Code: `CLAUDE.md` importa `AGENTS.md` para compartir las mismas instrucciones. | Vigente |
