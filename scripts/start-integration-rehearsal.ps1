# Local-only integration environment. Never launches Electron or changes its mode.
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$stateDir = Join-Path $env:LOCALAPPDATA 'UnderFitRehearsal'
$dockerExe = Join-Path $env:LOCALAPPDATA 'Programs/DockerDesktop/resources/bin/docker.exe'
$dotnetExe = Join-Path $env:ProgramFiles 'dotnet/dotnet.exe'
$composeFile = Join-Path $repoRoot 'infrastructure/compose/rehearsal.yaml'
$apiProject = Join-Path $repoRoot 'backend/UnderFit.Api/UnderFit.Api.csproj'

if (Get-NetTCPConnection -LocalPort 5189 -State Listen -ErrorAction SilentlyContinue) {
    throw 'Port 5189 is already occupied. No process was stopped or replaced.'
}
New-Item -ItemType Directory -Path $stateDir -Force | Out-Null
$credentialPath = Join-Path $stateDir 'database.credential.xml'
if (Test-Path -LiteralPath $credentialPath) {
    $credential = Import-Clixml -LiteralPath $credentialPath
} else {
    $password = [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
    $credential = [pscredential]::new('underfit', (ConvertTo-SecureString $password -AsPlainText -Force))
    # Windows DPAPI: readable only by this Windows account, not stored in the repo.
    $credential | Export-Clixml -LiteralPath $credentialPath
}

& $dotnetExe build $apiProject --nologo -v quiet
if ($LASTEXITCODE -ne 0) { throw 'API build failed. Database was not started.' }

$overrides = @{
    UNDERFIT_REHEARSAL_PASSWORD = $credential.GetNetworkCredential().Password
    ConnectionStrings__UnderFit = "Host=127.0.0.1;Port=55432;Database=underfit;Username=underfit;Password=$($credential.GetNetworkCredential().Password)"
    Authentication__JwtKey = [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
    Authentication__DeviceKey = [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
    Media__StoragePath = (Join-Path $stateDir 'media')
    ASPNETCORE_URLS = 'http://127.0.0.1:5189'
    ASPNETCORE_ENVIRONMENT = 'Production'
}
$previous = @{}
try {
    foreach ($key in $overrides.Keys) {
        $previous[$key] = [Environment]::GetEnvironmentVariable($key, 'Process')
        [Environment]::SetEnvironmentVariable($key, $overrides[$key], 'Process')
    }
    & $dockerExe compose -f $composeFile up -d --wait --wait-timeout 45
    if ($LASTEXITCODE -ne 0) { throw 'Isolated PostgreSQL startup failed.' }
    $apiDll = Join-Path $repoRoot 'backend/UnderFit.Api/bin/Debug/net10.0/UnderFit.Api.dll'
    $process = Start-Process -FilePath $dotnetExe -ArgumentList @("`"$apiDll`"") `
        -WorkingDirectory (Split-Path $apiProject) -WindowStyle Hidden -PassThru `
        -RedirectStandardOutput (Join-Path $stateDir 'api.stdout.log') `
        -RedirectStandardError (Join-Path $stateDir 'api.stderr.log')
    Write-Output "Rehearsal API starting: PID $($process.Id), http://127.0.0.1:5189. PostgreSQL: localhost:55432."
} finally {
    foreach ($key in $previous.Keys) {
        [Environment]::SetEnvironmentVariable($key, $previous[$key], 'Process')
    }
}
