# Design QA — Under-Fit 2.5.0

## Fuente visual

- Referencia real de la rama anterior: `.codex-audit/revision2/qa/source-1280.png`
- Implementación final a igual viewport: `.codex-audit/revision2/qa/current-1280.png`
- Comparación lado a lado: `.codex-audit/revision2/qa/comparison-1280.jpg`

La rama anterior gobierna el fondo real de gimnasio, la paleta negro/naranja y la identidad de marca. El corte actual conserva esa fuente y reorganiza la operación para navegación, multi-local y lectura rápida.

## Historial de pasadas

### Pasada 1

Se detectaron escala tipográfica demasiado pequeña, Inicio sin suficiente identidad, estados vacíos que duplicaban altura, modales centrados todavía genéricos, Caja con jerarquía distinta y páginas multi-local sin operaciones reales.

### Pasada 2

Se aplicó una escala base de 16 px, se recuperó el fondo de gimnasio, se reconstruyó Inicio según la referencia, los formularios operativos pasaron a paneles de tarea amplios, y se implementaron Clases, stock por local y Cobros pendientes con datos realistas e interacción.

### Pasada 3

Se corrigió la composición de Caja: la fecha y el contexto ocupan una sola franja, el estado de apertura comparte línea con el responsable y el resumen monetario, y se eliminó el gran vacío lateral. Registros recibió contexto propio en lugar de repetir el texto de Caja.

### Pasada 4

Se eliminó el saludo de Inicio, se alinearon socios y productos desde el mismo encabezado y se concentraron búsqueda y accesos frecuentes en una barra compacta. Las acciones de producto se simplificaron, los formularios dejaron de abrir como hojas laterales y Locales se integró dentro de Productos como distribución de stock.

## Verificación final

- Tipografía y jerarquía: base de 16 px, títulos, cifras y acciones legibles; no quedan textos operativos de 10–12 px como estructura principal.
- Layout: Inicio comienza directamente con el resumen, concentra búsqueda y cuatro accesos frecuentes, y alinea las tablas de socios y venta rápida en altura, encabezados y filas.
- Caja: estado, totales, formas de pago, salidas y monto sin cobrar están agrupados antes de los movimientos.
- Cierre: las ventas pendientes se muestran separadas y no se suman al efectivo ni a transferencias.
- Formularios: venta, nueva clase, inscripción y cobro pendiente usan diálogos centrados, coherentes y contenidos dentro del viewport.
- Estados y contenido: no aparecen errores de carga en la vista de demostración; usuarios, productos, caja, registros, clases, stock y cobros muestran información coherente.
- Interacciones verificadas: venta rápida, cantidad de venta dentro del formulario, navegación, transferencia de stock Local 1 → Local 2, Caja y Registros.
- Viewports: 1920×1080 y 1280×720. Sin desbordamiento horizontal; en el ancho compacto la barra lateral se transforma en riel de iconos y las tablas conservan columnas legibles.
- Iconos y activos: se conserva el logo real, el fondo de gimnasio y Font Awesome; no se agregaron ilustraciones falsas ni SVG improvisados.
- Pruebas: sintaxis validada y 7 pruebas automatizadas aprobadas, incluida una integración SQLite temporal para stock y ventas pendientes.

## Alcance futuro explícito

La sincronización central en línea, la interfaz exclusiva de la tablet del profesor y la segunda pantalla de ingresos no se presentan como terminadas en este corte. La interfaz indica correctamente “Datos locales” y la estructura multi-local queda preparada para conectar ese servicio en la siguiente fase. El flujo objetivo de tablet quedó documentado con sesión persistente del profesor, ingreso autónomo por CI y venta pendiente que retorna automáticamente al modo ingreso.

No quedan hallazgos P0, P1 ni P2 abiertos en el alcance implementado.

final result: passed
