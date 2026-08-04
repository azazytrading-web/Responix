@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\dev-bootstrap.ps1" -Target backend
if errorlevel 1 pause
