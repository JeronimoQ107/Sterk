# Instrucciones de trabajo para Sterk

Sterk es una PWA personal para registrar entrenamientos desde un iPhone con pocos toques. Usa HTML, CSS y JavaScript vanilla, con persistencia local. Mantén las soluciones acordes con esta escala; cambios de plataforma, backend o sincronización requieren que formen parte de la tarea solicitada.

## Contexto que debe sobrevivir a los chats

- [README.md](README.md): estado actual, ejecución y mapa del proyecto.
- [docs/project-context.md](docs/project-context.md): visión, alcance y decisiones confirmadas. Consúltalo al iniciar una tarea o al cambiar decisiones de producto.
- [docs/architecture.md](docs/architecture.md): módulos, datos y límites técnicos. Lee las partes relacionadas con el cambio.
- [docs/roadmap.md](docs/roadmap.md): problemas detectados y propuestas pendientes. Una propuesta documentada no autoriza su implementación.
- [docs/development-workflow.md](docs/development-workflow.md): chats, worktrees, ramas e integración.

Las instrucciones del usuario prevalecen. Actualiza los documentos afectados cuando cambie una decisión o el comportamiento; evita duplicar todo el historial de conversación y no presentes planes como funciones implementadas.

## Antes de editar

1. Comprueba la carpeta de trabajo, `git status`, la rama o HEAD separado y la base de la tarea. Identifica cambios previos del usuario y consérvalos.
2. Confirma el resultado solicitado y trabaja dentro de ese alcance. Resuelve decisiones rutinarias sin pedir confirmaciones innecesarias.
3. Usa un worktree por objetivo cuando sea útil aislar cambios. Un objetivo puede modificar varios módulos; no crees worktrees por carpeta.
4. Si hace falta una rama nueva, usa el prefijo `codex/`. Un worktree puede comenzar con HEAD separado; compruébalo antes de suponer que existe una rama.

## Implementación y datos

- Mantén separados catálogo (`data.js`), series (`sets.js`), persistencia (`storage.js`), cálculos (`progress.js`) e interfaz (`app.js` y `dashboard.js`). No reorganices carpetas sin una necesidad concreta.
- Conserva identificadores, historial, ejercicios personalizados y compatibilidad de respaldos JSON V1–V4. Las operaciones sobre datos deben preservar el estado anterior si fallan.
- El registro actual es por serie. `trackingMode` permanece en datos antiguos por compatibilidad; no lo confundas con un selector disponible en la interfaz.
- Marcar el último ejercicio no finaliza el entrenamiento. El cierre es explícito y la sesión activa debe poder recuperarse.
- Los lados izquierdo/derecho se registran independientemente; una pareja con algún lado completado cuenta como una serie. Hay una discrepancia pendiente para series completadas con cero repeticiones: consulta el roadmap antes de cambiar cálculos.
- Si cambian rutas o recursos de la aplicación, revisa imports y precaché del service worker. Cambios solo documentales no requieren incrementar la versión ni la caché.
- Evita introducir dependencias, frameworks o abstracciones grandes para cambios pequeños.

## Comprobación y cierre

```powershell
npm start
npm test
```

El servidor usa `http://127.0.0.1:8083`. Las pruebas usan almacenamiento y entorno simulados; no sustituyen pruebas táctiles, instalación, actualizaciones u operación offline en Safari de un iPhone físico.

- Ejecuta las comprobaciones pertinentes al cambio. Añade pruebas cuando aporten evidencia útil sobre un comportamiento o riesgo, sin crear pruebas que solo repitan la implementación.
- En trabajo paralelo, acuerda interfaces y evita dos tareas sobre la misma responsabilidad. Integra objetivos uno a uno y verifica su combinación, aunque Git no informe conflictos.
- Antes de integrar, revisa el diff, la base y los cambios ajenos. Respeta la autorización existente; no publiques en GitHub ni despliegues si la tarea no lo autoriza.
- Al terminar, informa qué cambió, cómo se comprobó y qué queda pendiente. Si la tarea continúa en otro chat, deja un resumen breve con objetivo, rama/commit, comprobaciones y pendientes en el documento correspondiente.
- Antes de retirar un worktree, conserva e integra el trabajo necesario. Usa el flujo de la aplicación; no borres manualmente una carpeta activa.
