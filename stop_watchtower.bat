@echo off
chcp 65001 >nul
title Stop Social Media Watchtower
color 0C

echo Stopping Watchtower Backend (Port 8000) and Frontend (Port 3000)...

:: Kill process listening on port 8000 (Backend)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8000 ^| findstr LISTENING') do (
    taskkill /f /pid %%a 2>nul
)

:: Kill process listening on port 3000 (Frontend)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING') do (
    taskkill /f /pid %%a 2>nul
)

echo.
echo All Watchtower processes have been stopped successfully.
pause
