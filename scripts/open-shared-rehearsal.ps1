$ErrorActionPreference = 'Stop'
try {
    $node = Join-Path $env:ProgramFiles 'nodejs\node.exe'
    if (!(Test-Path -LiteralPath $node)) { throw 'No se encontró Node.js para iniciar el ensayo.' }
    $launcher = Join-Path $PSScriptRoot 'open-shared-rehearsal.js'
    $output = & $node $launcher 2>&1
    if ($LASTEXITCODE -ne 0) { throw ($output | Out-String).Trim() }
} catch {
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.MessageBox]::Show($_.Exception.Message, 'No se pudo abrir Under-Fit', 'OK', 'Error') | Out-Null
    exit 1
}
