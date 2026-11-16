# Arquitectura de Sterk

> Implementación revisada: **1.7.4, 2026-11-16**. Producto y decisiones: [project-context.md](project-context.md). Pendientes: [roadmap.md](roadmap.md). Flujo de desarrollo: [development-workflow.md](development-workflow.md).

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
| `src/sets.js` | Normalización y cálculos de series bilaterales o por lado. |
| `src/progress.js` | Filtros y cálculos de actividad, rendimiento, volumen, repeticiones y récords. |
| `src/weight-control.js`, `src/reps-control.js` | Ajuste por arrastre, rueda y teclado, conservando el control durante el gesto. |
| `src/weight-picker.js`, `src/reps-picker.js` | Diálogos de entrada manual con validación. |
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

Una entrada identifica sesión, ejercicio, grupo muscular y categoría, e incluye series y totales derivados. Se conservan campos antiguos como `weight`, `reps`, `completedSets` y `trackingMode` para compatibilidad. Las entradas actuales se guardan con `trackingMode: "set"`; el ajuste legado puede seguir indicando `"exercise"`, pero la UI siempre ofrece marcado por serie y ya no muestra un selector de modo.

```js
// Serie bilateral
{ weight, reps, completed }

// Serie por lado
{ sides: { left: { weight, reps, completed }, right: { weight, reps, completed } }, completed }
```

En una serie por lado, el estado agregado `completed` indica que ambos lados están completos. Los totales de peso × repeticiones y repeticiones suman solo las partes marcadas. El conteo de `storage` considera una pareja como una serie si al menos un lado está marcado; no exige repeticiones positivas. Los registros antiguos siguen sin lado asignado.

El peso se presenta en libras, con ajuste directo de 2,5 lb y entrada decimal manual. Las repeticiones tienen control equivalente en pasos de una unidad y entrada manual de enteros de 0 a 999. `EXERCISE_IMAGES` relaciona identificadores con imágenes opcionales sin cambiar los entrenamientos guardados; actualmente solo incluye Pec Deck.

## Ciclo de la sesión

- La sesión activa contiene identificador, fechas, categorías, índice de navegación y borradores con estados `pending`, `registered` o `skipped`.
- Los cambios de valores, series, marcado y navegación se guardan inmediatamente. Si se edita un ejercicio registrado, vuelve a pendiente para exigir actualizar su entrada.
- Se puede añadir, crear, quitar o reordenar ejercicios conservando el identificador y el cronómetro. Una sesión vacía sigue siendo recuperable.
- Registrar un ejercicio exige al menos una serie o lado marcado. Al marcar la última parte, se registra automáticamente si todas las partes tienen repeticiones positivas; el entrenamiento permanece abierto.
- La finalización es explícita y exige resolver los ejercicios pendientes. Guarda resumen y duración y compara volumen con la sesión anterior de la misma categoría, sin comprobar que coincidan ejercicios o series.
- `clockStartedAt` conserva el inicio real del cronómetro; `startedAt` representa la fecha histórica. Cambiar la fecha modifica también las entradas asociadas y conserva la duración.

El historial combina las sesiones finalizadas y registros antiguos sin sesión finalizada, excluyendo la sesión activa. La interfaz permite cambiar la fecha o eliminar un entrenamiento, pero no editar sus pesos, repeticiones ni series después de finalizarlo.

## Progreso

Los periodos de 30/90 días incluyen hoy y los 29/89 días de calendario anteriores, según la zona horaria del dispositivo. Los días activos se deduplican por fecha local. El resumen cuenta sesiones y días sin exigir repeticiones positivas; el conteo de series y las métricas por ejercicio usan partes marcadas con repeticiones mayores que cero.

Se genera una observación por sesión, ejercicio y tipo de registro: sin lado asignado, izquierdo o derecho. Conserva mejor serie por rendimiento, carga máxima, repeticiones máximas, volumen, repeticiones totales y series. El rendimiento usa Epley (`peso × (1 + repeticiones / 30)`), con el peso real para una repetición: es una estimación comparativa.

La gráfica alterna rendimiento, volumen o repeticiones; compara las dos últimas observaciones del periodo y los récords respetan ese filtro. Una sola observación no muestra tendencia. Las fórmulas y límites se explican en un diálogo de ayuda.

## Respaldos y PWA

La exportación JSON V4 incluye entradas, sesiones finalizadas, sesión activa, ajustes y ejercicios personalizados. Se aceptan versiones V1–V4 y se normalizan sus datos. Importar prepara todos los valores, se bloquea si alguna clave local es ilegible y restaura los datos anteriores si una escritura falla; la validación aún no verifica todo el contenido del respaldo (DATA-01).

El manifiesto incluye iconos PNG de 192/512 px e iOS usa uno de 180 px. El service worker precarga el shell, incluidos los controles de repeticiones y la imagen Pec Deck; elimina cachés anteriores al activarse. Su versión actual es `sterk-v1-7-4`. Cambiar recursos del shell requiere revisar la lista y la versión de caché.

## Limitaciones verificadas y pendientes

Estos comportamientos **siguen presentes** y se rastrean en [roadmap.md](roadmap.md):

- Una serie marcada con cero repeticiones puede contar en el historial/resumen de `storage` y quedar excluida de Progreso.
- En Progreso, el porcentaje comparativo sigue la métrica seleccionada, mientras la tarjeta mantiene el título y valor de “Rendimiento estimado”.
- Un respaldo con contenido mal formado puede importarse sin validación completa (DATA-01). Las escrituras de varias claves ya se revierten si una falla.
- Cuando falla una petición GET, el service worker devuelve `index.html` como fallback incluso para recursos que requieren otro tipo de contenido, como JavaScript.
- Las pruebas automatizadas simulan almacenamiento y DOM; no sustituyen validar Safari, instalación, modo avión, reanudación, actualización y accesibilidad en un iPhone físico.

## Evolución propuesta — no implementada

```text
PWA → IndexedDB con migración segura → sincronización opcional → base remota
```

IndexedDB, backend, autenticación, sincronización y exportación CSV/XLSX siguen pendientes de decisión e implementación. La intención es conservar las reglas de dominio y la API de persistencia al sustituir `localStorage`. Las propuestas de refactorización o nuevas funcionalidades se priorizan en el roadmap antes de desarrollarlas.
