# Sterk

PWA personal y mobile-first para registrar entrenamientos desde un iPhone con pocos toques.

## Ejecutar localmente

Sirve la carpeta por HTTP para habilitar módulos y service worker:

```powershell
python -m http.server 8080
```

Abre `http://localhost:8080`. En iPhone, una publicación HTTPS permitirá instalar Sterk mediante **Safari → Compartir → Añadir a pantalla de inicio**.

## Funcionalidades V1.2

- constructor de sesiones con selección y orden libre de ejercicios
- catálogo filtrable por grupo muscular
- clasificación automática Push, Pull, Legs, combinada o Full Body
- creación y archivo de ejercicios personalizados
- modos de registro por ejercicio y por serie
- peso y repeticiones independientes por serie con controles táctiles
- controles táctiles sin zoom accidental por doble toque
- referencia compacta y expandible del entrenamiento anterior
- duración automática de la sesión desde el inicio hasta su finalización
- recuperación automática de una sesión activa
- navegación anterior, siguiente y salto directo entre ejercicios
- omisión y recuperación de ejercicios
- historial agrupado por entrenamiento con detalle de ejercicios y series
- resumen de ejercicios, series, reps, volumen, duración aproximada y omitidos
- comparación de volumen con la sesión anterior
- exportación e importación JSON
- borrado completo con confirmación
- migración automática del historial de la V0
- PWA con recursos offline e iconos para iPhone

## Estructura

```text
index.html              Entrada y metadatos PWA
manifest.json           Instalación de Sterk
service-worker.js       Caché offline
icons/                  Iconos SVG y PNG
src/data.js             Catálogo, grupos musculares y categorías
src/storage.js          Persistencia y respaldos
src/app.js              Vistas e interacciones
src/styles.css          Diseño mobile-first
docs/project-context.md Fuente principal de contexto
docs/architecture.md    Arquitectura y decisiones
```

## Limitaciones

- los datos continúan ligados al navegador y dispositivo actual
- no hay sincronización, cuentas ni recuperación remota
- la duración de la sesión se registra automáticamente
- no hay gráficas, PR ni estimaciones de 1RM
- la publicación HTTPS aún debe configurarse

## Próxima etapa

Probar la V1.2 durante entrenamientos reales y ajustar el constructor de sesiones. IndexedDB, HTTPS y sincronización continúan fuera de esta versión.
