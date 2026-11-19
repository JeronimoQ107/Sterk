# Principios de diseño de Sterk

> Decidido el **2026-11-19**: dirección **A · iOS nativo** con la paleta **índigo azulado sobre carbón**, que sustituye al verde lima. Aún no está implementado; la primera pantalla será la de ejercicio (UX-02). Producto: [project-context.md](project-context.md). Pendientes: [roadmap.md](roadmap.md).

Estas reglas existen para que Sterk no parezca una interfaz generada por IA y para que se use rápido en el gimnasio. Si una regla impide algo necesario, cámbiala aquí con su motivo antes de saltártela.

## Para quién y en qué momento

Sterk se usa en un iPhone, a una mano, entre series, a veces con las manos sudadas y con prisa. La pantalla de ejercicio debe entenderse de un vistazo y responder a un solo toque. Las demás pantallas se consultan con calma, pero siguen las mismas reglas.

## Dirección: iOS nativo

- Aspecto de app de Apple: fuente del sistema, título grande, barra de navegación con volver a la izquierda y un menú `⋯` a la derecha, listas agrupadas y una barra de herramientas abajo cuando haga falta.
- Sigue el modo claro u oscuro del sistema. Los dos modos se diseñan y comprueban, no se invierte uno para obtener el otro.
- La personalidad de Sterk está en el color de acento, en los números y en la claridad, no en adornos.

## Paleta

Grises carbón neutros y un índigo llevado hacia el azul (tono ≈231°). Cada color se define una vez como variable CSS en `:root` y se redefine para modo oscuro; los componentes usan solo variables.

| Variable | Uso | Claro | Oscuro |
|---|---|---|---|
| `--bg` | Fondo de la pantalla | `#F2F2F5` | `#111214` |
| `--group` | Fondo de listas agrupadas y barras | `#FFFFFF` | `#1C1D21` |
| `--field` | Campos de peso y repeticiones | `#ECECF2` | `#27292E` |
| `--separator` | Líneas entre filas | `#DCDCE3` | `#303238` |
| `--label` | Texto principal | `#111214` | `#F2F2F5` |
| `--secondary` | Texto secundario, referencia anterior | `#6B6E78` | `#8E9099` |
| `--accent` | Texto y iconos que se pueden tocar | `#3043C2` | `#9DB2FF` |
| `--accent-fill` | Botón principal, serie hecha | `#3043C2` | `#4C63E3` |
| `--on-accent` | Texto sobre `--accent-fill` | `#FFFFFF` | `#FFFFFF` |
| `--danger` | Acciones que borran datos | `#C2352B` | `#FF7A70` |

Contraste comprobado (WCAG AA): texto ≥ 4,5:1 y controles ≥ 3:1 sobre su fondo en los dos modos. Por ejemplo, `--accent-fill` oscuro: 5,0:1 con texto blanco y 3,4:1 sobre `--group`; `--secondary` claro: 4,55:1 sobre `--bg`. Si cambias un color, vuelve a medir.

- El acento marca solo lo que se puede tocar y las series hechas. Todo lo demás es gris.
- Un solo botón relleno (`--accent-fill`) por pantalla.
- Prohibido: degradados, brillos o resplandores, sombras decorativas, violeta o lavanda, y volver al verde lima.

## Tipografía

- Fuente del sistema: `-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif`. Sin fuentes web: Sterk funciona sin conexión y no carga recursos externos.
- Escala: título grande 28 px negrita · título 20 px seminegrita · texto 17 px · secundario 15 px · nota 13 px.
- Todos los números de peso, repeticiones, tiempo y totales con `font-variant-numeric: tabular-nums`, para que se alineen.
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
- Barra inferior: ejercicio anterior a la izquierda (texto en `--accent`) y siguiente a la derecha (botón relleno).
- Se conservan los controles actuales de deslizar y escribir peso y repeticiones, sin mostrar los valores vecinos.
- **Pendiente de decidir al implementar:** hoy un ejercicio se registra solo al marcar su última serie si todas tienen repeticiones, y con "Registrar ejercicio" en los demás casos. Sin ese botón, hay que definir cuándo se registra un ejercicio con series sin marcar (por ejemplo, al pasar al siguiente) sin cambiar la regla de que finalizar el entrenamiento es explícito.

## Textos

- Frases cortas y concretas. Sin textos motivacionales ni de relleno ("Hecho para entrenar a tu ritmo", "Aquí empieza").
- Un botón dice lo que hace ("Finalizar entrenamiento"); el aviso posterior confirma lo que pasó ("Entrenamiento guardado").
- Plurales correctos ("1 serie", "2 series") y un solo formato de números (`es-CO`, con separador de miles en todas partes).
- Los nombres de ejercicio del catálogo se muestran tal cual.

## Icono de la app

Hay que rehacer los iconos (`icons/`) con la nueva paleta: una "S" en `--on-accent` sobre `--accent-fill` o sobre carbón. En iPhone, quienes ya tienen Sterk instalada probablemente sigan viendo el icono anterior; nunca se les pide reinstalar para cambiarlo, porque eso borra sus datos. `theme_color` y `background_color` del manifiesto pasan a carbón (`#111214`).

## Cómo comprobar un cambio de interfaz

1. `npm start` y abrir `http://127.0.0.1:8083` a 390 px, con datos de demostración realistas (nunca datos reales).
2. Revisar en modo claro y oscuro, con capturas antes y después.
3. Comprobar que no aparece nada de la lista de prohibidos y que el contraste sigue cumpliendo AA si cambió algún color.
4. Recorrer el flujo en un iPhone antes de publicar.
