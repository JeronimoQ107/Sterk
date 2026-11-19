# Sterk — pendientes y propuestas

Revisión inicial: **2026-10-08**, sobre la versión **1.7.3**. Ampliado el **2026-11-16** con una revisión de interfaz y código sobre la misma versión, y con la protección de datos de quienes prueban la app. Este documento distingue problemas observados de ideas de producto. La organización documental está autorizada; las mejoras de funcionalidad siguientes siguen pendientes de una tarea que determine su alcance.

## Cómo usar este documento

- **Propuesta:** idea o corrección recomendada, aún sin encargo de implementación.
- **Aprobada:** el usuario ha solicitado el objetivo y se ha concretado su alcance.
- **En curso:** existe una tarea trabajando en ese objetivo.
- **Lista para integrar:** implementación y comprobaciones disponibles para revisión.
- **Completada:** cambios integrados en la rama de referencia y comprobados.

Actualiza el estado y anota evidencia relevante al avanzar. No marques una función completada por cerrar su chat o retirar su worktree. Las prioridades son recomendaciones; no establecen fechas ni aprueban trabajo.

## Fiabilidad de datos y métricas

| ID | Prioridad sugerida | Estado | Pendiente y resultado esperado |
| --- | --- | --- | --- |
| DATA-01 | Alta | Propuesta | Validar íntegramente los respaldos antes de escribir y hacer segura su restauración. Un respaldo inválido o un fallo de escritura debe conservar todos los datos anteriores. |
| DATA-02 | Alta | Completada | Evitar estados parciales en operaciones que actualizan varias claves, incluida la edición de fecha. Distinguir errores de lectura de datos ausentes y evitar sobrescribir datos recuperables. |
| DATA-03 | Alta | Completada | Red de seguridad para quienes prueban la app: guardar una instantánea de todas las claves `sterk:v1:*` antes de la primera ejecución de una versión nueva o de una migración, conservar las tres últimas y permitir restaurarlas desde Ajustes. Solicitar `navigator.storage.persist()`. |
| DATA-04 | Media | Propuesta | Recordar el respaldo ("última copia hace N días") y exportar con `navigator.share` y archivo cuando esté disponible, manteniendo la descarga como alternativa. |
| HIST-02 | Alta | Completada | Mostrar siempre en Historial, biblioteca y Progreso los registros antiguos sin `sessionId`. Hasta 1.7.4 desaparecían cuando no había sesión activa: `getHistorySessions` comparaba `entry.sessionId !== activeSessionId` y ambos valían `undefined`. Los datos seguían guardados, pero quien los buscara podía creer que se perdieron. |
| HIST-03 | Media | Completada | Calcular en Historial los totales de sesiones finalizadas con el formato antiguo (sin `exerciseCount`, `setCount` ni `volume`) a partir de sus entradas, en lugar de mostrar "undefined" y "NaN". |
| MET-01 | Alta | Propuesta | Unificar el tratamiento de series completadas con cero repeticiones entre resumen, historial y Progreso. Definir la regla antes de ajustar los cálculos. |
| MET-02 | Media | Propuesta | Hacer que el texto de comparación corresponda a la métrica seleccionada y que la tabla de Progreso incluya los valores necesarios para interpretar las tres gráficas. |

### Evidencia y comprobaciones de aceptación

