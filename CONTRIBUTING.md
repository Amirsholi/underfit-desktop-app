# Cambios y revisión

## Ramas

- `main`: referencia pública del código integrado.
- `codex/dotnet-transition`: historia de la migración; las releases 2.5.2–2.5.6 proceden de ella.
- `codex/underfit-2.5.0`: etapa histórica del rediseño y ampliación.
- Nuevos cambios: ramas cortas, por ejemplo `codex/fix-class-enrollment`, con PR hacia `main`.

Las ramas históricas se conservan para trazabilidad. El canal de actualización son las releases estables.

## Pull requests

Explicar problema y comportamiento resultante; mantener el cambio enfocado; añadir pruebas cuando cambian reglas; ejecutar las comprobaciones de [desarrollo](docs/DEVELOPMENT.md); documentar efectos sobre datos, migraciones y dispositivos.

Usar datos ficticios. No adjuntar respaldos, credenciales ni capturas con información personal. Indicar exactamente qué se verificó y qué sigue pendiente.

La documentación no incrementa la versión del producto. La distribución sigue el proceso de [operación](docs/OPERATIONS.md). CI verifica el código y la publicación continúa siendo explícita.
