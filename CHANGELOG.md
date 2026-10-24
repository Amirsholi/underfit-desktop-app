# Historial de versiones

Las entradas 2.5.2–2.5.6 reproducen las notas de las releases publicadas. Los tags conservan el código correspondiente a cada instalador; no se reconstruyen lanzamientos anteriores sin evidencia.

## [v2.5.6](https://github.com/Amirsholi/underfit-desktop-app/releases/tag/v2.5.6) — 2026-10-24

- Caja conserva los movimientos de todas las aperturas y cierres del día seleccionado, con separadores por caja.
- El historial permite consultar cualquier fecha, elegir un día de la semana y avanzar o retroceder con flechas laterales.
- El día actual se destaca en naranja y el botón Hoy permite regresar rápidamente.
- Las correcciones se limitan a movimientos de la caja abierta. El arqueo mantiene los importes de esa caja, sin sumar cierres anteriores.

Esta actualización no incluye bases de datos ni modifica los registros existentes.

## [v2.5.5](https://github.com/Amirsholi/underfit-desktop-app/releases/tag/v2.5.5) — 2026-10-21

Las tablets muestran las clases y series activas de ambos locales. Permite operar asistencias e inscripciones sin restringir las clases al local 2, conserva el local de las clases al editar y excluye las clases eliminadas.

## [v2.5.4](https://github.com/Amirsholi/underfit-desktop-app/releases/tag/v2.5.4) — 2026-10-21

Cierre de caja con resumen diario y detalle de todos los cierres. Cobros agrupados por producto, inscripciones y renovaciones, con efectivo, transferencias y total. Salidas y correcciones separadas, responsables y horarios de apertura y cierre, saldo inicial y efectivo final.

Las nuevas ventas conservan nombre y cantidad del producto para el reporte. Las cantidades historicas no disponibles se indican como N/D. Se conservan todos los importes y registros existentes; no se reclasifican correcciones historicas automaticamente.

## [v2.5.3](https://github.com/Amirsholi/underfit-desktop-app/releases/tag/v2.5.3) — 2026-10-19

- Al eliminar una clase recurrente, se eliminan la fecha elegida y las posteriores, conservando las anteriores. Las clases con asistencia registrada se protegen.
- Productos organizados en tablas por local, con disponibilidad independiente y una sola caja.
- El nombre del profesor se escribe al crear clases y rutinas, sin cargar previamente un profesor.
- Rutinas de socios como primera vista en las tablets.
- Correccion de las direcciones de videos y medios de ejercicios al verlos desde el escritorio.

La revision de caja y PDF queda pendiente de contrastar los respaldos y cierres del gimnasio; esta version no cambia sus calculos ni su informe.

## [v2.5.2](https://github.com/Amirsholi/underfit-desktop-app/releases/tag/v2.5.2) — 2026-10-12

Correcciones para el funcionamiento diario de Under-Fit:

- Guardado de rutinas con grupo muscular derivado de sus ejercicios.
- Eliminación de ejercicios del catálogo conservando las rutinas existentes.
- Quitar socios de clases programadas y eliminar clases sin asistencias.
- Historial completo de ingresos por socio y contador de socios filtrados.
- Vinculación del pad numérico USB para recepción mientras se usa el teclado en Administración.

Para el pad USB: icono de Under-Fit junto al reloj > Vincular pad USB de ingreso. Aceptar y presionar un número en ese pad dentro de 30 segundos. Requiere comprobar el dispositivo físico del gimnasio.

La actualización se busca al iniciar Under-Fit y se respalda la base antes de instalar. El paquete no incluye datos de prueba ni credenciales del gimnasio.

## Historia anterior

El primer commit disponible ya contenía la versión 2.1.0. La rama `codex/underfit-2.5.0` conserva el rediseño y ampliación de julio. No se presentan esas etapas como releases nuevas ni se alteran los instaladores existentes.
