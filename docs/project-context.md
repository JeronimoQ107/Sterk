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
7. Usar finalmente Excel en OneDrive como repositorio y plataforma de análisis.
8. Evitar servicios de pago cuando exista una alternativa gratuita razonable.

## Decisiones confirmadas

- Nombre del producto y proyecto: **Sterk**.
- Tecnología: HTML, CSS y JavaScript vanilla, sin frameworks.
- Aplicación mobile-first y PWA.
- Persistencia local abstraída mediante `localStorage` durante V0 y V1.
- Dos modos disponibles: registro conjunto por ejercicio y marcado libre por serie.
- **No se implementarán temporizadores** de ejercicio ni descanso. Sterk no debe imponer ritmos de entrenamiento.
- La sesión activa debe persistir al cerrar, recargar o bloquear el teléfono.
- La navegación durante la rutina permite avanzar, retroceder, saltar directamente y omitir ejercicios.
- Los datos pueden exportarse e importarse mediante respaldo JSON.

## Rutinas iniciales

- **Push:** Bench Press, Incline Press, Shoulder Press, Triceps Extension.
- **Pull:** Lat Pulldown, Seated Row, Biceps Curl, Rear Delt Fly.
- **Legs:** Power Squat, Leg Extension, Leg Curl, Calf Raise.

## Arquitectura

Actual:

```text
iPhone → PWA Sterk → capa storage → localStorage
```

Futura:

```text
iPhone → PWA Sterk → API → Cloudflare Worker → Microsoft Graph → Excel en OneDrive
```

La arquitectura futura no está implementada. La interfaz, el dominio y la persistencia deben permanecer separados para poder sustituir `localStorage` sin reescribir la UI.

## Fuera de alcance actual

- backend y autenticación
- Cloudflare Worker
- Microsoft Graph
- Excel y OneDrive
- bases de datos externas
- temporizadores
- métricas avanzadas, PR, gráficas y 1RM

## Registro de decisiones

| Fecha | Decisión | Estado |
|---|---|---|
| 2026-09-02 | Construir la aplicación como PWA vanilla. | Aprobada |
| 2026-09-02 | Usar `localStorage` detrás de una abstracción sustituible. | Aprobada |
| 2026-09-02 | Posponer backend, autenticación, Microsoft Graph y Excel. | Aprobada |
| 2026-09-02 | Cambiar el nombre de Gym Tracker a Sterk. | Aprobada |
| 2026-09-02 | Ofrecer registro por ejercicio y por serie. | Aprobada |
| 2026-09-02 | Excluir permanentemente temporizadores de entrenamiento y descanso. | Aprobada |
| 2026-09-02 | Añadir recuperación de sesión, historial básico y respaldo JSON en V1. | Aprobada |
