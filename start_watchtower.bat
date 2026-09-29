@echo off
chcp 65001 >nul
title Social Media Watchtower - CM Samrat Choudhary
color 0A

echo =========================================================================
echo   SOCIAL MEDIA WATCHTOWER - CM SAMRAT CHOUDHARY
echo   Automated 24x7 Sentiment Intelligence & Crisis Early Warning
echo =========================================================================
echo.

cd /d "%~dp0"

:: 1. Start Backend in Background Window
echo [1/3] Starting Backend Server & Background Auto-Scheduler (Port 8000)...
start "Watchtower Backend" /min cmd /c "cd /d %~dp0backend && .\.venv\Scripts\uvicorn.exe app.main:app --host 0.0.0.0 --port 8000"

:: Small wait for backend to boot
timeout /t 3 /nobreak >nul

:: 2. Start Frontend
echo [2/3] Starting Frontend Dashboard (Port 3000)...
start "Watchtower Frontend" /min cmd /c "cd /d %~dp0frontend && npm run dev -- --host 0.0.0.0 --port 3000"

:: Wait for frontend to initialize
timeout /t 3 /nobreak >nul

:: 3. Launch Browser
echo [3/3] Launching Web Dashboard in Browser...
start http://localhost:3000

echo.
echo =========================================================================
echo   SUCCESS! Social Media Watchtower is running!
echo   - Web Dashboard:     http://localhost:3000
echo   - Backend & API:     http://localhost:8000
echo   - Automated Engine:  Running continuously (Auto-refresh every 60s)
echo   - Telegram Alerts:   Active for @Rajnish517
echo.
echo   To stop all services, run 'stop_watchtower.bat' or close the windows.
echo =========================================================================
pause
