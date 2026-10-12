$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$desktop = [Environment]::GetFolderPath('Desktop')
$shortcutPath = Join-Path $desktop 'Under-Fit - Abrir pruebas.lnk'
if (Test-Path -LiteralPath $shortcutPath) { throw 'El acceso ya existe; no se sobrescribió.' }
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = (Get-Command pwsh -ErrorAction Stop).Source
$shortcut.Arguments = "-NoProfile -WindowStyle Hidden -File `"$(Join-Path $PSScriptRoot 'open-underfit.ps1')`""
$shortcut.WorkingDirectory = $repo
$shortcut.Description = 'Escritorio + tablet de demostración + servidor aislado. Sin sincronización todavía.'
$shortcut.IconLocation = "$(Join-Path $repo 'assets/icon.ico'),0"
$shortcut.Save()
Write-Output $shortcutPath
