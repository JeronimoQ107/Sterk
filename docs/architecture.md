# Arquitectura de Sterk

> Implementación revisada: **1.9.3, 2026-11-24**. Producto y decisiones: [project-context.md](project-context.md). Pendientes: [roadmap.md](roadmap.md). Flujo de desarrollo: [development-workflow.md](development-workflow.md).

## Implementación actual

```text
iPhone / navegador → PWA vanilla → capa storage → localStorage
```

La aplicación utiliza HTML/CSS y módulos ES de JavaScript, sin framework, backend ni dependencias npm. `npm start` sirve la carpeta por HTTP y `npm test` ejecuta las pruebas con el runner de Node.

| Archivo o carpeta | Responsabilidad |
|---|---|
| `index.html`, `manifest.json`, `icons/` | Entrada, metadatos e instalación PWA. |
| `src/app.js` | Estado de UI, navegación, constructor, sesión, historial e interacciones. |
| `src/dashboard.js` | Vistas de Inicio, Ajustes y Progreso, gráfica SVG y tabla. |
| `src/data.js` | 60 ejercicios, grupos, categorías, alias, imágenes y compatibilidad con rutinas antiguas. |
| `src/storage.js` | Persistencia, normalización, migración, catálogo personalizado y respaldos. |
| `src/snapshots.js` | Copias automáticas de los datos en IndexedDB y su restauración (DATA-03). |
| `src/version.js` | `APP_VERSION`, mostrada en Ajustes y guardada en cada copia. |
| `src/sets.js` | Normalización y cálculos de series bilaterales o por lado. |
| `src/progress.js` | Filtros y cálculos de actividad, rendimiento, volumen, repeticiones y récords. |
| `src/weight-control.js`, `src/reps-control.js` | Ajuste por arrastre, rueda y teclado, conservando el control durante el gesto. |
| `src/weight-picker.js`, `src/reps-picker.js` | Diálogos de entrada manual con validación. |
| `src/format.js` | Escape de HTML y formato de números y fechas (`es-CO`, separador de miles), compartido por todas las vistas (TECH-03). |
| `src/icons.js`, `src/styles.css` | Iconos SVG y presentación mobile-first. |
| `assets/exercises/` | Una imagen disponible: `pec-deck.png`. |
| `service-worker.js` | Caché del shell y recursos offline. |
| `tests/`, `scripts/` | Pruebas con almacenamiento/DOM simulados y servidor local. `tests/fixtures/storage-v1.7.3.json` contiene un estado sintético escrito por 1.7.3 para comprobar compatibilidad (QA-03). |

La UI consume la API pública de `storage`; no accede directamente a las claves de `localStorage`. Los cálculos de series y progreso están separados, pero `app.js` todavía reúne estado, vistas e interacciones. La organización en carpetas adicionales es una refactorización futura.

## Datos y compatibilidad

`storage` conserva cinco conjuntos bajo claves `sterk:v1:*`: entradas, sesión activa, sesiones finalizadas, ajustes y ejercicios personalizados. Lee el historial `gym-tracker:v0:workout-entries` para migrarlo cuando la clave de entradas V1 está ausente; un error al leerla no cuenta como ausencia.

### Claves ilegibles (DATA-02, desde 1.7.4)

Cada lectura distingue tres casos: clave ausente, clave legible y clave ilegible (error de `getItem`, JSON inválido o un formato que no se puede normalizar, como una lista con `null`). Las lecturas para mostrar datos devuelven el valor por defecto y registran el problema; nunca escriben.

- Toda escritura pasa por `commit`, que vuelve a leer cada clave afectada y lanza `StorageReadError` sin escribir nada si alguna es ilegible. Esto incluye guardar o borrar la sesión activa, restaurar un respaldo y borrar todos los datos: el valor original se conserva hasta que vuelva a leerse correctamente.
- Las operaciones que modifican varias claves (cambio de fecha, eliminación de un entrenamiento, importación) leen todo antes de escribir y escriben juntas. Si una escritura falla, se restaura el texto original de todas las claves de la operación.
- `storage.checkData()` revisa todas las claves; `storage.getStorageProblems()` devuelve los problemas detectados en las últimas lecturas. La interfaz muestra un aviso permanente con las claves afectadas y un botón para exportar, y un `alert` cuando una acción queda bloqueada.
- Si hay claves ilegibles, la exportación añade `unreadableData` con su texto original para recuperarlo a mano. La importación ignora ese campo.

### Copias automáticas (DATA-03, desde 1.7.5)

