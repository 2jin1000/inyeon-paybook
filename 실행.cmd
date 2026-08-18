@echo off
REM Launcher for In-yeon Paybook.
REM Kept ASCII-only on purpose: cmd.exe mis-parses non-ASCII batch files.
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start.ps1"
if errorlevel 1 pause
