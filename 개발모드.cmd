@echo off
REM Dev-mode launcher for In-yeon Paybook. ASCII-only on purpose.
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\dev.ps1"
if errorlevel 1 pause
