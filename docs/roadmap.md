# Sterk — pendientes y propuestas

Revisión inicial: **2026-10-08**, sobre la versión **1.7.3**. Este documento distingue problemas observados de ideas de producto. La organización documental está autorizada; las mejoras de funcionalidad siguientes siguen pendientes de una tarea que determine su alcance.

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
| DATA-02 | Alta | Propuesta | Evitar estados parciales en operaciones que actualizan varias claves, incluida la edición de fecha. Distinguir errores de lectura de datos ausentes y evitar sobrescribir datos recuperables. |
| MET-01 | Alta | Propuesta | Unificar el tratamiento de series completadas con cero repeticiones entre resumen, historial y Progreso. Definir la regla antes de ajustar los cálculos. |
| MET-02 | Media | Propuesta | Hacer que el texto de comparación corresponda a la métrica seleccionada y que la tabla de Progreso incluya los valores necesarios para interpretar las tres gráficas. |

### Evidencia y comprobaciones de aceptación

- **DATA-01:** la importación escribe varias claves antes de terminar de normalizar la sesión activa. Un respaldo V4 con `activeSession.exercises: [null]` puede fallar después de modificar otros datos. Comprobar restauración válida V1–V4, datos malformados y errores de escritura, siempre conservando el estado anterior cuando la operación no se completa.
- **DATA-02:** almacenamiento mantiene varias entidades en claves independientes. Una lectura que falla puede convertirse en un valor vacío; una escritura posterior puede reemplazar datos. La edición de fecha también necesita coherencia entre sesión y entradas si una escritura falla. Añadir comprobaciones con fallos simulados en cada punto relevante.
- **MET-01:** el control permite marcar una serie con cero repeticiones; el resumen de almacenamiento puede contarla mientras Progreso la excluye. Comprobar registros bilaterales, izquierda/derecha y sesiones antiguas con una regla consistente.
- **MET-02:** el porcentaje sigue la métrica de Progreso seleccionada mientras la etiqueta muestra rendimiento estimado. La tabla ofrece rendimiento y volumen, pero omite repeticiones totales. Comprobar las tres selecciones y su lectura accesible.

## PWA, accesibilidad y comprobaciones

| ID | Prioridad sugerida | Estado | Pendiente y resultado esperado |
| --- | --- | --- | --- |
| PWA-01 | Alta | Propuesta | Limitar la limpieza de cachés a Sterk, separar fallbacks de navegación y recursos, y comprobar el ciclo de actualización. |
| QA-01 | Alta | Propuesta | Ejecutar una revisión en iPhone físico: instalación, offline, recuperación de sesión, controles táctiles, decimales, respaldos y actualización con sesión activa. |
| A11Y-01 | Media | Propuesta | Revisar nombres accesibles de botones, foco tras renderizados y anuncios del temporizador con VoiceOver. Corregir problemas confirmados. |
| QA-02 | Media | Propuesta | Automatizar comprobaciones relevantes en CI y añadir cobertura de navegador para los flujos con mayor riesgo. |

El service worker precachea recursos, pero actualmente elimina todas las otras cachés del origen y puede devolver el HTML de inicio para un recurso no disponible. Hay que comprobar fallos de carga y actualizaciones; las pruebas de lógica existentes no certifican estos flujos en Safari.

Para QA-01, registrar dispositivo, versión de iOS, condiciones de red, pasos y resultado. La revisión de accesibilidad debe incluir el botón de volver del detalle de historial y el efecto de la actualización periódica del temporizador. No hay resultados de pruebas físicas incorporados en este análisis.

## Producto y mantenimiento

| ID | Prioridad sugerida | Estado | Propuesta y condición de éxito |
| --- | --- | --- | --- |
| UX-01 | Media | Propuesta | Repetir un entrenamiento o usar plantillas, reduciendo la selección manual sin arrastrar series como completadas. |
| HIST-01 | Media | Propuesta | Editar peso y repeticiones de entrenamientos guardados, conservando coherencia de totales y progreso. Actualmente solo se puede ajustar la fecha o eliminar datos desde ese detalle. |
| LOAD-01 | Media | Propuesta | Definir unidades y tipos de carga, incluidos ejercicios con peso corporal, para evitar interpretar todos los ejercicios como carga externa en lb. |
| MET-03 | Media | Propuesta | Comparar sesiones con criterios claros; un volumen mayor por añadir ejercicios no implica automáticamente mejor rendimiento. |
| VIS-01 | Baja | Propuesta | Ampliar ilustraciones coherentes para el catálogo. Actualmente hay 60 ejercicios y solo Pec Deck dispone de imagen. |
| TECH-01 | Baja | Propuesta | Medir el coste de leer y normalizar historiales grandes antes de optimizar almacenamiento. Reducir lecturas repetidas si se confirma impacto. |
| TECH-02 | Baja | Propuesta | Separar gradualmente responsabilidades de interfaz y ordenar CSS al trabajar en esas zonas, sin reescribir la aplicación completa. |

## Opciones futuras que requieren definir alcance

IndexedDB, sincronización, cuentas, exportación a Excel, RIR y temporizadores de descanso siguen siendo opciones futuras. No son requisitos del flujo de organización ni dependencias para corregir problemas actuales. Evaluar cada opción por el beneficio que aporte al uso real de Sterk.

## Orden de trabajo recomendado

1. Proteger respaldos y coherencia de datos: DATA-01 y DATA-02.
2. Alinear métricas y validar los flujos reales del iPhone: MET-01, MET-02, PWA-01 y QA-01.
3. Elegir la siguiente mejora de uso a partir de la experiencia real, con criterios de aceptación concretos.

Esta secuencia admite cambios por decisión del usuario. Cada tarea debe referenciar su ID y mantener actualizado el contexto o la arquitectura si modifica decisiones. El proceso para aislar e integrar trabajo está en [development-workflow.md](development-workflow.md).
