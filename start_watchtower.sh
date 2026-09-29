#!/usr/bin/env bash
# =========================================================================
# Social Media Watchtower - Quick Linux Server Launcher
# =========================================================================
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$DIR"

echo "=== Starting Social Media Watchtower ==="

# 1. Check Python virtual environment
if [ ! -d "backend/.venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv backend/.venv
    backend/.venv/bin/pip install --upgrade pip
    backend/.venv/bin/pip install -r backend/requirements.txt
fi

# 2. Check .env
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo "Created .env from .env.example"
    fi
fi

# 3. Start Backend in background
echo "Starting FastAPI Backend on port 8000..."
nohup backend/.venv/bin/uvicorn app.main:app --app-dir "$DIR/backend" --host 0.0.0.0 --port 8000 > "$DIR/backend/backend.log" 2>&1 &
BACKEND_PID=$!
echo "Backend running with PID $BACKEND_PID (Logs: backend/backend.log)"

echo ""
echo "=== Watchtower Running! ==="
echo "Backend API:  http://localhost:8000"
echo "Frontend:     Serve 'frontend/dist' via Nginx or run: npx serve -s frontend/dist -p 3000"
echo "To stop:      kill $BACKEND_PID"
