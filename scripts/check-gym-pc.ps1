param([string]$OutputPath = (Join-Path ([Environment]::GetFolderPath('Desktop')) 'UnderFit-PC.json'))
$ErrorActionPreference = 'Stop'
$system = Get-CimInstance Win32_ComputerSystem
$osInfo = Get-CimInstance Win32_OperatingSystem
$processor = Get-CimInstance Win32_Processor | Select-Object -First 1
$disk = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='$($env:SystemDrive)'"
$warnings = [Collections.Generic.List[string]]::new()
$ramGiB = [Math]::Round($system.TotalPhysicalMemory / 1GB, 1)
if ($ramGiB -lt 7.5) { $warnings.Add('Menos de 8 GB de RAM; revisar el alojamiento local antes de instalar.') }
elseif ($ramGiB -lt 12) { $warnings.Add('8 GB: realizar una prueba de carga con escritorio, PostgreSQL y las dos tablets.') }
if (!$system.HypervisorPresent -and !$processor.VirtualizationFirmwareEnabled) {
    $warnings.Add('Virtualización no confirmada; revisar BIOS/UEFI y WSL 2.')
}
if ([int]$osInfo.BuildNumber -lt 22000) { $warnings.Add('Windows 10: confirmar soporte de Windows y Docker antes de desplegar.') }
if ($disk.FreeSpace -lt 20GB) { $warnings.Add('Menos de 20 GB libres: revisar espacio para Docker, medios y respaldos (umbral de planificación).') }
$dockerPaths = @(
    (Join-Path $env:LOCALAPPDATA 'Programs\DockerDesktop\resources\bin\docker.exe'),
    (Join-Path $env:ProgramFiles 'Docker\Docker\resources\bin\docker.exe'))
$dockerCommand = Get-Command docker.exe -ErrorAction SilentlyContinue
if ($dockerCommand) { $dockerPaths += $dockerCommand.Source }
$dockerPresent = @($dockerPaths | Where-Object { Test-Path -LiteralPath $_ }).Count -gt 0
if (!$dockerPresent) { $warnings.Add('Docker no encontrado. Falta instalarlo, configurar el arranque y verificar el motor.') }
$report = [ordered]@{
    generatedAtUtc = [DateTime]::UtcNow.ToString('o')
    windows = @{caption=$osInfo.Caption;version=$osInfo.Version;build=$osInfo.BuildNumber;architecture=$osInfo.OSArchitecture}
    ramGiB = $ramGiB
    processor = @{name=$processor.Name;cores=$processor.NumberOfCores;virtualizationFirmware=$processor.VirtualizationFirmwareEnabled;slat=$processor.SecondLevelAddressTranslationExtensions}
    hypervisorPresent = $system.HypervisorPresent
    systemDiskFreeGiB = [Math]::Round($disk.FreeSpace / 1GB, 1)
    dockerExecutableFound = $dockerPresent
    wslExecutableFound = [bool](Get-Command wsl.exe -ErrorAction SilentlyContinue)
    defaultSqliteExists = Test-Path -LiteralPath (Join-Path $env:USERPROFILE 'GymAppData\gym.db')
    warnings = @($warnings.ToArray())
    status = 'inventory-only-not-installation-approval'
}
$destination = [IO.Path]::GetFullPath($OutputPath)
if (Test-Path -LiteralPath $destination) { throw 'El informe ya existe; indicá otro -OutputPath para no sobrescribirlo.' }
$parent = Split-Path -Parent $destination
if (!(Test-Path -LiteralPath $parent)) { New-Item -ItemType Directory -Path $parent | Out-Null }
$report | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $destination -Encoding UTF8
Write-Output "Informe: $destination"
Write-Output 'Solo se consultó el equipo. No se leyó el contenido de la base ni se modificó Windows.'
