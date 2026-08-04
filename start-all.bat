@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\dev-bootstrap.ps1" -Target all
if errorlevel 1 pause
