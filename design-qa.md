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

### Pasada 5

Registros dejó de ser una pestaña secundaria dentro de Caja y pasó a ser una página operativa propia. Se separaron los ingresos generales de las clases por día, con profesor asignado, estado, asistencia efectiva y detalle de presentes/ausentes dentro de la misma página.

### Pasada 6

Se agregó la superficie táctil de profesor: identificación simple para responsabilizar ventas, detección automática de la clase vigente, teclado de ingreso persistente y venta rápida asociada a socio. El horario inicia y termina las clases sin intervención del profesor y la sesión del dispositivo se cierra automáticamente luego de dos horas.

### Pasada 7

Se devolvieron los accesos frecuentes debajo de las tablas, se fijó el alto de las superficies con scroll interno y se unificó el orden de socios por urgencia: días positivos de menor a mayor y todos los resultados de 0 días al final. Productos se separó en Local 1 y Local 2 con selección de fila y acciones inferiores; la tablet eliminó la administración de stock y prioriza ingreso por CI y venta a asistentes o socios activos. Caja usa una franja compacta de jornada en lugar del bloque introductorio anterior.

En el ajuste visual siguiente, Inicio integró el buscador dentro del módulo de socios y alineó ambas tablas; se retiraron los iconos de productos y se ampliaron y reorganizaron los editores de socios, productos y ventas. La agenda volvió a mostrar todas las próximas clases en una superficie de altura fija con scroll, y sus indicadores adoptaron la misma estructura numérica de Registros. La tablet quedó reducida a encabezado operativo, ingreso por CI y un carrito modal, sin navegación ni cierre manual; dentro de la venta, el profesor busca al socio por nombre o CI con el teclado normal del dispositivo.

La última revisión consolidó una jerarquía compartida para títulos de página, encabezados de módulo, tablas, botones y métricas. La fotografía institucional vuelve a ser visible en administración, mientras las superficies de información mantienen contraste; la tablet usa la misma atmósfera con una capa más oscura para la operación táctil.

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
- Pruebas: sintaxis validada y 18 pruebas automatizadas aprobadas, incluidas integraciones SQLite temporales para stock, ventas pendientes, profesores, sesiones de tablet, clases recurrentes, ciclo horario automático, próxima clase, asistencia atómica, orden de vencimientos y activación de Under Running.
- Validación renderizada de este corte: administración a 1440×900 y tablet a 1024×768, sin errores de consola.

## Alcance futuro explícito

La superficie táctil ya está implementada y validada dentro de Electron, pero todavía opera con datos locales. La siguiente fase debe exponerla como aplicación web instalable conectada a la API central para que la tablet física y ambos locales compartan información en línea.

No quedan hallazgos P0, P1 ni P2 abiertos en el alcance implementado.

final result: passed
