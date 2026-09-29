# 🚀 Social Media Watchtower — Production Deployment Guide

## 📋 Package Contents
This zip archive contains the full, production-ready source code of **Social Media Watchtower**:
- `backend/`: FastAPI backend with all social collectors, sentiment engine, 2FA OTP auth, database, and background schedulers.
- `frontend/`: React + Vite + Tailwind dashboard. The `frontend/dist` directory is **pre-built and compiled**, ready for instant static serving.
- `config/`: Configuration rules for watchlist keywords and alerting thresholds (`watchlist.yaml`, `alerts.yaml`).
- `.env`: Configured production environment variables.
- `docker-compose.yml` & `deploy.sh`: Automated Docker container setup for 1-click launch.
- `start_watchtower.sh`: Lightweight Linux runner script.

---

## ⚡ Option 1: 1-Click Docker Deployment (Recommended)
On your Ubuntu/Debian server:

1. **Unzip the package:**
   ```bash
   unzip social-watchtower-production.zip -d /var/www/social-watchtower
   cd /var/www/social-watchtower
   ```

2. **Run the deployment script:**
   ```bash
   chmod +x deploy.sh
   ./deploy.sh
   ```
   *Docker and Docker Compose will automatically build and launch PostgreSQL, Redis, Backend (port 8000), and Frontend (port 3000).*

3. **Access the portal:**
   - **Frontend Dashboard:** `http://YOUR_SERVER_IP:3000`
   - **Backend API:** `http://YOUR_SERVER_IP:8000`

---

## 🌐 Option 2: Native Ubuntu Server Setup (Nginx + Systemd + SSL)

### Step 1: Install System Packages
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y python3-pip python3-venv git curl nginx certbot python3-certbot-nginx
```

### Step 2: Unzip Project & Setup Backend
```bash
sudo mkdir -p /var/www/social-watchtower
sudo chown -R $USER:$USER /var/www/social-watchtower
unzip social-watchtower-production.zip -d /var/www/social-watchtower
cd /var/www/social-watchtower/backend

python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

### Step 3: Create Systemd Background Service
```bash
sudo nano /etc/systemd/system/watchtower.service
```
Paste this configuration:
```ini
[Unit]
Description=Social Media Watchtower Backend
After=network.target

[Service]
User=root
WorkingDirectory=/var/www/social-watchtower/backend
ExecStart=/var/www/social-watchtower/backend/.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 2
Restart=always
RestartSec=5
EnvironmentFile=/var/www/social-watchtower/.env

[Install]
WantedBy=multi-user.target
```
Enable and start the service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable watchtower
sudo systemctl start watchtower
```

### Step 4: Configure Nginx (Frontend + API Proxy)
```bash
sudo nano /etc/nginx/sites-available/watchtower
```
Paste this configuration (replace `yourdomain.com` with your server IP or domain):
```nginx
server {
    listen 80;
    server_name yourdomain.com; # Replace with domain or server IP

    # Pre-built Frontend Static Files
    location / {
        root /var/www/social-watchtower/frontend/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # Backend API Proxy
    location /api/ {
        proxy_pass http://127.0.0.1:8000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 90s;
    }

    location /health {
        proxy_pass http://127.0.0.1:8000/health;
    }
}
```
Enable site and restart Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/watchtower /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

### Step 5: Enable Free HTTPS (SSL)
```bash
sudo certbot --nginx -d yourdomain.com
```

---

## 🔑 Login & Initial Verification
1. **Open the Dashboard:** Go to `http://YOUR_SERVER_IP` or `https://yourdomain.com`.
2. **Login Credentials:**
   - **Username:** `admin`
   - **OTP:** Dispatched via Telegram bot (`@CMO_Bihar_Monitoring_bot`) and SMS to registered phone.
3. **Change Default Password:**
   - In Dashboard, go to **Settings / User Management** and change Admin password from default `Bihar2026@CM` to your personal strong password.
