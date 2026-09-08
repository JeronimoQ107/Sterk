# Arquitectura de Sterk

## V1.3 actual

```text
PWA Sterk
    ↓
capa storage
    ↓
localStorage
```

- `src/data.js`: ejercicios predeterminados, grupos musculares, categorías y compatibilidad con rutinas antiguas.
- `src/app.js`: estado de interfaz, navegación y sesión.
- `src/storage.js`: entradas, sesiones, ajustes y respaldos.
- `src/sets.js`: normalización, copia y cálculo de series bilaterales y por lado.
- `src/weight-picker.js`: diálogo de peso, rueda vertical y entrada manual.
- `service-worker.js`: shell offline y actualización de recursos.

La UI consume métodos públicos de `storage`; no accede directamente a claves de `localStorage`.

## Datos

Una entrada contiene identificadores de sesión, entrada y ejercicio, grupo muscular, categoría, series con peso y repeticiones independientes, volumen y modo de registro.

Una serie bilateral conserva `{ weight, reps, completed }`. Una serie unilateral contiene `{ sides: { left, right }, completed }`, donde cada lado tiene sus propios valores y estado. El estado agregado indica que ambos lados están completos. El volumen y las repeticiones suman únicamente las partes completadas; una pareja cuenta una sola vez como serie si al menos un lado está completado.

El formato de respaldo pasa a V4. Se siguen aceptando V1–V3 y no se atribuye un lado a registros antiguos. Las claves de almacenamiento permanecen iguales. Las referencias anteriores excluyen los registros de la sesión activa.

La sesión activa guarda cada borrador y su estado (`pending`, `registered` o `skipped`). Cualquier cambio de peso, reps, series, navegación o marcado se persiste inmediatamente, permitiendo recuperar el entrenamiento tras una interrupción.

Las sesiones se construyen seleccionando ejercicios del catálogo. La categoría prevista y final se deriva de sus etiquetas Push, Pull y Legs. Las sesiones finalizadas almacenan su resumen para comparar volumen con la sesión anterior de la misma categoría.

Durante una sesión se pueden añadir ejercicios con el constructor, crear ejercicios personalizados y reordenar o quitar los existentes con un diálogo. Se mantienen el identificador de sesión y la hora inicial. La sesión puede quedar vacía y continuar siendo recuperable. Registrar u omitir el último pendiente ya no finaliza automáticamente. La finalización es explícita y exige resolver los ejercicios pendientes; las modificaciones a un ejercicio registrado lo devuelven al estado pendiente para evitar cerrar con un registro desactualizado.

## Modos de registro

- **Por ejercicio:** editar y guardar todas las series juntas.
- **Por serie:** marcar series terminadas individualmente y guardar el ejercicio al finalizar.

La sesión registra automáticamente el tiempo transcurrido entre su inicio y finalización.

## PWA

El manifiesto incluye iconos PNG de 192 y 512 px. iOS utiliza un icono PNG de 180 px. El service worker almacena el shell y elimina cachés anteriores al activarse.

## Arquitectura futura — no implementada

```text
PWA Sterk → IndexedDB → sincronización opcional → base de datos remota
                                      ↓
                              exportación CSV/XLSX
```

La V1.3 continúa con `localStorage`, sin backend, autenticación, IndexedDB ni bases de datos externas.
