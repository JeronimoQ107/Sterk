# Gym Tracker

PWA personal, mobile-first y completamente local para registrar entrenamientos desde un iPhone con pocos toques.

## Ejecutar localmente

La aplicación necesita servirse por HTTP para que los módulos ES y el service worker funcionen correctamente. Desde la raíz del proyecto:

```powershell
python -m http.server 8080
```

Abre `http://localhost:8080`. En un iPhone conectado a la misma red, usa la dirección IP local del computador en lugar de `localhost`. Para instalarla, abre la página en Safari y selecciona **Compartir → Añadir a pantalla de inicio**.

## Funcionalidades actuales

- selección de rutinas Push, Pull y Legs
- navegación secuencial por cuatro ejercicios
- peso precargado desde el registro anterior y ajustes rápidos
- repeticiones con controles `−` y `+`
- añadir o eliminar la última serie
- guardado de fecha, hora, peso, series y volumen
- historial local para mostrar el último rendimiento
- resumen al completar la rutina
- persistencia tras cerrar o recargar el navegador
- shell básico disponible sin conexión después de la primera carga

#### Estructura

```text
index.html              Entrada de la aplicación
manifest.json           Configuración PWA
service-worker.js       Caché básico sin conexión
icons/                  Iconos provisionales
src/data.js             Rutinas y valores iniciales
src/storage.js          Abstracción de localStorage
src/app.js              Estado, vistas e interacciones
src/styles.css          Diseño mobile-first
docs/project-context.md Fuente principal de contexto
docs/architecture.md    Arquitectura y decisiones
```

## Limitaciones de la V0

- los datos solo existen en el navegador y dispositivo donde se registran
- no hay sincronización, exportación, cuentas ni recuperación remota
- no existe aún una pantalla completa de historial
- se usa temporalmente el registro conjunto por ejercicio
- el icono de iOS es SVG provisional; conviene añadir un PNG de 180 × 180 px antes de distribuirla
- borrar los datos del sitio elimina el historial

## Próximos pasos sugeridos

Validar la experiencia en entrenamientos reales y comparar el modo actual con el registro inmediato por serie y temporizador de descanso. Después conviene añadir una vista sencilla de historial y exportación local antes de iniciar la integración con API, Microsoft Graph y Excel.
