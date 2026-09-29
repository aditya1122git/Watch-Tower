@echo off
title Social Media Watchtower - Bihar CM Samrat Choudhary
echo ======================================================================
echo Starting Social Media Watchtower (CM Samrat Choudhary)...
echo ======================================================================

cd /d "%~dp0"

echo [1/2] Starting FastAPI Backend on port 8000...
start "Watchtower Backend API" cmd /k "cd backend && .venv\Scripts\activate && uvicorn app.main:app --host 0.0.0.0 --port 8000"

timeout /t 3 /nobreak >nul

echo [2/2] Starting Vite Frontend on port 3000...
start "Watchtower Frontend" cmd /k "cd frontend && npm run dev -- --host 0.0.0.0 --port 3000"

timeout /t 3 /nobreak >nul

echo ======================================================================
echo Watchtower is now running!
echo - Frontend UI:  http://localhost:3000
echo - Backend API:  http://localhost:8000
echo - Swagger Docs: http://localhost:8000/docs
echo ======================================================================

start http://localhost:3000
