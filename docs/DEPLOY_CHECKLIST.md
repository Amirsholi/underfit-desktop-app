# Under-Fit 2.0 - Checklist de despliegue

## Antes de actualizar en el gimnasio

1. Abrir la app actual.
2. Ir a `Configuracion`.
3. Crear un backup manual.
4. Confirmar que el backup se haya creado sin error.
5. Cerrar la app completa antes de instalar la nueva version.

## Instalacion sobre una PC que ya tiene datos

1. Instalar la nueva version normalmente.
2. Abrir la app.
3. Verificar en `Configuracion`:
   - ruta de base de datos
   - ruta de backups
4. Confirmar que los socios existentes siguen visibles.
5. Confirmar que ingreso de usuarios funciona.
6. Confirmar que productos abre sin error.

## Verificacion funcional minima

1. Buscar un socio existente.
2. Editar un socio y cerrar sin guardar.
3. Validar ingreso de un socio desde la ventana de usuario.
4. Crear un producto de prueba.
5. Editar ese producto.
6. Registrar una venta de prueba.
7. Verificar que dashboard y widgets sigan cargando.

## Si algo falla despues de actualizar

1. No seguir operando a medias.
2. Cerrar la app.
3. Revisar el ultimo backup creado.
4. Confirmar que la base principal siga existiendo.
5. Restaurar solo si realmente la base quedo dañada o no abre.

## Notas operativas

- La base no depende de la carpeta de instalacion.
- Cada PC usa su propia ruta local automaticamente.
- No hace falta que el usuario del gym cambie rutas manualmente.
- Si la PC tiene otro nombre de usuario, la ruta absoluta puede cambiar, pero la app la resuelve sola.
