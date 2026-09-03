# Gym Tracker — contexto del proyecto

> Fuente principal y permanente para las decisiones de producto, UX y arquitectura. Actualizar cuando cambie el alcance o se tome una decisión importante.

## Visión y objetivo

Gym Tracker es una aplicación personal para registrar el progreso en el gimnasio desde un iPhone con la menor fricción posible. Se construye como una PWA instalable mediante **Añadir a pantalla de inicio**.

La experiencia debe permitir registrar peso, series y repeticiones con una sola mano, pocos toques y casi nada de escritura. Debe mostrar el rendimiento anterior y mantener un historial por ejercicio. En fases futuras podrá mostrar progreso, récords personales, volumen y estimaciones de 1RM.

## Prioridades

1. Minimizar toques y entrada de texto.
2. Mostrar el entrenamiento anterior como referencia.
3. Registrar peso y repeticiones individuales por serie.
4. Mantener historial por ejercicio.
5. Mantener los datos bajo control del usuario.
6. Usar finalmente Excel en OneDrive como repositorio y plataforma de análisis.
7. Evitar servicios de pago cuando exista una alternativa gratuita razonable.

## Alcance de la V0

- HTML, CSS y JavaScript vanilla.
- PWA local y mobile-first.
- Persistencia mediante `localStorage`, detrás de una capa sustituible.
- Rutinas iniciales Push, Pull y Legs.
- Registro conjunto de todas las series de un ejercicio (modo A) para validar primero la interfaz.

Fuera de alcance: backend, autenticación, Cloudflare, Microsoft Graph, Excel y bases de datos externas.

## Arquitectura

Actual:

```text
iPhone → PWA Gym Tracker → localStorage
```

Prevista:

```text
iPhone → PWA Gym Tracker → API / Cloudflare Worker → Microsoft Graph → Excel en OneDrive
```

La interfaz, la lógica de dominio y la persistencia deben permanecer separadas para que la arquitectura futura no exija reescribir la UI.

## Rutinas iniciales

- **Push:** Bench Press, Incline Press, Shoulder Press, Triceps Extension.
- **Pull:** Lat Pulldown, Seated Row, Biceps Curl, Rear Delt Fly.
- **Legs:** Power Squat, Leg Extension, Leg Curl, Calf Raise.

## Principios de UX

- Diseño oscuro, limpio y mobile-first.
- Optimización principal para iPhone y uso con una mano.
- Botones grandes, controles rápidos y números visibles.
- Preferir selección y valores precargados sobre formularios y teclado.
- Avanzar al siguiente ejercicio después de registrar el actual.
- Mostrar confirmación breve sin interrumpir el flujo.

## Decisión de UX pendiente

Se deben probar dos modos antes de elegir uno definitivamente:

- **A — por ejercicio:** registrar todas las series juntas al finalizar el ejercicio.
- **B — por serie:** registrar cada serie inmediatamente y posiblemente iniciar un temporizador de descanso.

La V0 implementa temporalmente el modo A. El modelo conserva cada serie como un valor individual para no impedir el modo B más adelante.

## Registro de decisiones

| Fecha | Decisión | Estado |
|---|---|---|
| 2026-09-02 | Construir la V0 como PWA local en HTML, CSS y JavaScript vanilla. | Aprobada |
| 2026-09-02 | Usar `localStorage` detrás de una abstracción sustituible. | Aprobada |
| 2026-09-02 | Posponer backend, autenticación, Cloudflare, Microsoft Graph y Excel. | Aprobada |
| 2026-09-02 | Implementar temporalmente el registro conjunto por ejercicio (modo A). | En validación |
| 2026-09-02 | Mantener las series como datos individuales para permitir posteriormente el modo B. | Aprobada |
