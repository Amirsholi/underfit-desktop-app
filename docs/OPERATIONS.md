# Operación y releases

La PC del gimnasio ejecuta administración, API y PostgreSQL. El acceso remoto usa Cloudflare Tunnel. Respaldar PostgreSQL y medios; una SQLite anterior no representa necesariamente la información vigente.

El README anterior mezclaba preparación y entregas posteriores. [GitHub Releases](https://github.com/Amirsholi/underfit-desktop-app/releases) registra publicaciones; la validación en la PC del gimnasio se registra por separado.

## Migración

El primer inicio sin configuración puede detectar SQLite, guardar un snapshot e importar una base compatible en una transacción. Un recibo PostgreSQL evita repetir una importación confirmada. Bases con clases, profesores o rutinas requieren revisar la migración asistida completa.

- [Inspección](../scripts/inspect-legacy.js)
- [Ensayo de migración](../scripts/rehearse-gym-migration.js)
- [Verificación](../scripts/verify-migrated-data.js)
- [Restauración de ensayo](../scripts/verify-rehearsal-restore.js)

Revisar los scripts antes de ejecutarlos: algunos dependen de entornos específicos y no son comandos genéricos de instalación.

## Publicación

1. Ejecutar pruebas y documentar cambios.
2. Actualizar versión y guardar un commit limpio.
3. Ejecutar `npm run build`.
4. Escribir `release-notes/<version>.md`.
5. Ejecutar `npm run release:draft -- release-notes/<version>.md`.
6. Ensayar y revisar el instalador antes de publicar el borrador.

El script verifica versión, contenido, procedencia y hashes. No sobrescribe versiones. Las credenciales de publicación pertenecen al entorno de desarrollo.

Cada release estable contiene instalador `.exe`, `.blockmap` y `latest.yml`. Los tres forman parte de la distribución. **Un commit, PR o cambio documental no publica una actualización:** esta se activa al publicar una release estable.

## Recuperación

El host busca actualizaciones al iniciar y contempla respaldo antes de instalar. Evita interrumpir una API activa y conserva la versión actual ante errores de red o respaldo.

No hay reversión automática de esquema. Recuperar puede requerir detener la operación y restaurar base y medios con el instalador correspondiente. Instalar un ejecutable anterior sobre un esquema nuevo no equivale a restaurar.

Los ensayos automatizados no sustituyen comprobar acceso desde ambos locales, reinicio de Windows y funcionamiento del pad físico.
