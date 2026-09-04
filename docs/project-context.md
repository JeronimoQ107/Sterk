# Sterk — contexto del proyecto

> Fuente principal para decisiones de producto, UX y arquitectura. Actualizar cuando cambie el alcance o se tome una decisión importante.

## Visión

Sterk es una aplicación personal para registrar el progreso en el gimnasio desde un iPhone con la menor fricción posible. Se distribuye como PWA instalable mediante **Añadir a pantalla de inicio**.

## Prioridades

1. Minimizar toques y escritura.
2. Funcionar cómodamente con una mano.
3. Mostrar el rendimiento anterior.
4. Registrar peso y repeticiones individuales por serie.
5. Recuperar una sesión interrumpida.
6. Mantener historial y copias de seguridad bajo control del usuario.
7. Mantener una arquitectura local-first y añadir sincronización solo cuando aporte valor.
8. Usar Excel únicamente como exportación opcional para análisis.
9. Evitar servicios de pago cuando exista una alternativa gratuita razonable.

## Decisiones confirmadas

- Nombre del producto y proyecto: **Sterk**.
- Tecnología: HTML, CSS y JavaScript vanilla, sin frameworks.
- Aplicación mobile-first y PWA.
- Persistencia local abstraída mediante `localStorage` durante V0 y V1.
- Dos modos disponibles: registro conjunto por ejercicio y marcado libre por serie.
- La duración total de la sesión se mide automáticamente entre inicio y finalización.
- La sesión activa debe persistir al cerrar, recargar o bloquear el teléfono.
- La navegación durante la rutina permite avanzar, retroceder, saltar directamente y omitir ejercicios.
- Los datos pueden exportarse e importarse mediante respaldo JSON.
- Cada sesión se construye seleccionando y ordenando ejercicios libremente.
- Cada ejercicio declara un grupo muscular y una categoría Push, Pull o Legs.
- La categoría final de la sesión se deriva de los ejercicios registrados.

## Catálogo inicial

- **Push:** Bench Press, Incline Press, Shoulder Press, Triceps Extension.
- **Pull:** Lat Pulldown, Seated Row, Biceps Curl, Rear Delt Fly.
- **Legs:** Power Squat, Leg Extension, Leg Curl, Calf Raise.
- El usuario puede combinar, ordenar y añadir ejercicios personalizados.

## Arquitectura

Actual:

```text
iPhone → PWA Sterk → capa storage → localStorage
```

Futura, no implementada:

```text
iPhone → PWA Sterk → IndexedDB → sincronización opcional → base de datos remota
```

Excel se conserva como posible formato de exportación, no como base de datos. La interfaz, el dominio y la persistencia deben permanecer separados para poder sustituir `localStorage` sin reescribir la UI.

## Fuera de alcance actual

- backend y autenticación
- Cloudflare Worker
- Microsoft Graph
- Excel y OneDrive
- bases de datos externas
- temporizadores manuales de ejercicios o descansos
- métricas avanzadas, PR, gráficas y 1RM

## Registro de decisiones

| Fecha | Decisión | Estado |
|---|---|---|
| 2026-09-02 | Construir la aplicación como PWA vanilla. | Aprobada |
| 2026-09-02 | Usar `localStorage` detrás de una abstracción sustituible. | Aprobada |
| 2026-09-02 | Posponer backend, autenticación, Microsoft Graph y Excel. | Aprobada |
| 2026-09-02 | Cambiar el nombre de Gym Tracker a Sterk. | Aprobada |
| 2026-09-02 | Ofrecer registro por ejercicio y por serie. | Aprobada |
| 2026-09-03 | Medir automáticamente la duración total sin controles manuales. | Aprobada |
| 2026-09-03 | Permitir peso independiente por serie y agrupar el historial por sesión. | Aprobada |
| 2026-09-03 | Construir sesiones libremente desde un catálogo clasificado. | Aprobada |
| 2026-09-03 | Mantener Excel fuera del camino crítico y como exportación opcional. | Aprobada |
| 2026-09-02 | Añadir recuperación de sesión, historial básico y respaldo JSON en V1. | Aprobada |
