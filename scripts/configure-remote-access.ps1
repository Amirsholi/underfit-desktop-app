param(
    [Parameter(Mandatory=$true)][string]$PublicUrl,
    [string]$UserDataPath = (Join-Path $env:APPDATA 'Under-Fit'),
    [switch]$Preview,
    [switch]$ReplaceConfiguration
)
$ErrorActionPreference = 'Stop'
$uri = $null
if (![Uri]::TryCreate($PublicUrl, [UriKind]::Absolute, [ref]$uri) -or
    $uri.Scheme -ne 'https' -or $uri.IsLoopback -or $uri.UserInfo -or
    $uri.Query -or $uri.Fragment -or $uri.AbsolutePath -ne '/' -or !$uri.IsDefaultPort) {
    throw 'Indicá la dirección HTTPS pública, sin rutas, claves ni puerto. Ejemplo: https://app.tu-dominio.com'
}
$platformPath = Join-Path ([IO.Path]::GetFullPath($UserDataPath)) 'platform'
$installationPath = Join-Path $platformPath 'installation.json'
if (!(Test-Path -LiteralPath $installationPath)) { throw 'Primero configurá esta PC como servidor principal.' }
$installation = Get-Content -LiteralPath $installationPath -Raw | ConvertFrom-Json
$origin = $null
if ($installation.role -ne 'host' -or
    ![Uri]::TryCreate($installation.apiBaseUrl, [UriKind]::Absolute, [ref]$origin) -or
    $origin.Scheme -ne 'http' -or !$origin.IsLoopback -or $origin.UserInfo -or
    $origin.Query -or $origin.Fragment -or $origin.AbsolutePath -ne '/') {
    throw 'El acceso remoto se configura únicamente en la PC principal con API local.'
}
$publicOrigin = $uri.GetLeftPart([UriPartial]::Authority)
Write-Output "En Cloudflare, creá un túnel para este gimnasio y una ruta pública:"
Write-Output "Nombre: $($uri.Host)"
Write-Output "Servicio de origen: $($origin.GetLeftPart([UriPartial]::Authority))"
Write-Output "Dirección de las tablets: $publicOrigin/tablet/"
if ($Preview) { Write-Output 'Vista previa: no se guardó ni inició ninguna conexión.'; return }

$tokenPath = Join-Path $platformPath 'tunnel.token'
$remotePath = Join-Path $platformPath 'remote-access.json'
if (((Test-Path -LiteralPath $tokenPath) -or (Test-Path -LiteralPath $remotePath)) -and !$ReplaceConfiguration) {
    throw 'Ya existe configuración remota. Revisala antes de usar -ReplaceConfiguration.'
}
# Apply the same private directory permissions used by configure-installation.
$acl = New-Object Security.AccessControl.DirectorySecurity
$acl.SetAccessRuleProtection($true, $false)
foreach ($identity in @([Security.Principal.WindowsIdentity]::GetCurrent().User,
    [Security.Principal.SecurityIdentifier]::new('S-1-5-18'),
    [Security.Principal.SecurityIdentifier]::new('S-1-5-32-544'))) {
    $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($identity, 'FullControl',
        'ContainerInherit, ObjectInherit', 'None', 'Allow'))
}
Set-Acl -LiteralPath $platformPath -AclObject $acl
$secureToken = Read-Host 'Pegá solo el token del túnel, no el comando completo (no se mostrará)' -AsSecureString
$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureToken)
try {
    $token = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer).Trim()
    if ($token.Length -lt 64 -or $token -notmatch '^[A-Za-z0-9_+/=-]+$') { throw 'El token no tiene el formato esperado.' }
    [IO.File]::WriteAllText($tokenPath, $token, [Text.UTF8Encoding]::new($false))
    $settings = @{publicUrl=$publicOrigin;tabletUrl="$publicOrigin/tablet/";configuredAtUtc=[DateTime]::UtcNow.ToString('o')} | ConvertTo-Json
    [IO.File]::WriteAllText($remotePath, $settings, [Text.UTF8Encoding]::new($false))
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
    $token = $null
    $secureToken.Dispose()
}
Write-Output 'Configuración guardada. Reiniciá Under-Fit para iniciar el túnel.'
Write-Output 'Falta comprobar la dirección desde otra conexión a Internet y verificar el arranque después de reiniciar la PC.'
