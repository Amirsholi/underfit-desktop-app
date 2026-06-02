# Under-Fit Desktop

Aplicacion de escritorio para la gestion operativa de un gimnasio, construida con Electron y SQLite.

Permite administrar socios, membresias, ingresos, productos, ventas y backups desde una interfaz local pensada para el trabajo diario del gimnasio.

## Version

- Version actual: `2.1.0`
- Producto: `Under-Fit`
- Instalador: se genera en `dist/` al ejecutar el build.

## Funcionalidades

- Gestion de socios y edicion administrativa.
- Renovacion de membresias.
- Validacion y registro de ingresos.
- Gestion de productos y ventas con persistencia en SQLite.
- Backups semanales automaticos.
- Backup manual desde configuracion.

## Tecnologias

- Electron
- SQLite
- Node.js
- electron-builder

## Arquitectura actual

- `main.js`: arranque de Electron, ventanas y secuencia de inicializacion.
- `config.js`: resolucion de la ruta de la base de datos.
- `migrations.js`: creacion y actualizacion de la estructura SQLite.
- `ipcHandlers.js`: registro de handlers del proceso principal.
- `handlers/`: frontera IPC por dominio.
- `services/`: logica de negocio.
- `repositories/`: acceso a datos SQLite.
- `renderer.js` y `admin*.js`: UI administrativa.
- `user.html`: pantalla operativa de ingreso.

## Datos y backups

- Base por defecto: `C:\Users\<usuario>\GymAppData\gym.db`
- Backups: carpeta `backups` junto a la base.

Guias relacionadas:

- [Checklist de despliegue](docs/DEPLOY_CHECKLIST.md)
- [Backup y restauracion](docs/BACKUP_RESTORE.md)
- [Notas de version 2.1.0](docs/RELEASE_2.1.0.md)
- [Texto breve para presentar la nueva version](docs/CLIENT_MESSAGE_2.1.0.md)

## Instalacion local

```bash
npm install
npm start
```

## Build

Comandos principales:

```bash
npm run rebuild
npm run build
```

El instalador se genera en `dist/` con el nombre configurado en `package.json`.

## Nota operativa

La ruta exacta de datos puede cambiar entre PCs porque depende del usuario de Windows, pero la app la resuelve automaticamente. El operador del gimnasio no deberia tener que configurarla manualmente.
