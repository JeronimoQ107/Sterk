# Arquitectura de Sterk

## V1 actual

```text
PWA Sterk
    ↓
capa storage
    ↓
localStorage
```

- `src/data.js`: rutinas y valores predeterminados.
- `src/app.js`: estado de interfaz, navegación y sesión.
- `src/storage.js`: entradas, sesiones, ajustes y respaldos.
- `service-worker.js`: shell offline y actualización de recursos.

La UI consume métodos públicos de `storage`; no accede directamente a claves de `localStorage`.

## Datos

Una entrada de ejercicio contiene identificadores de sesión y entrada, fecha, rutina, ejercicio, series con peso y repeticiones independientes, volumen y modo de registro.

La sesión activa guarda cada borrador y su estado (`pending`, `registered` o `skipped`). Cualquier cambio de peso, reps, series, navegación o marcado se persiste inmediatamente, permitiendo recuperar el entrenamiento tras una interrupción.

Las sesiones finalizadas almacenan su resumen para comparar volumen con la sesión anterior de la misma rutina.

## Modos de registro

- **Por ejercicio:** editar y guardar todas las series juntas.
- **Por serie:** marcar series terminadas individualmente y guardar el ejercicio al finalizar.

La sesión registra automáticamente el tiempo transcurrido entre su inicio y finalización.

## PWA

El manifiesto incluye iconos PNG de 192 y 512 px. iOS utiliza un icono PNG de 180 px. El service worker almacena el shell y elimina cachés anteriores al activarse.

## Arquitectura futura — no implementada

```text
PWA Sterk
 ↓
API
 ↓
Cloudflare Worker
 ↓
Microsoft Graph
 ↓
Excel en OneDrive
```

La V1 continúa sin backend, autenticación, Cloudflare, Microsoft Graph, Excel ni bases de datos externas.
