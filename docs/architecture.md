# Arquitectura de Gym Tracker

## Arquitectura actual — V0

```text
PWA
 ↓
localStorage
```

La aplicación es estática y funciona enteramente en el dispositivo. `src/app.js` controla el estado temporal y la interfaz, `src/data.js` contiene la configuración editable de rutinas y `src/storage.js` encapsula la persistencia.

La UI solo utiliza los métodos públicos de `storage` (`getExerciseHistory`, `getLastExerciseEntry` y `saveWorkoutEntry`). Sustituir `localStorage` por una API no debería requerir reescribir las pantallas.

## Modelo de registro

Cada ejercicio genera una entrada independiente con:

- identificador
- fecha y hora ISO, además de valores locales legibles
- identificador y nombre de rutina
- ejercicio
- peso
- arreglo de repeticiones individuales
- número de series
- volumen total (`peso × suma de repeticiones`)

Las series se almacenan individualmente en el arreglo `reps`. Esto permite evolucionar hacia un registro por serie sin perder compatibilidad conceptual.

## Decisión temporal de UX

La V0 utiliza el **modo A**: todas las series se editan y registran juntas al finalizar el ejercicio. Es una decisión temporal para validar el flujo base con la menor complejidad posible.

Continúa pendiente probar el **modo B**: registrar cada serie al finalizarla y, potencialmente, iniciar un temporizador de descanso. La estructura de datos no presupone que todas las series deban guardarse simultáneamente.

## PWA y uso sin conexión

El manifiesto permite instalación en modo standalone. El service worker guarda el shell de la aplicación y aplica una estrategia cache-first con actualización desde red para recursos aún no almacenados. La información del usuario no forma parte del caché: permanece en `localStorage`.

El icono provisional es SVG. Antes de distribución real en iOS debe exportarse también como PNG de 180 × 180 px para máxima compatibilidad con `apple-touch-icon`.

## Arquitectura futura — no implementada

```text
PWA
 ↓
API
 ↓
Cloudflare Worker
 ↓
Microsoft Graph
 ↓
Excel en OneDrive
```

Cloudflare, Microsoft Graph, Excel, autenticación y cualquier backend están deliberadamente fuera de la V0.
