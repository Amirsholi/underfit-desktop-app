@echo off
title Under-Fit - Comprobar PC
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0check-gym-pc.ps1"
echo.
echo Esta comprobacion no instala programas ni modifica los datos del gimnasio.
pause
