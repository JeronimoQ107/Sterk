@AGENTS.md

## Claude Code

Las instrucciones comunes de Sterk están en `AGENTS.md`, importado arriba; este archivo solo añade lo propio de Claude Code. Las reglas que deban seguir todas las herramientas van en `AGENTS.md`, no aquí.

- `docs/development-workflow.md` describe la interfaz de Codex. En Claude Code se sigue el mismo flujo: una sesión por objetivo, un worktree solo cuando haga falta aislar trabajo y las mismas comprobaciones de carpeta, Git y base antes de editar.
- Antes de tocar `src/storage.js`, `src/sets.js`, respaldos o `service-worker.js`, relee "Datos de quienes prueban la app" en `AGENTS.md`. Esas reglas tienen prioridad sobre cualquier mejora.
- Para revisar la interfaz, ejecuta `npm start` y abre `http://127.0.0.1:8083` con un ancho de iPhone (unos 390 px). Recorre el flujo afectado además de ejecutar `npm test`.
- Para elegir la siguiente tarea, parte de "Orden de trabajo recomendado" en `docs/roadmap.md` y cita su ID en commits y resúmenes.
