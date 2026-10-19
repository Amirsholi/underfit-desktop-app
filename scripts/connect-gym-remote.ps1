param(
    [string]$PublicUrl,
    [string]$UserDataPath = (Join-Path $env:APPDATA 'Under-Fit'),
    [switch]$Preview
)
$ErrorActionPreference = 'Stop'
try {
    Write-Host 'UNDER-FIT - CONECTAR TABLETS POR INTERNET'
    if (!$PublicUrl) {
        $PublicUrl = Read-Host 'Direccion publica confirmada (Enter = https://app.underfituy.com)'
        if (!$PublicUrl) { $PublicUrl = 'https://app.underfituy.com' }
    }
    $configure = Join-Path $PSScriptRoot 'configure-remote-access.ps1'
    if (!(Test-Path -LiteralPath $configure)) { throw 'Extrae primero todos los archivos del ZIP en una carpeta.' }
    # Validate the URL and the existing host configuration without changing either.
    & $configure -PublicUrl $PublicUrl -UserDataPath $UserDataPath -Preview
    if ($Preview) { return }
    $installationPath = Join-Path $UserDataPath 'platform/installation.json'
    $installation = Get-Content -LiteralPath $installationPath -Raw | ConvertFrom-Json
    $health = $installation.apiBaseUrl.TrimEnd('/') + '/health/ready'
    try {
        $response = Invoke-WebRequest -Uri $health -UseBasicParsing -TimeoutSec 15
        if ($response.StatusCode -ne 200) { throw 'Servidor no disponible.' }
    } catch { throw 'Abre Under-Fit y espera a que funcione antes de ejecutar este archivo otra vez.' }
    Write-Host ''
    Write-Host 'El tunel y su ruta deben estar creados en Cloudflare con el origen mostrado arriba.'
    & $configure -PublicUrl $PublicUrl -UserDataPath $UserDataPath
    Write-Host ''
    Write-Host 'LISTO: sal de Under-Fit desde el icono junto al reloj y vuelve a abrirlo cuando no haya operaciones.'
    Write-Host 'Luego prueba la direccion de tablets desde el telefono con datos moviles.'
    Write-Host 'En Configuracion genera un codigo para Tablet 1 y otro para Tablet 2.'
} catch {
    Write-Host ('NO SE COMPLETO: ' + $_.Exception.Message) -ForegroundColor Red
    exit 1
}
