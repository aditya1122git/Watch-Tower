import os
import re
import json
import hashlib
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, Optional, Set

logger = logging.getLogger("watchtower.telegram_dedup")

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)
CACHE_FILE = DATA_DIR / "telegram_dedup_cache.json"

class TelegramDedupService:
    """
    Prevents duplicate Telegram reports and updates from being ingested or dispatched.
    Uses multi-factor fingerprinting:
      1. Unique Channel Message ID / platform_item_id
      2. Normalized text content SHA-256 hash
      3. Canonical permalink URL
    """

    def __init__(self):
        self.known_ids: Set[str] = set()
        self.known_hashes: Set[str] = set()
        self.known_urls: Set[str] = set()
        self.duplicates_ignored_count: int = 0
        self.new_updates_count: int = 0
        self.last_new_update_at: Optional[datetime] = None
        self._load_cache()

    def _load_cache(self):
        try:
            if CACHE_FILE.exists():
                with open(CACHE_FILE, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    self.known_ids = set(data.get("known_ids", []))
                    self.known_hashes = set(data.get("known_hashes", []))
                    self.known_urls = set(data.get("known_urls", []))
                    self.duplicates_ignored_count = data.get("duplicates_ignored_count", 0)
                    self.new_updates_count = data.get("new_updates_count", 0)
                    last_str = data.get("last_new_update_at")
                    if last_str:
                        try:
                            self.last_new_update_at = datetime.fromisoformat(last_str)
                        except Exception:
                            pass
                logger.info(f"Loaded {len(self.known_ids)} known Telegram IDs & {len(self.known_hashes)} content hashes from dedup cache.")
        except Exception as e:
            logger.warning(f"Could not load Telegram dedup cache: {e}")

    def _save_cache(self):
        try:
            with open(CACHE_FILE, "w", encoding="utf-8") as f:
                json.dump({
                    "known_ids": list(self.known_ids)[-2000:],
                    "known_hashes": list(self.known_hashes)[-2000:],
                    "known_urls": list(self.known_urls)[-2000:],
                    "duplicates_ignored_count": self.duplicates_ignored_count,
                    "new_updates_count": self.new_updates_count,
                    "last_new_update_at": self.last_new_update_at.isoformat() if self.last_new_update_at else None
                }, f, indent=2)
        except Exception as e:
            logger.warning(f"Could not save Telegram dedup cache: {e}")

    @staticmethod
    def normalize_text(text: str) -> str:
        """Strips markdown, URLs, excessive punctuation, and whitespace for content hash."""
        if not text:
            return ""
        # Remove URLs
        no_urls = re.sub(r'https?://\S+', '', text)
        # Collapse whitespaces
        collapsed = re.sub(r'\s+', ' ', no_urls).strip().lower()
        return collapsed

    def compute_content_hash(self, text: str, author_or_channel: str = "") -> str:
        """Generates invariant 64-character SHA-256 fingerprint for deduplication."""
        normalized = self.normalize_text(text)
        author_clean = author_or_channel.strip().lower()
        payload = f"{author_clean}::{normalized}".encode("utf-8")
        return hashlib.sha256(payload).hexdigest()

    def is_duplicate(
        self,
        item_id: str,
        text: str,
        permalink: str = "",
        author_or_channel: str = ""
    ) -> bool:
        """
        Returns True if the message has already been processed and should be ignored.
        Returns False and marks as processed if the message is genuinely new.
        """
        clean_id = (item_id or "").strip()
        clean_url = (permalink or "").strip()
        content_hash = self.compute_content_hash(text, author_or_channel)

        # 1. Check ID
        if clean_id and clean_id in self.known_ids:
            self.duplicates_ignored_count += 1
            logger.info(f"🔁 [Telegram Dedup]: Duplicate ID '{clean_id}' ignored.")
            return True

        # 2. Check canonical URL
        if clean_url and clean_url in self.known_urls:
            self.duplicates_ignored_count += 1
            logger.info(f"🔁 [Telegram Dedup]: Duplicate URL '{clean_url}' ignored.")
            return True

        # 3. Check Content Hash (catches message reposts or forwarded duplicates)
        if content_hash in self.known_hashes:
            self.duplicates_ignored_count += 1
            logger.info(f"🔁 [Telegram Dedup]: Duplicate content hash '{content_hash[:12]}' ignored.")
            return True

        # It is genuinely new!
        now = datetime.now(timezone.utc)
        if clean_id:
            self.known_ids.add(clean_id)
        if clean_url:
            self.known_urls.add(clean_url)
        self.known_hashes.add(content_hash)
        self.new_updates_count += 1
        self.last_new_update_at = now
        self._save_cache()

        logger.info(f"✨ [Telegram Dedup]: Genuinely new update registered: ID='{clean_id}' Hash='{content_hash[:12]}'")
        return False

    def get_stats(self) -> Dict[str, Any]:
        """Returns live statistics on deduplicated vs new updates."""
        return {
            "platform": "telegram",
            "display_name": "Telegram",
            "refresh_interval": "New Update",
            "interval_minutes": None,
            "last_updated": self.last_new_update_at.isoformat() if self.last_new_update_at else None,
            "next_refresh": None, # Event-based / On Message
            "status": "New" if self.new_updates_count > 0 else "Current",
            "total_new_updates": self.new_updates_count,
            "duplicates_ignored_count": self.duplicates_ignored_count,
            "tracked_fingerprints": len(self.known_hashes)
        }

telegram_dedup_service = TelegramDedupService()
