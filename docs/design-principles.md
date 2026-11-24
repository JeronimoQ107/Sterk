# Principios de diseño de Sterk

> Decidido el **2026-11-19**: dirección **A · iOS nativo** con una paleta azul sobre carbón que sustituye al verde lima. El azul es **cobalto** desde 1.8.1 (en 1.8.0 era un índigo azulado; se cambió tras comparar cinco azules más eléctricos). El **2026-11-24** (UI-03, 1.11.0) se añadieron fuente propia, iconos Phosphor, barras flotantes y movimiento, sin cambiar la paleta. Desde 1.8.0 la paleta se aplica a toda la app y la pantalla de ejercicio (UX-02) sigue estas reglas; desde 1.9.0 también el resto de pantallas y el icono (UI-02). Producto: [project-context.md](project-context.md). Pendientes: [roadmap.md](roadmap.md).

Estas reglas existen para que Sterk no parezca una interfaz generada por IA y para que se use rápido en el gimnasio. Si una regla impide algo necesario, cámbiala aquí con su motivo antes de saltártela.

## Para quién y en qué momento

Sterk se usa en un iPhone, a una mano, entre series, a veces con las manos sudadas y con prisa. La pantalla de ejercicio debe entenderse de un vistazo y responder a un solo toque. Las demás pantallas se consultan con calma, pero siguen las mismas reglas.

## Dirección: iOS nativo

- Aspecto de app de Apple: título grande, navegación con volver a la izquierda y un menú `⋯` a la derecha, listas agrupadas y barras flotantes abajo.
- Sigue el modo claro u oscuro del sistema. Los dos modos se diseñan y comprueban, no se invierte uno para obtener el otro.
- La personalidad de Sterk está en el color de acento, en los títulos y números con Archivo, en cómo responde al toque y en la claridad, no en adornos.

## Paleta

Grises carbón neutros y un azul cobalto puro y fuerte (tono ≈222°), sin matiz violeta. Cada color se define una vez como variable CSS en `:root` y se redefine para modo oscuro; los componentes usan solo variables.

| Variable | Uso | Claro | Oscuro |
|---|---|---|---|
| `--bg` | Fondo de la pantalla | `#F2F2F5` | `#111214` |
| `--group` | Fondo de listas agrupadas y barras | `#FFFFFF` | `#1C1D21` |
| `--field` | Campos de peso y repeticiones | `#ECECF2` | `#27292E` |
| `--separator` | Líneas entre filas | `#DCDCE3` | `#303238` |
| `--label` | Texto principal | `#111214` | `#F2F2F5` |
| `--secondary` | Texto secundario, referencia anterior | `#6B6E78` | `#8E9099` |
| `--accent` | Texto y iconos que se pueden tocar | `#1A56DB` | `#82AAFF` |
| `--accent-fill` | Botón principal, serie hecha | `#1A56DB` | `#2F6BFF` |
| `--on-accent` | Texto sobre `--accent-fill` | `#FFFFFF` | `#FFFFFF` |
| `--danger` | Acciones que borran datos | `#C2352B` | `#FF7A70` |

Contraste comprobado (WCAG AA): texto ≥ 4,5:1 y controles ≥ 3:1 sobre su fondo en los dos modos. Por ejemplo, `--accent` claro: 6,2:1 sobre blanco y 5,3:1 sobre `--field`; `--accent` oscuro: 7,3:1 sobre `--group`; `--accent-fill` oscuro: 3,7:1 sobre `--group` y 4,5:1 con texto blanco, justo en el límite, así que no se aclara más sin pasar el texto del botón a oscuro; `--secondary` claro: 4,55:1 sobre `--bg`. Si cambias un color, vuelve a medir.

- El acento marca solo lo que se puede tocar y las series hechas. Todo lo demás es gris.
- Un solo botón relleno (`--accent-fill`) por pantalla.
- Prohibido: degradados, brillos o resplandores, sombras decorativas, violeta o lavanda, y volver al verde lima. La única sombra permitida es la de las barras flotantes, que separa dos capas.

## Tipografía

- **Archivo** (`--display`) en títulos (ancho 118 %) y números (ancho 106 %); el texto corrido, con la fuente del sistema (`--system`). La fuente se sirve desde `assets/fonts/` y va en el precaché: Sterk funciona sin conexión y no carga recursos externos.
- Escala, con variables `--size-*`: cifra principal 46 px · título 32 px · título de ejercicio 28 px · sección 20 px · texto 17 px · secundario 15 px · nota 13 px. Un tamaño nuevo necesita motivo.
- Todos los números de peso, repeticiones, tiempo y totales con la clase `num` o `tabular-nums`, para que se alineen.
- Radios: 8 px en campos, 12 px en listas y botones, 22 px en hojas y completo en barras, filtros y píldoras (`--radius-*`).
- Nada en mayúsculas: ni etiquetas sobre los títulos ni botones.

## Disposición

- Márgenes laterales de 16 px y respeto de las zonas seguras del iPhone (`env(safe-area-inset-*)`).
- Filas relacionadas van en una lista agrupada (radio 12 px, separadores finos). Una tarjeta solo para un objeto que está solo, como la sesión en curso en Inicio. Nunca tarjetas dentro de tarjetas.
- Objetivos táctiles de 44 × 44 px como mínimo.
- Lo que más se usa va arriba y a mano; las acciones de sesión van en el menú `⋯`.
- Las acciones que borran datos van en un menú o al final de la pantalla, en `--danger`, y siempre se confirman.

## Pantalla de ejercicio (UX-02)

Es la referencia del resto de la app. Maqueta aprobada en la revisión del 2026-11-19.

