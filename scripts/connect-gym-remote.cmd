@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0connect-gym-remote.ps1"
if errorlevel 1 (
  echo La configuracion no se completo. Conserva el mensaje de arriba para revisarlo.
)
pause