- **DATA-01:** la importación escribe varias claves antes de terminar de normalizar la sesión activa. Un respaldo V4 con `activeSession.exercises: [null]` puede fallar después de modificar otros datos. Comprobar restauración válida V1–V4, datos malformados y errores de escritura, siempre conservando el estado anterior cuando la operación no se completa. Desde 1.7.4 (DATA-02), la importación prepara todos los valores antes de escribir, no reemplaza claves ilegibles y revierte si una escritura falla; falta validar el contenido completo del respaldo.
- **DATA-02:** almacenamiento mantiene varias entidades en claves independientes. Una lectura que falla puede convertirse en un valor vacío; una escritura posterior puede reemplazar datos. La edición de fecha también necesita coherencia entre sesión y entradas si una escritura falla. Añadir comprobaciones con fallos simulados en cada punto relevante. Verificado el 2026-11-15: si `sterk:v1:workout-entries` contiene JSON ilegible, el siguiente `saveWorkoutEntry` deja únicamente la entrada nueva. **Implementado (1.7.4, 2026-11-16):** ninguna escritura reemplaza una clave ilegible (error de lectura, JSON inválido o formato no normalizable); cambio de fecha, eliminación e importación escriben juntas y revierten si una escritura falla; aviso permanente y exportación del texto original. Pruebas en `tests/data-integrity.test.mjs` (cada operación × cada clave × tres tipos de fallo, el caso anterior y reversión) y en `tests/session.test.mjs`. Integrado en `main` y publicado como 1.7.4 el 2026-11-19, tras comprobar en iPhone la actualización 1.7.3 → 1.7.4 con datos, sesión abierta y sin conexión.
- **DATA-03:** comprobar que la instantánea se crea una sola vez por versión, no supera un tamaño razonable, restaura exactamente el estado anterior y no se crea si la lectura de los datos falla. **Implementado (1.7.5, 2026-11-19):** copia en IndexedDB del texto exacto de las claves tomado al arrancar, antes de la migración V0; tres copias de versión y una previa a cada restauración para deshacerla; restaurar desde Ajustes con la protección de DATA-02 (si un dato es ilegible, no se restaura). El tamaño queda acotado por el propio límite de `localStorage` y no lo consume. Pruebas en `tests/snapshots.test.mjs` y comprobación en navegador con IndexedDB real (copia exacta, restaurar y deshacer). Publicado en 1.7.5 (2026-11-19) junto con HIST-02; pendiente comprobarlo en iPhone, incluido que la copia sobrevive a una actualización.
- **HIST-02:** reproducido con `tests/fixtures/storage-v1.7.3.json`: con sesión activa el historial mostraba `legacy:push:1/8/2026` y tras `clearActiveSession()` desaparecía de Historial, de "Tu biblioteca" en Ajustes y de Progreso. **Implementado (1.7.5, 2026-11-19):** las entradas sin `sessionId` no se comparan con la sesión activa; las de la sesión activa siguen excluidas. `getHistorySessions` es la única fuente de Historial, Inicio, Ajustes y Progreso; `progress.js` y `storage.getLastExerciseEntry` no tenían el mismo filtro. Prueba en `tests/session.test.mjs` con el fixture de 1.7.3 (falla sin el arreglo) y comprobación en navegador a 390 px sin sesión activa: Historial y Ajustes muestran 4 entrenamientos y Progreso incluye el registro del 1 de agosto. Publicado en 1.7.5 (2026-11-19) junto con DATA-03; pendiente comprobarlo en iPhone.
- **HIST-03:** detectado al revisar HIST-02 con el mismo fixture: `session-b` (formato antiguo con `routineId` y `durationMinutes`) aparece como "undefined ejercicios · undefined series · NaN lb". También ocurre en 1.7.4; no afecta a los datos guardados. **Implementado (1.7.6, 2026-11-19):** Historial, su detalle, Inicio, la biblioteca y la comparación al finalizar usan los totales guardados si existen y, si faltan, los calculan de las entradas de la sesión; los datos guardados no se modifican. Prueba en `tests/session.test.mjs` con el fixture de 1.7.3 (falla sin el arreglo) y comprobación en navegador a 390 px: `session-b` muestra "1 ejercicios · 1 series · 337,5 lb". Publicado en 1.7.6 (2026-11-19); pendiente comprobarlo en iPhone.
- **QA-03:** desde 1.7.4 existe `tests/fixtures/storage-v1.7.3.json`, generado con el código de 1.7.3 y datos sintéticos (migración V0, lados asimétricos, serie con 0 repeticiones, ejercicio archivado, sesión activa). Las pruebas comprueban lectura, escritura y respaldo V4 sin pérdidas. Pendiente: añadir respaldos reales anonimizados y un fixture por cada versión publicada.
- **DATA-04:** comprobar la exportación en Safari instalado en pantalla de inicio, incluido guardar en Archivos.
- **MET-01:** el control permite marcar una serie con cero repeticiones; el resumen de almacenamiento puede contarla mientras Progreso la excluye. Comprobar registros bilaterales, izquierda/derecha y sesiones antiguas con una regla consistente.
- **MET-02:** el porcentaje sigue la métrica de Progreso seleccionada mientras la etiqueta muestra rendimiento estimado. La tabla ofrece rendimiento y volumen, pero omite repeticiones totales. Comprobar las tres selecciones y su lectura accesible.

## PWA, accesibilidad y comprobaciones

| ID | Prioridad sugerida | Estado | Pendiente y resultado esperado |
| --- | --- | --- | --- |
| PWA-01 | Alta | Completada | Limitar la limpieza de cachés a Sterk, separar fallbacks de navegación y recursos, y comprobar el ciclo de actualización. |
| PWA-02 | Alta | Completada | Evitar versiones mezcladas al actualizar: precachear con `cache: "reload"` para no tomar archivos de la caché HTTP, servir cada versión completa desde su propia caché y mantener una sola versión comprobada. |
| QA-03 | Alta | En curso | Fixtures con respaldos de versiones anteriores (anonimizados) y pruebas que confirmen que una versión nueva conserva todos los datos. Requisito de cualquier cambio en persistencia. |
| QA-01 | Alta | Propuesta | Ejecutar una revisión en iPhone físico: instalación, offline, recuperación de sesión, controles táctiles, decimales, respaldos y actualización con sesión activa. |
| A11Y-01 | Media | Propuesta | Revisar nombres accesibles de botones, foco tras renderizados y anuncios del temporizador con VoiceOver. Corregir problemas confirmados. |
| QA-02 | Media | Propuesta | Automatizar comprobaciones relevantes en CI y añadir cobertura de navegador para los flujos con mayor riesgo. |

