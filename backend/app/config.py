import os
from pathlib import Path
from typing import Any, Dict, List, Optional
import yaml
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent.parent
CONFIG_DIR = BASE_DIR / "config"

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(BASE_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

    ENV: str = "development"
    DEBUG: bool = True
    SECRET_KEY: str = "dev-insecure-secret-key-change-in-production-1234567890"
    ALLOWED_ORIGINS: Optional[str] = None
    DATABASE_URL: str = "sqlite+aiosqlite:///./social_watchtower.db"
    REDIS_URL: str = "redis://localhost:6379/0"

    # Privacy & DPDP
    HASH_SALT: str = "bihar-watchtower-dpdp-salt-2026-secure-random"
    COMMENT_RETENTION_DAYS: int = 90

    # AI & Sentiment
    GEMINI_API_KEY: Optional[str] = None
    LLM_PROVIDER: str = "gemini" # gemini | local_fallback
    SENTIMENT_CONFIDENCE_THRESHOLD: float = 0.75

    # Platform API Keys
    YOUTUBE_API_KEY: Optional[str] = None
    YOUTUBE_BACKUP_API_KEY: Optional[str] = None
    TWITTER_BEARER_TOKEN: Optional[str] = None
    TELEGRAM_BOT_TOKEN: Optional[str] = None
    TELEGRAM_CHAT_ID: str = "7566579670"
    TELEGRAM_CHAT_IDS: Optional[str] = None
    META_ACCESS_TOKEN: Optional[str] = None
    META_APP_ID: Optional[str] = None
    META_APP_SECRET: Optional[str] = None
    APIFY_API_TOKEN: Optional[str] = None

    # Alerts & Delivery & Refresh Intervals
    SCHEDULER_INTERVAL_SECONDS: int = 5400 # Legacy fallback
    REFRESH_INTERVAL_FB_INSTA_MINUTES: int = 80   # Facebook & Instagram refresh cycle (80 minutes)
    REFRESH_INTERVAL_OTHER_MINUTES: int = 10       # Other platforms (YouTube, Twitter, RSS, etc.) (10 minutes)
    ALERT_WEBHOOK_URL: Optional[str] = None
    ALERT_EMAIL_SMTP_HOST: Optional[str] = None
    ALERT_EMAIL_USER: Optional[str] = None
    ALERT_EMAIL_PASSWORD: Optional[str] = None

    # Mobile SMS Gateway for OTP Login
    SMS_GATEWAY_PROVIDER: str = "auto" # fast2sms | twilio | msg91 | custom | local_log
    FAST2SMS_API_KEY: Optional[str] = None
    TWILIO_ACCOUNT_SID: Optional[str] = None
    TWILIO_AUTH_TOKEN: Optional[str] = None
    TWILIO_FROM_NUMBER: Optional[str] = None
    MSG91_AUTH_KEY: Optional[str] = None
    MSG91_TEMPLATE_ID: Optional[str] = None
    CUSTOM_SMS_URL: Optional[str] = None

    # Config files caching
    _watchlist_cache: Optional[Dict[str, Any]] = None
    _alerts_cache: Optional[Dict[str, Any]] = None

    def get_watchlist_config(self) -> Dict[str, Any]:
        if self._watchlist_cache is None:
            config_path = CONFIG_DIR / "watchlist.yaml"
            if config_path.exists():
                with open(config_path, "r", encoding="utf-8") as f:
                    self._watchlist_cache = yaml.safe_load(f) or {}
            else:
                self._watchlist_cache = {
                    "keywords": {"primary": ["Samrat Choudhary", "सम्राट चौधरी", "Bihar CM"]},
                    "official_handles": [],
                    "labels": ["official", "supporter", "opposition", "news-media", "neutral"]
                }
        return self._watchlist_cache

    def get_alerts_config(self) -> Dict[str, Any]:
        if self._alerts_cache is None:
            config_path = CONFIG_DIR / "alerts.yaml"
            if config_path.exists():
                with open(config_path, "r", encoding="utf-8") as f:
                    self._alerts_cache = yaml.safe_load(f) or {}
            else:
                self._alerts_cache = {
                    "critical_thresholds": {
                        "negative_comments": {"enabled": True, "base_threshold": 500, "milestone_step": 500}
                    },
                    "velocity_thresholds": {
                        "negative_comment_burst": {"enabled": True, "threshold_count": 100, "window_minutes": 30}
                    }
                }
        return self._alerts_cache

settings = Settings()
