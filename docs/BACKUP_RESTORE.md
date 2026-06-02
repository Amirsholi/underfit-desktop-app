# Under-Fit 2.0 - Backup y restauracion

## Donde queda la base

Por defecto la app guarda la base en una carpeta local del usuario de Windows:

`C:\Users\<usuario>\GymAppData\gym.db`

La ruta exacta se puede ver desde `Configuracion` dentro de la app.

## Backups automaticos

- La app crea un backup semanal automatico cuando inicia.
- Los backups quedan en la carpeta `backups` junto a la base.
- Se conservan los 12 mas recientes.

## Backup manual recomendado

Antes de instalar una nueva version:

1. Abrir la app.
2. Ir a `Configuracion`.
3. Presionar `Crear backup ahora`.
4. Esperar confirmacion.
5. Cerrar la app.

## Restauracion manual

Usar solo si la base principal se daño o no abre.

1. Cerrar la app por completo.
2. Ir a la carpeta donde esta `gym.db`.
3. Ir a la carpeta `backups`.
4. Elegir el backup correcto.
5. Copiar ese archivo.
6. Reemplazar `gym.db` por la copia elegida.

## Si existen archivos WAL/SHM

Si junto a la base aparecen archivos como:

- `gym.db-wal`
- `gym.db-shm`

Y el backup elegido tambien tiene sus pares, restaurar el conjunto correspondiente.

## Recomendacion practica

- Hacer backup manual antes de cada actualizacion.
- No restaurar sin necesidad.
- Si algo raro pasa despues de una nueva version, primero revisar que la app haya abierto la base correcta antes de reemplazar archivos.
