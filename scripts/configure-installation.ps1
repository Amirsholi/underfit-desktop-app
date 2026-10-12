param(
    [Parameter(Mandatory=$true)][ValidateSet('host','client')][string]$Role,
    [string]$ServerUrl,
    [string]$UserDataPath = (Join-Path $env:APPDATA 'Under-Fit'),
    [switch]$ReplaceConfiguration
)
$ErrorActionPreference = 'Stop'
if (!$ServerUrl) {
    if ($Role -eq 'client') { throw 'La PC adicional requiere -ServerUrl https://dominio-del-gym.' }
    $ServerUrl = 'http://127.0.0.1:5187'
}
$uri = $null
if (![Uri]::TryCreate($ServerUrl, [UriKind]::Absolute, [ref]$uri) -or
    $uri.UserInfo -or $uri.Query -or $uri.Fragment -or $uri.AbsolutePath -ne '/') {
    throw 'Indicá una dirección sin credenciales, rutas, parámetros ni fragmentos.'
}
if ($Role -eq 'host' -and ($uri.Scheme -ne 'http' -or !$uri.IsLoopback)) {
    throw 'La PC principal requiere una API HTTP en loopback.'
}
if ($Role -eq 'client' -and $uri.Scheme -ne 'https') { throw 'La PC adicional requiere HTTPS.' }
$platformPath = Join-Path ([IO.Path]::GetFullPath($UserDataPath)) 'platform'
$configPath = Join-Path $platformPath 'installation.json'
if ((Test-Path -LiteralPath $configPath) -and !$ReplaceConfiguration) {
    throw 'La instalación ya está configurada. Revisala antes de usar -ReplaceConfiguration.'
}
New-Item -ItemType Directory -Path $platformPath -Force | Out-Null
# Restrict the directory before writing configuration or credentials. NTFS ACLs,
# rather than POSIX chmod bits, protect local secrets on Windows.
$acl = New-Object Security.AccessControl.DirectorySecurity
$acl.SetAccessRuleProtection($true, $false)
$identities = @([Security.Principal.WindowsIdentity]::GetCurrent().User,
    [Security.Principal.SecurityIdentifier]::new('S-1-5-18'),
    [Security.Principal.SecurityIdentifier]::new('S-1-5-32-544'))
foreach ($identity in $identities) {
    $rule = [Security.AccessControl.FileSystemAccessRule]::new($identity, 'FullControl',
        'ContainerInherit, ObjectInherit', 'None', 'Allow')
    $acl.AddAccessRule($rule)
}
Set-Acl -LiteralPath $platformPath -AclObject $acl
if ($Role -eq 'client') {
    $keyPath = Join-Path $platformPath 'device.key'
    if (!(Test-Path -LiteralPath $keyPath)) {
        $secureKey = Read-Host 'Credencial autorizada por el servidor del gimnasio (no se mostrará)' -AsSecureString
        $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
        try {
            $key = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
            if ($key.Length -lt 32 -or $key.Contains('development')) { throw 'La credencial no es válida.' }
            [IO.File]::WriteAllText($keyPath, $key, [Text.UTF8Encoding]::new($false))
        } finally {
            [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
            $key = $null
            $secureKey.Dispose()
        }
    }
}
if (Test-Path -LiteralPath $configPath) {
    Copy-Item -LiteralPath $configPath -Destination ($configPath + '.' + (Get-Date -Format 'yyyyMMddHHmmssfff') + '.bak')
}
$json = @{role=$Role;apiBaseUrl=$uri.GetLeftPart([UriPartial]::Authority)} | ConvertTo-Json
[IO.File]::WriteAllText($configPath, $json, [Text.UTF8Encoding]::new($false))
Write-Output "Configuración guardada: $configPath"
Write-Output 'No se inició el servidor ni se importaron datos. Falta verificar la conexión y completar la puesta en marcha.'
