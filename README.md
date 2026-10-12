# Under-Fit

Sistema de gestión de gimnasio para Windows, con recepción, socios, caja,
clases, rutinas y ejercicios.

## Estado

El gimnasio tiene instalada la versión 2.5.1 y el responsable confirmó su
funcionamiento. Las tablets y el escritorio conectado comparten una API .NET 10
con PostgreSQL 18. Los ensayos locales usan bases aisladas.
La versión 2.5.2 está en preparación; todavía no se publicó una actualización.

Desde 2.5.1, el primer inicio sin configuración permite preparar la PC principal:
detecta la SQLite anterior (o permite elegirla), guarda un snapshot consistente y
crea el servidor. Importa la versión main en una sola transacción y comprueba
cantidades, vencimientos e importes antes de abrir la atención o el túnel.
El respaldo y el informe quedan en `userData/platform/migration-backups` y
`userData/platform/first-installation.json`. Un recibo en PostgreSQL evita repetir
una importación ya confirmada después de una interrupción. Bases con clases,
profesores o rutinas requieren la migración asistida completa. Docker/WSL,
dominio y acceso remoto siguen siendo preparaciones externas. Las instalaciones
ya configuradas no vuelven a importar automáticamente.

Al iniciar el host, Under-Fit localiza Docker en sus rutas de instalación y,
si el motor está apagado, inicia Docker Desktop y espera con un límite de tiempo.
Esto evita depender del orden de arranque de Windows o de que su terminal tenga
Docker en PATH. El modo cliente no inicia ningún servidor local.

La entrega prevista usa la PC del gym como servidor, encendida y con Internet,
y un dominio HTTPS mediante Cloudflare Tunnel para el otro local y el acceso
desde casa. Dominio, túnel, respaldos y actualizaciones remotas deben configurarse
y comprobarse antes de la entrega. Las tablets se vinculan desde Configuración
con un código de seis dígitos, válido cinco minutos y una sola vez.

La configuración remota se prepara con `scripts/configure-remote-access.ps1`:
`-Preview` muestra la ruta del túnel sin guardar credenciales. El token se ingresa
localmente, oculto, y se guarda fuera del programa. Antes de activar la entrega:
verificar la PC, ensayar la migración y restauración con una copia de SQLite,
registrar el dominio, configurar el túnel y comprobar acceso desde ambos locales,
arranque tras reinicio y actualización remota. El dominio y el acceso remoto
siguen pendientes de configuración.

## Correcciones en preparación (2.5.2)

- Las rutinas derivan el grupo muscular de sus ejercicios cuando no se indicó.
- La ficha de ejercicio permite eliminarlo del catálogo; se conservan las
  rutinas existentes que lo usan y pueden seguir editándose.
- El detalle de una clase programada permite quitar socios. Se puede eliminar
  una clase sin asistencias; se conserva internamente para evitar que reaparezca.
- Registros permite elegir «Historial por socio» y consultar todas sus entradas,
  incluidas las asistencias a clases, sin limitarse al día seleccionado.
- Socios muestra la cantidad de resultados después de aplicar filtros.
- El pad USB se vincula desde el icono de Under-Fit junto al reloj, con
  «Vincular pad USB de ingreso». Tras aceptar, presionar un número en el pad
  dentro de los 30 segundos. El teclado habitual queda disponible para
  Administración mientras el pad registra ingresos con Under-Fit en primer plano.

La separación del teclado y del pad tiene pruebas automatizadas, pero requiere
validación con el dispositivo físico del gimnasio antes de publicar. Probar
escritura en Administración e ingreso por USB simultáneos, Enter, corrección y
reinicio de la aplicación. Si se cambia el puerto USB puede requerir vincularlo
de nuevo. El instalador incluye el auxiliar nativo mediante `npm run build:keypad`.

## Desarrollo y pruebas

- `npm install`: dependencias del escritorio.
- `npm start`: escritorio; por defecto utiliza SQLite local.
- `npm test`: pruebas JavaScript.
- `dotnet test backend/UnderFit.UnitTests/UnderFit.UnitTests.csproj`: pruebas .NET.
- `python -m unittest discover -s test -p test_integration_copy.py`: copia SQLite.
- `node scripts/verify-rehearsal-restore.js`: respalda y restaura únicamente la
  base aislada de tablets; compara todos los registros y conserva el informe
  fuera del proyecto. No sustituye la verificación de medios ni la migración real.

Los scripts de importación y respaldo están en `scripts/`. Nunca usar una base
real para demostraciones. Los datos, las credenciales y los resultados de
compilación permanecen fuera del control de versiones.

## Migración y actualizaciones

`node scripts/rehearse-gym-migration.js <copia-verificada.db>` crea una base
`underfit_migration_check_*` en el contenedor aislado de ensayo. Importa los datos,
compara cantidades, socios, vencimientos e importes y verifica que repetir la
importación no duplique registros. Conserva el informe junto a la copia, fuera
del repositorio. `node scripts/verify-rehearsal-restore.js <base-de-ensayo>` permite
comprobar también el respaldo y restauración de ese destino. La copia definitiva
debe obtenerse al detener la operación del gimnasio para la instalación.

El host empaquetado busca versiones estables de GitHub al arrancar, antes de
abrir la atención e iniciar la API. Descarga la versión, respalda PostgreSQL y
los medios y ejecuta el instalador. No instala al cerrar ni durante la jornada.
Sin conexión, ante un error o si no puede respaldar, conserva la versión actual.
Si ya hay una API activa, omite la actualización para no interrumpirla.
El historial del intento queda en `updates.log` dentro del directorio de usuario
de la aplicación. El ensayo aislado con dos instaladores NSIS verifica descarga,
respaldo del perfil, instalación y reapertura automática conservando datos. La
restauración PostgreSQL se verifica por separado. El servidor empaquetado ya se
probó sobre una copia migrada del gym; sigue pendiente la instalación en su PC.

Para repetir el ensayo del actualizador, `scripts/prepare-update-rehearsal.js`
genera un proyecto separado fuera del repositorio, con identidad propia y sin
accesos directos. Sus dos versiones se compilan con la configuración generada;
`scripts/run-update-rehearsal.js <carpeta-generada>` sirve la actualización solo
en loopback, compara el perfil y desinstala la aplicación de ensayo. No publica
versiones en GitHub ni toca las bases de producción.

Flujo de publicación desde la PC de desarrollo:

1. Probar los cambios, incrementar la versión y guardar un commit.
2. `npm run build` genera el instalador sin publicarlo.
3. `npm run release:draft -- <notas.md>` audita los archivos y crea un borrador
   de GitHub Release. Requiere `GH_TOKEN` únicamente en desarrollo.
4. Revisar y ensayar el instalador. Publicar el borrador en GitHub solamente
   cuando se decida distribuir esa versión. Los commits y los borradores no
   disparan actualizaciones en el gimnasio.

No hay reversión automática de esquemas: ante un fallo que requiera volver de
versión, detener la operación y restaurar el respaldo previo con el instalador
anterior. Conservar ambos; reinstalar un ejecutable viejo sobre un esquema nuevo
no equivale a restaurar. Dominio, acceso externo y ensayo del instalador siguen
siendo condiciones pendientes para la entrega.
