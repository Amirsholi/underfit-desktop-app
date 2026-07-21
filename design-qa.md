# Design QA — Under-Fit 2.5.0

## Fuente visual

- Referencia aprobada: `C:\Users\Usuario\.codex\generated_images\019f7fef-b994-7da2-a5b2-06256229efbb\exec-4e2b7d84-4a7f-4352-a93e-5546e5af48e5.png`
- Implementación final a igual viewport: `.codex-audit/rework/21-inicio-1488x1057-final.png`
- Comparación lado a lado: `.codex-audit/rework/22-inicio-comparacion-final.png`

La referencia gobierna el lenguaje visual global y la pantalla Inicio. Caja, Registros, Clases, Locales, Cobros pendientes y Configuración derivan la misma paleta, jerarquía, tipografía, superficies, iconografía y densidad.

## Historial de pasadas

### Pasada 1

Se detectaron escala tipográfica demasiado pequeña, Inicio sin suficiente identidad, estados vacíos que duplicaban altura, modales centrados todavía genéricos, Caja con jerarquía distinta y páginas multi-local sin operaciones reales.

### Pasada 2

Se aplicó una escala base de 16 px, se recuperó el fondo de gimnasio, se reconstruyó Inicio según la referencia, los formularios operativos pasaron a paneles de tarea amplios, y se implementaron Clases, stock por local y Cobros pendientes con datos realistas e interacción.

### Pasada 3

Se corrigió la composición de Caja: la fecha y el contexto ocupan una sola franja, el estado de apertura comparte línea con el responsable y el resumen monetario, y se eliminó el gran vacío lateral. Registros recibió contexto propio en lugar de repetir el texto de Caja.

## Verificación final

- Tipografía y jerarquía: base de 16 px, títulos, cifras y acciones legibles; no quedan textos operativos de 10–12 px como estructura principal.
- Layout: Inicio conserva resumen, búsqueda, socios, venta rápida y cuatro accesos frecuentes. No existe la franja inferior retirada por el cliente.
- Caja: estado, totales, formas de pago, salidas y monto sin cobrar están agrupados antes de los movimientos.
- Cierre: las ventas pendientes se muestran separadas y no se suman al efectivo ni a transferencias.
- Formularios: venta, nueva clase, inscripción y cobro pendiente usan paneles de tarea grandes y coherentes, con cierre, encabezado, cuerpo y acciones persistentes.
- Estados y contenido: no aparecen errores de carga en la vista de demostración; usuarios, productos, caja, registros, clases, stock y cobros muestran información coherente.
- Interacciones verificadas: cantidad de venta, transferencia de stock Local 1 → Local 2, selección de clase, lista de alumnos, apertura de nueva clase, inscripción y cobro pendiente.
- Viewports: 1920×1080, 1488×1057 y 1080×720. Sin desbordamiento horizontal; a 1080 px la barra lateral se transforma en riel de iconos y el contenido mantiene 16 px base.
- Iconos y activos: se conserva el logo real, el fondo de gimnasio y Font Awesome; no se agregaron ilustraciones falsas ni SVG improvisados.
- Pruebas: sintaxis validada y 7 pruebas automatizadas aprobadas, incluida una integración SQLite temporal para stock y ventas pendientes.

## Alcance futuro explícito

La sincronización central en línea, la interfaz exclusiva de la tablet del profesor y la segunda pantalla de ingresos no se presentan como terminadas en este corte. La interfaz indica correctamente “Datos locales” y la estructura multi-local queda preparada para conectar ese servicio en la siguiente fase.

No quedan hallazgos P0, P1 ni P2 abiertos en el alcance implementado.

final result: passed
