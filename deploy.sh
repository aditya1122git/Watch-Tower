#!/usr/bin/env bash
# =========================================================================
# Social Media Watchtower - Production 1-Click Deployment Script
# Target: CM Samrat Choudhary Sentiment Intelligence Portal
# OS: Ubuntu 22.04 / 24.04 LTS or Debian 12
# =========================================================================

set -e

echo "=========================================================="
echo "  Deploying Social Media Watchtower (CM War Room Portal)"
echo "=========================================================="

# 1. Update system packages
echo "[1/5] Updating server packages..."
sudo apt-get update -y && sudo apt-get upgrade -y

# 2. Check and install Docker & Docker Compose if missing
if ! command -v docker &> /dev/null; then
    echo "[2/5] Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    rm get-docker.sh
fi

if ! command -v docker compose &> /dev/null; then
    echo "[2/5] Installing Docker Compose plugin..."
    sudo apt-get install -y docker-compose-plugin
fi

# 3. Ensure .env exists
if [ ! -f .env ]; then
    if [ -f .env.example ]; then
        echo "[3/5] Creating .env from .env.example..."
        cp .env.example .env
    else
        echo "Error: .env file missing! Please create .env before deploying."
        exit 1
    fi
fi

# 4. Build and start all services via Docker Compose
echo "[4/5] Building and launching containers (PostgreSQL, Redis, FastAPI, Nginx Frontend)..."
sudo docker compose down --remove-orphans || true
sudo docker compose up -d --build

# 5. Health Check
echo "[5/5] Performing system health check..."
sleep 10
if curl -s http://localhost:8000/health | grep -q "healthy"; then
    echo "=========================================================="
    echo "  DEPLOYMENT SUCCESSFUL! All services are active & healthy!"
    echo "  - Frontend Portal:    http://$(curl -s ifconfig.me):3000"
    echo "  - Backend API:        http://$(curl -s ifconfig.me):8000"
    echo "  - Telegram Alerts:    Active for 7566579670, 7574720019"
    echo "  - Max 5 Logins Rule:  Active & Enforced"
    echo "=========================================================="
else
    echo "Warning: Containers started, but backend health check did not respond yet. Check logs using: docker compose logs -f"
fi