- Barra superior: `‹ Push` (volver), `2 de 4 · 1:38:27` en el centro y `⋯` con Añadir ejercicio, Editar entrenamiento, Registrar por lado y Finalizar.
- Debajo, un segmento por ejercicio: hecho, actual o pendiente. Sustituye a las pestañas numeradas y a Anterior/Siguiente duplicados.
- Título grande con el ejercicio y, debajo, grupo muscular y series hechas ("Pecho · 2 de 3 series").
- Una lista agrupada con columnas **Serie · Anterior · lb · Reps · ✓**. "Anterior" muestra el resultado de esa misma serie la última vez (`60 × 8`).
- Las series hechas muestran el marcador relleno en `--accent-fill`; sus campos pierden el fondo.
- Última fila de la lista: "Añadir serie" en `--accent`.
- Por lado: cada serie se divide en dos filas, I y D, con un marcador cada una. Sin casilla de "ambos".
- Abajo, dos píldoras flotantes: ejercicio anterior a la izquierda (translúcida) y siguiente a la derecha (rellena).
- Al deslizar peso o repeticiones el campo se abre y muestra el valor anterior y el siguiente; en reposo no se ven.
- Si el ejercicio tiene animación, bajo el título hay una fila «Ver técnica» en `--accent` (decidido el 2026-11-20). Está plegada por defecto para no empujar las series; al abrirla muestra la animación sobre `--surface` y una nota breve sobre el color. Con movimiento reducido no se reproduce sola.
- Sin botón "Registrar ejercicio" (decidido el 2026-11-19): al marcar la última serie con repeticiones se registra y pasa al siguiente pendiente; al salir del ejercicio por cualquier vía con alguna serie o lado marcado, se registra lo marcado; sin nada marcado queda pendiente. Finalizar sigue siendo una acción explícita y se bloquea mientras haya ejercicios pendientes sin nada marcado.

## Iconos, barras y hojas (UI-03)

- Iconos de Phosphor (`src/icons.js`), de trazo; rellenos solo en la pestaña activa. Siempre acompañados de texto, salvo en la barra de pestañas y en botones de uso conocido (volver, cerrar, `⋯`), que llevan nombre accesible.
- Barra de pestañas flotante solo con iconos, redondeada y translúcida, en una capa sobre el contenido. Las pantallas dejan sitio al final para que no tape la última fila.
- Acciones al pie (anterior y siguiente, selección del constructor): `ui-dock`, con el mismo estilo flotante.
- Menús, selectores y confirmaciones: hoja inferior (`showSheet`, `ask`, `notice`). Nada de `alert()` ni `confirm()`. El botón dice la acción («Eliminar»), y las que borran datos van en `--danger`.

## Movimiento (UI-03)

- El movimiento explica qué cambió: de dónde viene una pantalla, qué fila se añadió, qué número subió. No decora.
- Entre 150 y 560 ms; solo el resumen final y la gráfica al entrar duran más (cerca de 1 s). Curvas `--soft` (sin rebote) y `--spring` (rebote leve, en marcas y botones).
- Nada retrasa el toque ni el guardado: los datos se guardan antes de animar y los toques pasan a la pantalla nueva durante el cambio.
- Con «Reducir movimiento» de iOS quedan solo cambios instantáneos o fundidos breves. Sin soporte del navegador, la app funciona igual sin animación.
- Sin librerías: CSS, Web Animations y View Transitions (`src/motion.js`).

## Textos

- Frases cortas y concretas. Sin textos motivacionales ni de relleno ("Hecho para entrenar a tu ritmo", "Aquí empieza").
- Un botón dice lo que hace ("Finalizar entrenamiento"); el aviso posterior confirma lo que pasó ("Entrenamiento guardado").
- Plurales correctos ("1 serie", "2 series") y un solo formato de números (`es-CO`, con separador de miles en todas partes).
- Los nombres de ejercicio del catálogo se muestran tal cual.

## Icono de la app

Desde 1.9.0 los iconos de la app (`icons/`) son la mancuerna de siempre en blanco sobre cobalto `#1A56DB` (6,2:1). Los PNG son cuadrados completos, sin esquinas redondeadas, porque iOS aplica su propia máscara; `icon.svg` (favicon) sí las lleva. En iPhone, quienes ya tienen Sterk instalada probablemente sigan viendo el icono anterior; nunca se les pide reinstalar para cambiarlo, porque eso borra sus datos. `theme_color` y `background_color` del manifiesto pasan a carbón (`#111214`).

## Componentes compartidos (desde 1.9.0)

Las pantallas se construyen con las clases `ui-*` de `src/styles.css`: `ui-title` (título grande y subtítulo), `ui-nav` y `ui-back` (volver), `ui-group-header`, `ui-group`, `ui-row` y `ui-group-footer` (listas agrupadas), `ui-button` (único botón relleno), `ui-button-plain`, `ui-pill`, `ui-search`, `ui-segmented` (con indicador deslizante), `ui-metrics`, `ui-check` (marca de hecho), `ui-dock` (barra flotante), `ui-fold` (contenido plegable) y `ui-sheet` (hoja). Una pantalla nueva debería poder hacerse solo con ellas.

## Cómo comprobar un cambio de interfaz

1. `npm start` y abrir `http://127.0.0.1:8083` a 390 px, con datos de demostración realistas (nunca datos reales).
2. Revisar en modo claro y oscuro, con capturas antes y después.
3. Comprobar que no aparece nada de la lista de prohibidos y que el contraste sigue cumpliendo AA si cambió algún color.
4. Recorrer el flujo en un iPhone antes de publicar.