- Al cargar `storage.js` se guarda en memoria el texto exacto de todas las claves `sterk:v1:*` y del historial V0, antes de la migración V0 y de cualquier escritura de la app.
- Tras el primer render, `snapshots.js` guarda ese texto en IndexedDB (`sterk-snapshots`) si aún no existe una copia de la versión actual. No se crea si alguna clave no se pudo leer (DATA-02) ni si no hay datos; en ese caso se reintenta en el siguiente arranque.
- Se usa IndexedDB y no `localStorage` para no consumir el límite de unos 5 MB de Safari: si `localStorage` se llenara, fallaría guardar entrenamientos. Cada copia ocupa lo mismo que los datos y se conservan como máximo cuatro (tres de versión y una previa a restaurar).
- Restaurar valida la copia, guarda antes una copia de los datos actuales para poder deshacerlo y reemplaza todas las claves con el texto exacto de la copia (las ausentes se eliminan) mediante `commitRaw`, con la misma protección de DATA-02: no reemplaza datos ilegibles y revierte si una escritura falla.
- Las copias viven en el mismo dispositivo: se pierden al borrar la app y no sustituyen exportar. "Borrar todos los datos" no las elimina.
- Al iniciar se llama a `navigator.storage.persist()` si existe, para pedir que el navegador no desaloje los datos.

Una entrada identifica sesión, ejercicio, grupo muscular y categoría, e incluye series y totales derivados. Se conservan campos antiguos como `weight`, `reps`, `completedSets` y `trackingMode` para compatibilidad. Las entradas actuales se guardan con `trackingMode: "set"`; el ajuste legado puede seguir indicando `"exercise"`, pero la UI siempre ofrece marcado por serie y ya no muestra un selector de modo.

```js
// Serie bilateral
{ weight, reps, completed }

// Serie por lado
{ sides: { left: { weight, reps, completed }, right: { weight, reps, completed } }, completed }
```

En una serie por lado, el estado agregado `completed` indica que ambos lados están completos. Los totales de peso × repeticiones y repeticiones suman solo las partes marcadas. Cuenta como hecha la parte marcada con repeticiones positivas (`countsPart`), y una pareja es una serie si cuenta al menos un lado (`countsSet`); esta regla se usa en la pantalla de ejercicio, la columna Anterior, el resumen final, Inicio, Historial y Progreso (MET-01). Una serie de cero repeticiones se guarda y se ve en el detalle, pero no cuenta. El `setCount` guardado en cada entrada conserva su significado anterior (series con algo marcado) para no reescribir datos; la interfaz no lo usa. Los registros antiguos siguen sin lado asignado.

El peso se presenta en libras, con ajuste directo de 2,5 lb y entrada decimal manual. Las repeticiones tienen control equivalente en pasos de una unidad y entrada manual de enteros de 0 a 999. `EXERCISE_IMAGES` relaciona identificadores con imágenes opcionales sin cambiar los entrenamientos guardados; actualmente solo incluye Pec Deck.

## Ciclo de la sesión

- La sesión activa contiene identificador, fechas, categorías, índice de navegación y borradores con estados `pending`, `registered` o `skipped`.
- Los cambios de valores, series, marcado y navegación se guardan inmediatamente. Si se edita un ejercicio registrado, vuelve a pendiente hasta que se vuelva a registrar.
- Se puede añadir, crear, quitar o reordenar ejercicios conservando el identificador y el cronómetro. Una sesión vacía sigue siendo recuperable.
- Registrar un ejercicio exige al menos una serie o lado marcado. Al marcar la última parte, se registra automáticamente si todas las partes tienen repeticiones positivas y se pasa al siguiente pendiente. Desde 1.8.0 no hay botón "Registrar ejercicio": salir de un ejercicio pendiente con algo marcado (cambiar de ejercicio, volver a Inicio, añadir ejercicios o finalizar) lo registra (`commitCurrentExercise`); sin nada marcado sigue pendiente. El entrenamiento permanece abierto.
- La pantalla de ejercicio (UX-02) es una lista con columnas Serie · Anterior · lb · Reps · ✓; "Anterior" muestra la misma serie y lado del último registro. Las acciones de sesión y de ejercicio (añadir, editar, por lado, copiar, eliminar serie, omitir, finalizar) están en el menú `⋯`. Los controles de deslizar y escribir no cambian; los valores vecinos solo se ven al deslizar.
- La finalización es explícita y exige resolver los ejercicios pendientes. Guarda resumen y duración y compara volumen con la sesión anterior de la misma categoría, sin comprobar que coincidan ejercicios o series.
- `clockStartedAt` conserva el inicio real del cronómetro; `startedAt` representa la fecha histórica. Cambiar la fecha modifica también las entradas asociadas y conserva la duración.