Hasta 1.7.3, el service worker eliminaba todas las otras cachés del origen y podía devolver el HTML de inicio para un recurso no disponible. **Implementado (1.7.4, 2026-11-16):** solo borra cachés `sterk-*` anteriores; sin conexión, una navegación abre `index.html` guardado y un recurso ausente devuelve un error en vez de HTML.

Para PWA-02: `cache.addAll` puede recibir archivos que el navegador ya tenía en su caché HTTP y combinarlos con archivos nuevos; una mezcla de módulos puede dejar la pantalla en blanco, y en iPhone reinstalar la app para "arreglarla" borra sus datos. La versión aparece hoy en `package.json`, `CACHE_NAME` y el texto de Ajustes.

**PWA-02 implementado (1.7.4, 2026-11-16):** el precaché pide cada archivo con `cache: "reload"`, la instalación falla entera si falta uno (y entonces sigue la versión anterior) y cada respuesta sale solo de la caché de la versión activa, nunca de otra. Decisión: **no** se usa red primero para el HTML. `index.html` no cambia entre versiones y cargarlo de la red mientras los módulos salen de la caché anterior sería otra forma de mezclar versiones; el riesgo de olvidar subir la versión se cubre con una prueba. Sin paso de compilación, la versión sigue escrita en tres sitios: `tests/service-worker.test.mjs` falla si difieren o si el precaché no lista exactamente los archivos de la app. Evidencia: pruebas con cachés y red simuladas, y una actualización real 1.7.3 → 1.7.4 en Edge headless con perfil temporal (aviso de nueva versión, datos idénticos, caché ajena conservada, apertura sin conexión). Integrado en `main` y publicado como 1.7.4 el 2026-11-19, tras comprobar en iPhone (instalada en pantalla de inicio, mediante un túnel HTTPS temporal en otro origen) la actualización 1.7.3 → 1.7.4 con datos, sesión abierta y sin conexión.

Para QA-01, registrar dispositivo, versión de iOS, condiciones de red, pasos y resultado. La revisión de accesibilidad debe incluir el botón de volver del detalle de historial y el efecto de la actualización periódica del temporizador. No hay resultados de pruebas físicas incorporados en este análisis.

## Producto y mantenimiento

| ID | Prioridad sugerida | Estado | Propuesta y condición de éxito |
| --- | --- | --- | --- |
| UI-01 | Media | Propuesta | Arreglos rápidos verificados: volver arriba al cambiar de vista o iniciar la sesión, ajustar el eje vertical de Rendimiento al rango de datos, redondear el rendimiento estimado, unificar el formato numérico y mantener los avisos visibles más de 1 s. |
| UX-01 | Media | Propuesta | Repetir un entrenamiento o usar plantillas, reduciendo la selección manual sin arrastrar series como completadas. |
| UX-02 | Media | Completada | Simplificar la pantalla de ejercicio: mostrar el resultado anterior dentro de cada serie, mover Añadir/Editar/Finalizar a un menú del encabezado, eliminar navegación duplicada, dar estilo a la casilla "Por lado" y reducir el ruido de los valores vecinos en los controles. Debe haber menos controles visibles sin perder funciones. |
| UI-02 | Media | En curso | Aplicar la paleta índigo azulado sobre carbón y la fuente del sistema a toda la app, retirar etiquetas en mayúsculas, brillos y textos de relleno, y rehacer el icono. Reglas en [design-principles.md](design-principles.md). |
| UX-03 | Baja | Propuesta | Inicio y constructor: mostrar primero ejercicios recientes o frecuentes, compactar el encabezado de Inicio y dejar un solo acceso a "Crear ejercicio". |
| UX-04 | Media | Propuesta | Sustituir los 12 `confirm()` y 5 `alert()` nativos por diálogos propios o avisos con Deshacer. |
| HIST-01 | Media | Propuesta | Editar peso y repeticiones de entrenamientos guardados, conservando coherencia de totales y progreso. Actualmente solo se puede ajustar la fecha o eliminar datos desde ese detalle. |
| LOAD-01 | Media | Propuesta | Definir unidades y tipos de carga, incluidos ejercicios con peso corporal, para evitar interpretar todos los ejercicios como carga externa en lb. |
| MET-03 | Media | Propuesta | Comparar sesiones con criterios claros; un volumen mayor por añadir ejercicios no implica automáticamente mejor rendimiento. |
| VIS-01 | Baja | Propuesta | Ampliar ilustraciones coherentes para el catálogo. Actualmente hay 60 ejercicios y solo Pec Deck dispone de imagen. |
| TECH-01 | Baja | Propuesta | Medir el coste de leer y normalizar historiales grandes antes de optimizar almacenamiento. Reducir lecturas repetidas si se confirma impacto. |
| TECH-02 | Baja | Propuesta | Separar gradualmente responsabilidades de interfaz y ordenar CSS al trabajar en esas zonas, sin reescribir la aplicación completa. |
| TECH-03 | Baja | Propuesta | Retirar código sin uso y duplicado: manejadores `data-filter`/`builderFilter`, `data-set-weight` y `data-set-reps` sin marcado que los genere; constante `setMode = true`; controles y selectores de peso/repeticiones casi idénticos; `escapeHtml`/`escape` y formateadores repetidos. |

