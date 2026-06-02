# Under-Fit 2.0.0 - Notas de version

## Resumen

Esta version consolida la evolucion de la app a una base mas ordenada, mas estable y lista para crecer sin perder el funcionamiento diario del gimnasio.

## Mejoras principales

- reorganizacion interna de la app por capas mas claras
- validacion de ingreso centralizada fuera del frontend
- reglas de membresias preservadas y consolidadas
- soporte real de productos y ventas en SQLite
- dashboard operativo conectado a datos reales
- backups semanales automaticos
- backup manual desde configuracion
- interfaz renovada y mas clara para uso diario
- instalador actualizado de la version `2.0.0`

## Compatibilidad

- mantiene los usuarios existentes
- mantiene la base de datos previa del gimnasio
- agrega la estructura nueva necesaria para productos y ventas sin reemplazar la informacion existente

## Operacion recomendada

Antes de instalar una nueva version:

1. crear backup manual
2. cerrar la app
3. instalar la nueva version
4. validar socios, ingresos y productos

## Archivos utiles

- instalador: [Under-Fit-Setup-2.0.0.exe](C:/GymApp/dist/Under-Fit-Setup-2.0.0.exe)
- checklist tecnico: [DEPLOY_CHECKLIST.md](C:/GymApp/docs/DEPLOY_CHECKLIST.md)
- backup y restauracion: [BACKUP_RESTORE.md](C:/GymApp/docs/BACKUP_RESTORE.md)
