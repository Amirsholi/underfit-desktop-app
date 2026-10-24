# Desarrollo y pruebas

## Requisitos

Windows para escritorio y pad USB; Node.js 22, npm, el SDK de `global.json`, Python 3 para copia SQLite y PostgreSQL 18 / Docker para API e integración. Trabajar en un entorno independiente de la instalación del gimnasio.

## Pruebas unitarias

```powershell
npm ci
npm test
dotnet test backend/UnderFit.UnitTests/UnderFit.UnitTests.csproj
python -m unittest discover -s test -p test_integration_copy.py
```

`sqlite3` es nativo: `npm ci` lo prepara para Node; `npm run rebuild`, para Electron. Después de reconstruir para Electron puede ser necesario ejecutar `npm rebuild sqlite3` antes de volver a las pruebas Node.

## API local

En una máquina de desarrollo sin otra base ocupando el puerto 5432:

```powershell
docker compose -f infrastructure/compose/compose.yaml up -d
dotnet run --project backend/UnderFit.Api/UnderFit.Api.csproj --launch-profile http
```

El perfil escucha en `http://localhost:5187` y aplica migraciones al iniciar. Los valores de `appsettings.Development.json` son ejemplos locales; ese archivo no se publica con la API.

En otra terminal, conectar el escritorio:

```powershell
$env:UNDERFIT_DATA_MODE = 'api'
$env:UNDERFIT_INSTALLATION_ROLE = 'client'
$env:UNDERFIT_API_BASE_URL = 'http://127.0.0.1:5187'
$env:UNDERFIT_DEVICE_KEY = 'underfit-development-device-key-change-me'
npm run rebuild
npm start
```

Una instalación configurada puede cargar sus propios valores de usuario: estos pasos son para un entorno limpio. Sin modo API, el escritorio utiliza SQLite y puede abrir `~/GymAppData/gym.db`; no crea una demostración aislada automáticamente.

## Integración PostgreSQL

Crear previamente un servidor y base desechables exclusivos. Las pruebas aplican migraciones y escriben registros:

```powershell
$env:UNDERFIT_TEST_CONNECTION_STRING = 'Host=127.0.0.1;Port=55433;Database=underfit_test;Username=underfit_test;Password=local-test-only'
dotnet test backend/UnderFit.IntegrationTests/UnderFit.IntegrationTests.csproj
```

CI utiliza un servicio efímero con cadena explícita, independiente del gimnasio.

## Datos ficticios

`npm run demo:prepare -- <ruta-absoluta-nueva.db>` crea una SQLite identificada como demo. `npm run demo:seed` requiere `UNDERFIT_REVIEW_DB` apuntando a ella. Los scripts rechazan destinos existentes o sin identificación. Crear esa base no modifica por sí solo la configuración del escritorio.

## CI y compilación

CI ejecuta JavaScript en Windows, copia SQLite con Python, pruebas .NET, integración PostgreSQL 18 y verificación de enlaces Markdown locales. No publica instaladores ni despliega.

`npm run build` compila API y auxiliar USB, prepara FFmpeg y Cloudflare y genera el instalador NSIS en `dist/`. Requiere Windows y red para descargar herramientas. La UI, el USB físico y la instalación/restauración requieren ensayos específicos. Ver [operación](OPERATIONS.md).
