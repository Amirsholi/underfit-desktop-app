param([switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$state = Join-Path $env:LOCALAPPDATA 'UnderFitRehearsal'
New-Item -ItemType Directory -Path $state -Force | Out-Null
$lock = [Threading.Mutex]::new($false, 'Local\UnderFitDevelopmentLauncher')
if (!$lock.WaitOne(0)) { $lock.Dispose(); exit }
$warnings = [Collections.Generic.List[string]]::new()
try {
    $electron = Join-Path $repo 'node_modules/electron/dist/electron.exe'
    $running = @(Get-CimInstance Win32_Process -Filter "Name='electron.exe'" | Where-Object {
        $_.ExecutablePath -eq $electron -and $_.CommandLine -notmatch '--type='
    })
    # Electron's single-instance handler shows the existing window on repeat clicks.
    Start-Process -FilePath $electron -ArgumentList "`"$repo`"" -WorkingDirectory $repo

    $listener = Get-NetTCPConnection -LocalPort 4319 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($listener) {
        $owner = Get-CimInstance Win32_Process -Filter "ProcessId=$($listener.OwningProcess)"
        if ($owner.CommandLine -notlike '*serve-tablet-preview.js*') { throw 'El puerto 4319 está ocupado por otra aplicación.' }
        $tabletHost = $listener.LocalAddress
    } else {
        $route = Get-NetRoute -AddressFamily IPv4 -DestinationPrefix '0.0.0.0/0' | Sort-Object RouteMetric | Select-Object -First 1
        $tabletHost = (Get-NetIPAddress -InterfaceIndex $route.InterfaceIndex -AddressFamily IPv4 | Where-Object { $_.AddressState -eq 'Preferred' } | Select-Object -First 1).IPAddress
        if (!$tabletHost) { throw 'No se encontró una conexión IPv4 para la tablet.' }
        Start-Process -FilePath (Join-Path $env:ProgramFiles 'nodejs/node.exe') `
            -ArgumentList @("`"$(Join-Path $PSScriptRoot 'serve-tablet-preview.js')`"", $tabletHost, '4319') `
            -WorkingDirectory $repo -WindowStyle Hidden `
            -RedirectStandardOutput (Join-Path $state 'tablet.stdout.log') `
            -RedirectStandardError (Join-Path $state 'tablet.stderr.log')
    }
    $tabletUrl = "http://${tabletHost}:4319/"
    $tabletReady = $false
    for ($attempt=0; $attempt -lt 10; $attempt++) {
        try { $tabletReady = (Invoke-WebRequest $tabletUrl -Method Head -TimeoutSec 2).StatusCode -eq 200 } catch {}
        if ($tabletReady) { break }
        Start-Sleep -Milliseconds 500
    }
    if (!$tabletReady) { throw 'La vista de tablet no respondió. Revisá el registro de arranque.' }
    if (!$NoBrowser) { Start-Process $tabletUrl }
    Write-Output "Escritorio abierto. Tablet de demostración: $tabletUrl (sin sincronización todavía)."

    $apiReady = $false
    try { $apiReady = (Invoke-RestMethod 'http://127.0.0.1:5189/health/ready' -TimeoutSec 3).status -eq 'ready' } catch {}
    if (!$apiReady) {
        $docker = Join-Path $env:LOCALAPPDATA 'Programs/DockerDesktop/resources/bin/docker.exe'
        function Test-DockerReady {
            $check = Start-Process -FilePath $docker -ArgumentList @('info','--format','{{.ServerVersion}}') `
                -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $state 'docker-check.log') `
                -RedirectStandardError (Join-Path $state 'docker-check.error.log')
            if (!$check.WaitForExit(4000)) { $check.Kill(); return $false }
            return $check.ExitCode -eq 0
        }
        if (!(Test-DockerReady)) {
            if (!(Get-Process 'Docker Desktop' -ErrorAction SilentlyContinue)) {
                Start-Process -FilePath (Join-Path $env:LOCALAPPDATA 'Programs/DockerDesktop/Docker Desktop.exe') -WindowStyle Hidden
            }
            for ($attempt=0; $attempt -lt 8; $attempt++) {
                if (Test-DockerReady) { break }
                Start-Sleep -Seconds 2
            }
            if (!(Test-DockerReady)) { throw 'Docker no arrancó. Escritorio y tablet están abiertos; abrí Docker Desktop y volvé a usar el acceso directo. No se reseteó Docker.' }
        }
        & (Join-Path $PSScriptRoot 'start-integration-rehearsal.ps1')
        for ($attempt=0; $attempt -lt 15; $attempt++) {
            try { $apiReady = (Invoke-RestMethod 'http://127.0.0.1:5189/health/ready' -TimeoutSec 2).status -eq 'ready' } catch {}
            if ($apiReady) { break }
            Start-Sleep -Seconds 1
        }
        if (!$apiReady) { throw 'La API de ensayo no respondió. Escritorio y tablet siguen abiertos.' }
    }
    Write-Output 'Servidor de ensayo listo. No se importaron ni cambiaron datos.'
} catch {
    $warnings.Add($_.Exception.Message)
    Write-Warning $_.Exception.Message
    Add-Type -AssemblyName System.Windows.Forms
    [Windows.Forms.MessageBox]::Show($_.Exception.Message, 'Under-Fit · Arranque incompleto', 'OK', 'Warning') | Out-Null
} finally {
    $lock.ReleaseMutex()
    $lock.Dispose()
}
if ($warnings.Count) { exit 1 }