El historial combina las sesiones finalizadas y registros antiguos sin sesión finalizada (los totales que falten en sesiones con el formato antiguo se calculan de sus entradas al mostrarlas, sin reescribirlas; HIST-03; el número de series se calcula siempre así; MET-01), excluyendo la sesión activa. Los registros sin `sessionId` (historial V0) se agrupan por categoría y fecha y se muestran siempre, haya o no sesión activa (HIST-02, desde 1.7.5); Inicio, Ajustes y Progreso usan esa misma lista. La interfaz permite cambiar la fecha o eliminar un entrenamiento, pero no editar sus pesos, repeticiones ni series después de finalizarlo.

## Progreso

Los periodos de 30/90 días incluyen hoy y los 29/89 días de calendario anteriores, según la zona horaria del dispositivo. Los días activos se deduplican por fecha local. El resumen cuenta sesiones y días sin exigir repeticiones positivas; el conteo de series y las métricas por ejercicio usan partes marcadas con repeticiones mayores que cero.

Se genera una observación por sesión, ejercicio y tipo de registro: sin lado asignado, izquierdo o derecho. Conserva mejor serie por rendimiento, carga máxima, repeticiones máximas, volumen, repeticiones totales y series. El rendimiento usa Epley (`peso × (1 + repeticiones / 30)`), con el peso real para una repetición: es una estimación comparativa.

La gráfica alterna rendimiento, volumen o repeticiones; compara las dos últimas observaciones del periodo y los récords respetan ese filtro. Una sola observación no muestra tendencia. El eje vertical cubre el rango de los datos con tres marcas enteras (`chartScale`), no empieza en 0, y el rendimiento estimado se muestra en libras enteras; los cálculos conservan el valor exacto. Las fórmulas y límites se explican en un diálogo de ayuda.

## Respaldos y PWA

La exportación JSON V4 incluye entradas, sesiones finalizadas, sesión activa, ajustes y ejercicios personalizados. Se aceptan versiones V1–V4 y se normalizan sus datos. Importar valida primero el contenido completo del respaldo (entradas, series y lados, sesiones, preferencias, sesión en curso y ejercicios propios) y lanza `InvalidBackupError` sin escribir nada si una sección está dañada; cada valor preparado debe superar además la comprobación de lectura, para no dejar claves ilegibles (DATA-01). Esa validación solo se aplica a los respaldos; los datos guardados se leen como antes. Después se bloquea si alguna clave local es ilegible y restaura los datos anteriores si una escritura falla, avisando si esa restauración tampoco fue posible. Ajustes valida el archivo antes de pedir confirmación.

El manifiesto incluye iconos PNG de 192/512 px e iOS usa uno de 180 px. El service worker precarga el shell, incluidos los controles de repeticiones y la imagen Pec Deck, pidiendo cada archivo a la red con `cache: "reload"`; si uno falla, la instalación falla y sigue la versión anterior. Responde solo desde la caché de su versión (HTML incluido), así que todos los archivos de una carga pertenecen a la misma versión. Al activarse borra solo cachés `sterk-*` anteriores. Sin conexión, una navegación abre `index.html` guardado; un recurso ausente devuelve error. Su versión actual es `sterk-v1-9-3`; `npm test` comprueba que coincide con `package.json` y `APP_VERSION` y que el precaché lista exactamente los archivos de `src/`, `icons/` y `assets/exercises/`.

## Limitaciones verificadas y pendientes

Estos comportamientos **siguen presentes** y se rastrean en [roadmap.md](roadmap.md):

- Si se publica un cambio de código sin subir la versión, el teléfono sigue con la versión anterior completa: no se mezclan archivos, pero tampoco llega la actualización.
- Las pruebas automatizadas simulan almacenamiento y DOM; no sustituyen validar Safari, instalación, modo avión, reanudación, actualización y accesibilidad en un iPhone físico.

## Evolución propuesta — no implementada

```text
PWA → IndexedDB con migración segura → sincronización opcional → base remota
```

IndexedDB, backend, autenticación, sincronización y exportación CSV/XLSX siguen pendientes de decisión e implementación. La intención es conservar las reglas de dominio y la API de persistencia al sustituir `localStorage`. Las propuestas de refactorización o nuevas funcionalidades se priorizan en el roadmap antes de desarrollarlas.
