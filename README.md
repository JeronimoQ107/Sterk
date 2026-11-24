# Sterk

PWA personal para registrar entrenamientos desde un iPhone con pocos toques. Versión actual: **1.10.0**. HTML, CSS y JavaScript vanilla, con datos locales en el navegador.

## Ejecutar y comprobar

Con Node.js instalado, sin instalar dependencias:

```powershell
npm start
npm test
```

Abre `http://127.0.0.1:8083`. Las pruebas usan almacenamiento y entorno simulados; no modifican los datos del navegador ni sustituyen la revisión en un iPhone físico. Para instalar la PWA en iPhone, abrir una publicación HTTPS y usar **Safari → Compartir → Añadir a pantalla de inicio**.

## Funciones actuales

- Inicio con acceso al último entrenamiento y resumen reciente.
- Catálogo de 60 ejercicios, grupos desplegables, tarjetas en dos columnas y búsqueda por nombres y alias en español e inglés.
- Selección y orden libre; añadir, crear, quitar o reordenar ejercicios durante una sesión.
- Registro por serie con peso, repeticiones y marcado de completado. No hay selector de modo de registro en Ajustes.
- Registro opcional por lado, con valores y marcado independientes para izquierda/derecha.
- Controles táctiles de peso y repeticiones, entrada manual y referencia al entrenamiento anterior.
- Navegación entre ejercicios, omisión y recuperación de una sesión activa.
- Duración automática y finalización explícita del entrenamiento. Registrar el último ejercicio deja abierta la sesión.
- Historial por entrenamiento, detalle de series y edición de fecha durante el registro o desde el historial.
- Progreso por 30 días, 90 días o todo el historial; análisis bilateral o por lado; gráficas de rendimiento estimado, volumen y repeticiones.
- Biblioteca de ejercicios personalizados, archivo de ejercicios y borrado de datos con confirmación.
- Respaldo JSON V4, importación compatible con V1–V4 y migración del historial de V0.
- Manifest, iconos y service worker con precaché de recursos para la PWA.

Pec Deck, Barbell Squat y Bench Press tienen ilustración; los demás muestran iniciales. Barbell Squat y Bench Press también tienen animación de la técnica en la pantalla del ejercicio («Ver técnica», plegada por defecto). El detalle del historial permite ajustar la fecha y eliminar datos, pero aún no editar peso y repeticiones guardados.

## Estructura actual

```text
index.html                 Entrada y metadatos PWA
manifest.json              Instalación de Sterk
service-worker.js          Caché de recursos
assets/exercises/          Ilustraciones del catálogo y animaciones de la técnica
icons/                     Iconos de la aplicación
src/data.js                Catálogo, grupos y categorías
src/storage.js             Persistencia, migraciones y respaldos
src/snapshots.js           Copias automáticas antes de cada versión (IndexedDB)
src/version.js             Versión de la app
src/sets.js                Series, lados y totales
src/progress.js            Cálculos de progreso
src/dashboard.js           Inicio, Ajustes y Progreso
src/app.js                 Sesión, historial e interacciones
src/weight-control.js      Control táctil de peso
src/weight-picker.js       Entrada manual de peso
src/reps-control.js        Control táctil de repeticiones
src/reps-picker.js         Entrada manual de repeticiones
src/icons.js               Iconos SVG de la interfaz
src/styles.css             Diseño para móvil
tests/                     Pruebas automatizadas
scripts/serve.cjs          Servidor local
AGENTS.md                  Instrucciones comunes para agentes (Codex y Claude Code)
CLAUDE.md                  Importa AGENTS.md y añade notas de Claude Code
docs/                      Contexto, arquitectura y trabajo pendiente
```

## Contexto y flujo de desarrollo

| Documento | Para qué sirve |
| --- | --- |
| [AGENTS.md](AGENTS.md) | Instrucciones comunes para los chats y agentes que trabajen en el proyecto. |
| [CLAUDE.md](CLAUDE.md) | Punto de entrada de Claude Code: importa `AGENTS.md` y añade lo específico de esa herramienta. |
| [Contexto](docs/project-context.md) | Visión, alcance y decisiones confirmadas. |
| [Arquitectura](docs/architecture.md) | Módulos, datos, comportamiento y límites técnicos. |
| [Roadmap](docs/roadmap.md) | Problemas detectados y propuestas, con estado y criterios de aceptación. |
| [Flujo de trabajo](docs/development-workflow.md) | Cómo usar chats, worktrees, ramas e integración sin perder el contexto. |
| [Diseño](docs/design-principles.md) | Dirección visual, paleta, tipografía y reglas de interfaz. |

El proyecto mantiene su estructura actual. Usa worktrees por objetivos cuando haga falta aislamiento y conserva decisiones en documentos versionados para que los siguientes chats puedan recuperarlas.

## Límites y próximos pasos

Los datos dependen del navegador y dispositivo actuales; no hay cuentas, sincronización ni recuperación remota. El rendimiento calculado es una estimación comparativa. IndexedDB, Excel, RIR y temporizadores de descanso son opciones futuras, con alcance por definir.

Antes de ampliar funciones, se recomienda mejorar la seguridad de las restauraciones, unificar algunas métricas y comprobar instalación, actualizaciones, accesibilidad y uso offline en Safari. Las incidencias y sus comprobaciones están en el [roadmap](docs/roadmap.md); documentarlas no significa que ya estén corregidas.
