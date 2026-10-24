# Caso de estudio — Under-Fit

## Contexto

Desarrollado por Amir Sholi para un gimnasio de Uruguay con dos locales y caja centralizada. El trabajo abarca relevamiento, programación, interfaces, persistencia, migración, distribución y mantenimiento.

## Evolución verificable

| Etapa | Evidencia |
|---|---|
| Aplicación local | El primer commit, `66a1cd5` (2 de junio de 2026), ya contiene la versión 2.1.0 con Electron y SQLite |
| Ampliación | Los commits de julio incorporan organización administrativa, clases recurrentes, asistencias y tablets |
| Arquitectura compartida | `codex/dotnet-transition` incorpora API .NET, PostgreSQL y migración |
| Entrega y mantenimiento | Releases 2.5.2–2.5.6: instalación, clases, medios y caja |
| Acceso de socios | Base web/PWA implementada; validación completa pendiente |

El primer commit no es el comienzo del desarrollo. El relato del autor complementa el período anterior a Git.

## Decisiones motivadas por el uso

**Más dispositivos, una sola información.** SQLite local dio paso a una API con PostgreSQL para compartir operaciones entre escritorio y tablets.

**Migrar conservando el historial.** La instalación prepara una copia consistente, importa y verifica cantidades e importes. Respaldo y restauración tienen ensayos independientes.

**Atender mientras se administra.** Un auxiliar Windows distingue el pad USB del teclado habitual. Las pruebas verifican el enrutamiento; el dispositivo real requiere comprobación física.

**Entender la caja completa.** Las versiones 2.5.4 y 2.5.6 mejoran reportes y consulta de múltiples sesiones. El historial diario y el arqueo de la caja abierta tienen propósitos distintos.

**Mantener después de instalar.** Tags y comprobaciones de integridad vinculan código y binarios. La publicación es explícita y el host contempla un respaldo antes de actualizar.

## IA en el proceso

El proyecto empezó con programación manual. El autor incorporó herramientas de IA a medida que creció el alcance. Esto describe el desarrollo; no implica funciones de IA en el producto. Las decisiones se contrastan con código, pruebas y comportamiento observado. El historial no permite atribuir cada línea a trabajo manual o a una herramienta.

## Resultado y límites

El responsable confirmó el funcionamiento del escritorio y tablets con la arquitectura compartida. La última publicación revisada es la 2.5.6; publicar no demuestra que todos los equipos la hayan instalado.

No se presentan porcentajes de ahorro, cobertura total ni métricas de usuarios sin medición. Los límites actuales incluyen dependencia de la PC central, coexistencia de SQLite y API y validación móvil pendiente.

La instalación de dependencias del 24 de octubre de 2026 reportó 30 alertas de npm audit (2 bajas, 1 moderada, 26 altas y 1 crítica). Ese resultado requiere revisión de alcance y actualización de dependencias, incluida la plataforma Electron; no equivale por sí solo a demostrar explotación en la aplicación. Esta actualización documental no modifica las dependencias del producto ni resuelve esas alertas.

Para evaluar el trabajo: comenzar por [Domain](../backend/UnderFit.Domain), seguir un caso de uso en [Application](../backend/UnderFit.Application), contrastarlo con las [pruebas PostgreSQL](../backend/UnderFit.IntegrationTests/PostgreSql/PostgreSqlVerticalSliceTests.cs) y revisar [la entrega](OPERATIONS.md).
