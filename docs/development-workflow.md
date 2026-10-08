# Flujo de trabajo de Sterk en Codex

## La referencia común

La memoria compartida del proyecto vive en Git: [AGENTS.md](../AGENTS.md), [contexto](project-context.md), [arquitectura](architecture.md) y [roadmap](roadmap.md). Un chat nuevo puede leerlos sin depender de una conversación anterior. Los documentos se actualizan cuando cambian decisiones o comportamiento.

`main` es la rama de referencia para los cambios integrados. El checkout principal contiene esa rama. Un worktree es otra carpeta con una copia del proyecto para trabajar de forma aislada. Su nombre no tiene que ser `main` y no determina qué rama tiene seleccionada.

Un worktree tiene una rama seleccionada o HEAD separado en un momento dado. Puede contener varios commits de un objetivo. El mismo objetivo puede afectar catálogo, interfaz, persistencia y pruebas; no se crea un worktree por cada carpeta. Para tareas pequeñas o consecutivas, trabajar en el checkout local puede ser suficiente.

## Paso a paso para una mejora

1. **Definir el resultado.** Elegir un pendiente del roadmap o describir el objetivo y los criterios de aceptación. No mezclar mejoras independientes en el mismo encargo.
2. **Comprobar la base.** Revisar cambios pendientes y la rama `main`. Si interesa incorporar cambios de GitHub, comprobar también el remoto; `main` local y `origin/main` pueden diferir.
3. **Abrir el chat.** Seleccionar Sterk y marcar **Worktree** cuando haga falta aislamiento. La casilla puede ser la única opción visible; no hace falta encontrar un selector de ramas.
4. **Inspeccionar el entorno antes de editar.** Pedir a Codex que confirme carpeta, estado de Git, rama o HEAD separado y commit de partida. Para este flujo, la nueva tarea debe partir del `main` que contiene los cambios ya integrados. Si la base es distinta, ajustarla preservando trabajo previo.
5. **Implementar y comprobar.** Mantener el trabajo de ese objetivo en el mismo chat y worktree. Actualizar los documentos afectados y registrar comprobaciones y límites relevantes.
6. **Conservar el resultado.** Revisar el diff y crear commits. Si el worktree está en HEAD separado y se necesita una rama para conservar o publicar el objetivo, crear una como `codex/mejora-respaldos`; no crear otra rama si ya existe una adecuada.
7. **Integrar en `main`.** Cuando la tarea incluya integrar, incorporar los cambios revisados, resolver conflictos y comprobar la aplicación resultante. Si el encargo solo pide preparación, dejar los commits y un resumen listos para esa integración.
8. **Publicar cuando corresponda.** `push` envía ramas y commits a GitHub; una PR permite revisar e integrar en el remoto. El despliegue depende de la configuración real del proyecto y puede activarse al publicar en una rama determinada.
9. **Retirar el worktree.** Una vez preservado el trabajo necesario, usar las opciones de archivo y gestión de worktrees de Codex. Conservar aparte cualquier archivo ignorado necesario antes de retirar la copia.

Crear una rama local no la publica en GitHub. Integrar en `main` local tampoco actualiza automáticamente GitHub. El flujo habitual termina publicando `main` tras integrar mejoras comprobadas, según la configuración de despliegue; no necesita desplegar cada rama de trabajo.

## Encargo útil para un chat nuevo

```text
Lee AGENTS.md y los documentos relevantes para este objetivo.
Objetivo: [ID del roadmap o descripción concreta].
Resultado esperado: [comportamiento y criterios de aceptación].
Antes de editar, comprueba la carpeta, Git, la rama o HEAD separado
y que la base contiene el main actual. Conserva cambios existentes.
Implementa el objetivo, realiza las comprobaciones pertinentes y
actualiza la documentación afectada. Deja commits y un resumen para
integrarlo; no publiques ni despliegues en este encargo.
```

Si el usuario quiere que la tarea también integre o publique, debe incluirlo en su encargo; no necesita volver a aprobarlo en cada paso ya autorizado.

## Dos objetivos en paralelo

Cada objetivo puede usar su propio chat y worktree. Las copias aíslan modificaciones aunque ambos objetivos toquen una misma carpeta. Eso no garantiza que sus resultados sean compatibles.

- Dos tareas sobre archivos diferentes de una carpeta pueden avanzar en paralelo si no cambian el mismo contrato o comportamiento.
- Si ambas cambian las mismas funciones, datos o reglas, conviene hacerlas consecutivamente o acordar primero una interfaz estable.
- Integrar la primera tarea, actualizar la base de la segunda y volver a comprobar la combinación. Git puede detectar conflictos de texto; las comprobaciones también deben detectar conflictos de comportamiento.

Mantener pocos objetivos activos facilita revisar e integrar sin acumular diferencias con `main`.

## Qué opción de bifurcación usar

| Opción de la aplicación | Contexto de conversación | Archivos | Uso habitual |
| --- | --- | --- | --- |
| Bifurcar el chat en el mismo worktree | Hereda la conversación hasta la bifurcación | Comparte la misma carpeta | Continuar con otro enfoque; coordinar las ediciones para no pisarse. |
| Bifurcar el chat en un nuevo worktree | Hereda la conversación hasta la bifurcación | Usa otra copia | Explorar una alternativa o aislar un objetivo relacionado; comprobar su base y estado antes de editar. |
| Nuevo chat en este worktree | Empieza una conversación nueva | Comparte la misma carpeta | Continuar sobre esos archivos leyendo el contexto versionado. |

Los mensajes posteriores de las conversaciones bifurcadas no se sincronizan. Para mejoras independientes suele bastar un chat nuevo que lea los documentos. Una bifurcación aporta valor cuando se necesita conservar el razonamiento de la conversación actual.

## Retirar un worktree creado por accidente

Primero comprobar que sus commits están integrados en `main` o conservados en una rama y que no queda trabajo necesario sin guardar. Después se puede archivar el chat y gestionar su worktree desde Codex. La retirada depende de si el worktree está compartido o protegido por otros chats; archivar no siempre elimina inmediatamente la carpeta.

Usar el mecanismo gestionado por la aplicación, que permite conservar una instantánea recuperable cuando corresponde. No borrar la carpeta activa manualmente. Los archivos ignorados que sea necesario mantener se preservan por separado.

Para tener un chat de referencia en el checkout principal, abrir un chat nuevo de Sterk con **Worktree desmarcado**, en el entorno local, y pedir que lea `AGENTS.md`. No es necesario conservar indefinidamente el chat donde se crearon estos documentos.

## Referencias de Codex

- [Instrucciones de proyecto con AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md)
- [Worktrees y su gestión](https://learn.chatgpt.com/docs/environments/git-worktrees)
- [Proyectos en la aplicación](https://learn.chatgpt.com/docs/projects?surface=app)