### Evidencia de la revisión del 2026-11-15

- **UI-01:** al iniciar la sesión desde el constructor desplazado (900 px), la pantalla de ejercicio no vuelve arriba; solo `goToExercise` llama a `scrollTo`. La gráfica usa 0 como base (`y = y1 - valor / max × alto`): con rendimientos entre 258 y 263 lb la línea se ve plana. El rendimiento se muestra con dos decimales ("263,08 lb"). Historial formatea sin separador de miles ("16542,5 lb", `formatNumber` con `useGrouping: false`) e Inicio con separador ("16.542,5 lb"). `showToast` oculta el aviso a los 1000 ms.
- **UX-02 y UI-02:** aprobados el 2026-11-19 tras una revisión con datos de demostración y tres maquetas: dirección A (iOS nativo) con la paleta índigo azulado. La especificación de la pantalla de ejercicio está en [design-principles.md](design-principles.md); queda por decidir cuándo se registra un ejercicio con series sin marcar si se retira "Registrar ejercicio". Rehacer el icono no cambiará el de las instalaciones existentes en iPhone. **Implementado y publicado en 1.8.0 (2026-11-19), tras probarlo en iPhone:** paleta en toda la app (claro y oscuro, sin brillos ni degradados decorativos, fuente del sistema) y nueva pantalla de ejercicio con registro al salir. Pruebas en `tests/session.test.mjs` (orden de la fila, registro al salir, finalizar con pendientes) y revisión en navegador a 390 px en ambos modos, incluido el modo por lado y el menú `⋯`. Pendiente de UI-02: estructura de Inicio, Historial, Progreso, Ajustes y constructor, e icono. Pendiente de TECH-03: retirar el CSS de la pantalla de ejercicio anterior (`.set-card`, `.exercise-jump`, `.previous-compact`…), que ya no se genera.
- **UX-02 (evidencia original):** la pantalla de ejercicio muestra unos 15 controles además de las series. Anterior/Siguiente repiten las pestañas numeradas, "Registrar ejercicio" coincide con el registro automático al marcar la última serie y la referencia anterior ocupa una línea truncada. En modo por lado hay tres botones de marcado por serie.
- **TECH-01:** en Chrome de escritorio, abrir Historial tardó 12 ms con 50 sesiones, 47 ms con 200 y 115 ms con 450; la búsqueda vuelve a dibujar la lista con cada letra. En iPhone será más lento; no es urgente.

## Opciones futuras que requieren definir alcance

IndexedDB, sincronización, cuentas, exportación a Excel, RIR y temporizadores de descanso siguen siendo opciones futuras. No son requisitos del flujo de organización ni dependencias para corregir problemas actuales. Evaluar cada opción por el beneficio que aporte al uso real de Sterk.

## Orden de trabajo recomendado

1. Proteger los datos de quienes prueban la app: DATA-02, DATA-03, PWA-02, PWA-01 y DATA-01, con QA-03 como requisito de cada uno.
2. Arreglos rápidos y métricas: UI-01, HIST-03, MET-01 y MET-02.
3. Validar los flujos reales en un iPhone físico: QA-01.
4. Reducir fricción: UX-01 y UX-02; después UX-04, DATA-04 y UX-03.
5. Mantenimiento al trabajar en esas zonas: TECH-03, TECH-02 y TECH-01.

Esta secuencia admite cambios por decisión del usuario. Cada tarea debe referenciar su ID y mantener actualizado el contexto o la arquitectura si modifica decisiones. El proceso para aislar e integrar trabajo está en [development-workflow.md](development-workflow.md).
