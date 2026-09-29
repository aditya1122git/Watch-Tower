import logging
import re
import html
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List, Set
import httpx
from app.config import settings

logger = logging.getLogger(__name__)

class TelegramAlertService:
    """
    Dispatches real-time crisis and negative sentiment alerts directly to Telegram
    in the exact format requested by the user:

    Watch-Tower                                Admin
    🔴 ALERT — {Platform} — Samrat Choudhary Ji

    Views: 13.3K
    Sentiment: NEGATIVE
    Account: {Author Name}

    {Post Title / Text}

    🔗 View on {Platform}
    """

    def __init__(self):
        self.bot_token: Optional[str] = settings.TELEGRAM_BOT_TOKEN
        raw_ids = getattr(settings, "TELEGRAM_CHAT_IDS", None) or getattr(settings, "TELEGRAM_CHAT_ID", "7566579670, 7574720019") or "7566579670, 7574720019"
        self.target_chat_ids: List[str] = self._parse_chat_ids(raw_ids)
        self._cached_numeric_chat_ids: Dict[str, str] = {
            "7566579670": "7566579670",
            "7574720019": "7574720019",
            "rajnish517": "7574720019"
        }
        import os
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        self._alert_cache_file = os.path.join(base_dir, "data", "alerted_posts_cache.json")
        self._alerted_post_ids: Set[int] = set()
        self._alerted_urls: Set[str] = set()
        self._alerted_hashes: Set[str] = set()
        self._load_alert_cache()
        self.dispatched_history: List[Dict[str, Any]] = []

    def _load_alert_cache(self):
        import os, json
        try:
            if os.path.exists(self._alert_cache_file):
                with open(self._alert_cache_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    self._alerted_post_ids = set(data.get("post_ids", []))
                    self._alerted_urls = set(data.get("urls", []))
                    self._alerted_hashes = set(data.get("hashes", []))
        except Exception as e:
            logger.warning(f"Could not load alert cache: {e}")

    def _save_alert_cache(self):
        import os, json
        try:
            os.makedirs("data", exist_ok=True)
            with open(self._alert_cache_file, "w", encoding="utf-8") as f:
                json.dump({
                    "post_ids": list(self._alerted_post_ids)[-500:],
                    "urls": list(self._alerted_urls)[-500:],
                    "hashes": list(self._alerted_hashes)[-500:]
                }, f, indent=2)
        except Exception as e:
            logger.warning(f"Could not save alert cache: {e}")

    @property
    def target_chat_id(self) -> str:
        return ", ".join(self.target_chat_ids) if self.target_chat_ids else "7566579670"

    @target_chat_id.setter
    def target_chat_id(self, val: Any):
        self.target_chat_ids = self._parse_chat_ids(val)

    def _parse_chat_ids(self, val: Any) -> List[str]:
        if not val:
            return ["7566579670", "7574720019"]
        if isinstance(val, list):
            res = [str(x).strip() for x in val if str(x).strip()]
            return res if res else ["7566579670", "7574720019"]
        tokens = re.split(r'[,;\s]+', str(val).strip())
        res = [t.strip() for t in tokens if t.strip()]
        return res if res else ["7566579670", "7574720019"]

    def update_config(self, bot_token: Optional[str] = None, target_chat_id: Optional[str] = None, target_chat_ids: Optional[List[str]] = None):
        if bot_token is not None:
            self.bot_token = bot_token.strip()
        if target_chat_ids is not None:
            self.target_chat_ids = self._parse_chat_ids(target_chat_ids)
        elif target_chat_id is not None:
            self.target_chat_ids = self._parse_chat_ids(target_chat_id)

    def add_recipient(self, chat_id: str):
        c_id = chat_id.strip()
        if c_id and c_id not in self.target_chat_ids:
            self.target_chat_ids.append(c_id)

    def remove_recipient(self, chat_id: str):
        c_id = chat_id.strip()
        if c_id in self.target_chat_ids:
            self.target_chat_ids.remove(c_id)

    def _format_views(self, views: int) -> str:
        if not views or views <= 0:
            return "1.2K"
        if views >= 1_000_000:
            return f"{views / 1_000_000:.1f}M"
        if views >= 1_000:
            return f"{views / 1_000:.1f}K"
        return str(views)

    def _get_platform_display(self, platform: str) -> str:
        plat = platform.lower()
        if plat == "youtube":
            return "YouTube"
        elif plat == "twitter":
            return "Twitter (X)"
        elif plat == "facebook":
            return "Facebook"
        elif plat == "instagram":
            return "Instagram"
        elif plat == "rss":
            return "News Media"
        elif plat == "reddit":
            return "Reddit"
        elif plat == "mastodon":
            return "Mastodon"
        elif plat == "telegram":
            return "Telegram"
        elif plat == "wikipedia":
            return "Wikipedia"
        return platform.capitalize()

    def format_alert_message_html(self, post_data: Dict[str, Any]) -> str:
        platform_name = self._get_platform_display(post_data.get("platform", "YouTube"))
        views_str = self._format_views(post_data.get("views", 0))
        account_name = html.escape(post_data.get("author_name") or "Public Author")
        text = html.escape(post_data.get("text", "")).strip()
        permalink = post_data.get("permalink_url") or "#"

        # Format matches user's reference screenshot exactly with direct link
        msg = (
            f"<b>Watch-Tower</b>                                <i>Admin</i>\n"
            f"🔴 <b>ALERT — {platform_name} — Samrat Choudhary Ji</b>\n\n"
            f"<b>Views:</b> {views_str}\n"
            f"<b>Sentiment:</b> NEGATIVE\n"
            f"<b>Account:</b> {account_name}\n\n"
            f"{text}\n\n"
            f"<a href=\"{permalink}\">🔗 <b>View on {platform_name}</b></a>\n"
            f"<b>Direct Link:</b> {permalink}"
        )
        return msg

    def format_alert_message_plain(self, post_data: Dict[str, Any]) -> str:
        platform_name = self._get_platform_display(post_data.get("platform", "YouTube"))
        views_str = self._format_views(post_data.get("views", 0))
        account_name = post_data.get("author_name") or "Public Author"
        text = post_data.get("text", "").strip()
        permalink = post_data.get("permalink_url") or ""

        return (
            f"Watch-Tower                                Admin\n"
            f"🔴 ALERT — {platform_name} — Samrat Choudhary Ji\n\n"
            f"Views: {views_str}\n"
            f"Sentiment: NEGATIVE\n"
            f"Account: {account_name}\n\n"
            f"{text}\n\n"
            f"🔗 View on {platform_name}: {permalink}"
        )

    async def _resolve_numeric_chat_id(self, client: httpx.AsyncClient, token: str, target: str) -> str:
        """Resolves target handle/ID to numeric chat_id using cache or bot getUpdates."""
        clean = target.strip()
        if re.match(r'^-?\d+$', clean):
            return clean

        key = clean.lstrip("@").lower()
        if key in self._cached_numeric_chat_ids:
            return self._cached_numeric_chat_ids[key]

        url = f"https://api.telegram.org/bot{token}/getUpdates"
        try:
            resp = await client.get(url, timeout=8.0)
            if resp.status_code == 200:
                data = resp.json()
                for update in data.get("result", []):
                    msg = update.get("message") or update.get("channel_post") or update.get("my_chat_member")
                    if not msg:
                        continue
                    chat = msg.get("chat", {})
                    user = msg.get("from", {})
                    chat_username = (chat.get("username") or "").lower()
                    user_username = (user.get("username") or "").lower()

                    if chat_username == key or user_username == key:
                        c_id = str(chat.get("id"))
                        self._cached_numeric_chat_ids[key] = c_id
                        logger.info(f"Resolved Telegram chat_id for @{key} -> {c_id}")
                        return c_id
        except Exception as e:
            logger.warning(f"Failed to check Telegram getUpdates: {e}")

        return clean

    async def send_message(self, html_text: str, plain_text: str, custom_token: Optional[str] = None, custom_chat_id: Optional[str] = None) -> Dict[str, Any]:
        token = custom_token or self.bot_token
        targets = self._parse_chat_ids(custom_chat_id) if custom_chat_id else self.target_chat_ids

        if not token:
            logger.warning(f"[TELEGRAM ALERT SIMULATED - NO BOT TOKEN]: Dispatched to {targets}\n{plain_text}")
            return {
                "status": "pending_token",
                "message": f"Alert formatted for Telegram {', '.join(targets)}, waiting for BOT TOKEN.",
                "preview": plain_text,
                "target": ", ".join(targets),
                "targets": targets
            }

        results: List[Dict[str, Any]] = []
        async with httpx.AsyncClient(timeout=10.0) as client:
            for tgt in targets:
                effective_chat_id = await self._resolve_numeric_chat_id(client, token, tgt)
                url = f"https://api.telegram.org/bot{token}/sendMessage"
                payload = {
                    "chat_id": effective_chat_id,
                    "text": html_text,
                    "parse_mode": "HTML",
                    "disable_web_page_preview": False
                }

                try:
                    resp = await client.post(url, json=payload)
                    if resp.status_code == 200:
                        data = resp.json()
                        logger.info(f"Telegram alert sent successfully to {effective_chat_id} (target: {tgt})")
                        results.append({
                            "target": tgt,
                            "chat_id": effective_chat_id,
                            "status": "success",
                            "message_id": data.get("result", {}).get("message_id")
                        })
                    else:
                        err_json = resp.json()
                        desc = err_json.get("description", "Unknown error")
                        logger.warning(f"Telegram sendMessage to {effective_chat_id} failed ({resp.status_code}): {desc}")

                        # Fallback to plain text if HTML parsing caused 400
                        if "can't parse entities" in desc.lower():
                            payload["text"] = plain_text
                            payload.pop("parse_mode", None)
                            retry_resp = await client.post(url, json=payload)
                            if retry_resp.status_code == 200:
                                results.append({
                                    "target": tgt,
                                    "chat_id": effective_chat_id,
                                    "status": "success",
                                    "fallback": "plain_text"
                                })
                                continue

                        results.append({
                            "target": tgt,
                            "chat_id": effective_chat_id,
                            "status": "error",
                            "error_code": resp.status_code,
                            "description": desc,
                            "help": f"Recipient '{tgt}' must start the bot (@CMO_Bihar_Monitoring_bot) first by clicking /start, or provide their numeric chat ID."
                        })
                except Exception as e:
                    logger.error(f"Error connecting to Telegram API for {tgt}: {e}")
                    results.append({
                        "target": tgt,
                        "status": "network_error",
                        "error": str(e)
                    })

        successful = [r for r in results if r.get("status") == "success"]
        is_overall_success = len(successful) > 0
        return {
            "status": "success" if is_overall_success else "error",
            "delivered_count": len(successful),
            "total_recipients": len(results),
            "sent_at": datetime.now(timezone.utc).isoformat(),
            "target": ", ".join(targets),
            "targets": targets,
            "details": results
        }

    async def dispatch_negative_post_alert(self, post) -> Optional[Dict[str, Any]]:
        """
        Dispatches negative post alert if post has negative sentiment or is flagged,
        deduplicating to avoid repeat alerts for the same post ID.
        """
        # Determine if this post requires an alert
        is_negative = (
            getattr(post, "sentiment_verdict", None) in ["Negative", "Needs Review"] or
            (getattr(post, "sentiment_score", 0) <= -20) or
            getattr(post, "alert_flag", False) or
            (getattr(post, "negative_comment_count", 0) >= 20)
        )

        if not is_negative:
            return None

        import hashlib
        from app.services.link_service import normalize_url

        post_id = getattr(post, "id", None)
        permalink = getattr(post, "permalink_url", "") or ""
        clean_url = normalize_url(permalink)
        post_text = getattr(post, "text", "") or ""
        text_fingerprint = hashlib.sha256(post_text.strip().encode("utf-8", errors="ignore")).hexdigest()[:16]

        # Strict Multi-Level Deduplication to prevent repeat alerts
        if getattr(post, "alert_flag", False) is True:
            return None
        if post_id and post_id in self._alerted_post_ids:
            return None
        if clean_url and clean_url in self._alerted_urls:
            return None
        if text_fingerprint and text_fingerprint in self._alerted_hashes:
            return None

        post_data = {
            "id": post_id,
            "platform": getattr(post, "platform", "youtube"),
            "author_name": getattr(post, "author_name", "Public Account"),
            "author_handle": getattr(post, "author_handle", ""),
            "views": getattr(post, "views", 0),
            "text": post_text,
            "permalink_url": permalink
        }

        html_msg = self.format_alert_message_html(post_data)
        plain_msg = self.format_alert_message_plain(post_data)

        res = await self.send_message(html_msg, plain_msg)

        # Mark in memory, in database model, and persist to disk
        if post_id:
            self._alerted_post_ids.add(post_id)
        if clean_url:
            self._alerted_urls.add(clean_url)
        if text_fingerprint:
            self._alerted_hashes.add(text_fingerprint)
        try:
            setattr(post, "alert_flag", True)
        except Exception:
            pass
        self._save_alert_cache()

        history_entry = {
            "post_id": post_id,
            "platform": post_data["platform"],
            "headline": post_data["text"][:75],
            "target": self.target_chat_id,
            "result": res,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        self.dispatched_history.insert(0, history_entry)
        if len(self.dispatched_history) > 50:
            self.dispatched_history.pop()

        return res

    def format_crisis_alert_html(self, alert_data: Dict[str, Any], post_data: Dict[str, Any]) -> str:
        platform_name = self._get_platform_display(post_data.get("platform", "YouTube"))
        views_str = self._format_views(post_data.get("views", 0))
        account_name = html.escape(post_data.get("author_name") or "Public Author")
        title = html.escape(alert_data.get("title", "CRITICAL ALERT"))
        message = html.escape(alert_data.get("message", "")).strip()
        permalink = post_data.get("permalink_url") or "#"
        neg_count = alert_data.get("negative_comment_count", 0)
        sev = (alert_data.get("severity") or "critical").upper()

        msg = (
            f"<b>Watch-Tower</b>                                <i>Admin</i>\n"
            f"🚨 <b>{sev} ALERT — {platform_name} — Samrat Choudhary Ji</b>\n\n"
            f"<b>Incident:</b> {title}\n"
            f"<b>Account:</b> {account_name}\n"
            f"<b>Views:</b> {views_str} | <b>Negative Comments:</b> {neg_count:,}\n\n"
            f"{message}\n\n"
            f"<a href=\"{permalink}\">🔗 <b>View on {platform_name}</b></a>\n"
            f"<b>Direct Link:</b> {permalink}"
        )
        return msg

    async def dispatch_crisis_alert(self, alert, post) -> Optional[Dict[str, Any]]:
        """Dispatches structured crisis / threshold alert to Telegram."""
        alert_id = getattr(alert, "id", None)
        alert_key = f"alert_{alert_id}" if alert_id else None
        if alert_key and alert_key in self._alerted_post_ids:
            return None

        post_data = {
            "platform": getattr(post, "platform", "youtube"),
            "author_name": getattr(post, "author_name", "Public Account"),
            "views": getattr(post, "views", 0),
            "text": getattr(post, "text", ""),
            "permalink_url": getattr(post, "permalink_url", "")
        }
        alert_data = {
            "title": getattr(alert, "title", "CRITICAL ALERT"),
            "message": getattr(alert, "message", ""),
            "severity": getattr(alert, "severity", "critical"),
            "negative_comment_count": getattr(alert, "negative_comment_count", 0)
        }

        html_msg = self.format_crisis_alert_html(alert_data, post_data)
        plain_msg = self.format_alert_message_plain(post_data)

        res = await self.send_message(html_msg, plain_msg)

        if alert_key:
            self._alerted_post_ids.add(alert_key)

        history_entry = {
            "alert_id": alert_id,
            "platform": post_data["platform"],
            "headline": alert_data["title"][:75],
            "target": self.target_chat_id,
            "result": res,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        self.dispatched_history.insert(0, history_entry)
        if len(self.dispatched_history) > 50:
            self.dispatched_history.pop()

        return res

    async def send_test_alert(self, bot_token: Optional[str] = None, chat_id: Optional[str] = None) -> Dict[str, Any]:
        """Sends a realistic test alert matching the user's reference screenshot."""
        sample_post = {
            "platform": "youtube",
            "author_name": "Molitics",
            "author_handle": "moliticsindia",
            "views": 13300,
            "text": "निकम्मी पुलिस बिहार की, रील से होगा Crime Control? | Know The News | Nivedita and Neeraj Jha",
            "permalink_url": "https://www.youtube.com/watch?v=sample_video"
        }
        html_msg = self.format_alert_message_html(sample_post)
        plain_msg = self.format_alert_message_plain(sample_post)

        res = await self.send_message(html_msg, plain_msg, custom_token=bot_token, custom_chat_id=chat_id)
        return {
            "test_status": res.get("status"),
            "details": res,
            "preview_text": plain_msg,
            "target": chat_id or self.target_chat_id,
            "has_token": bool(bot_token or self.bot_token)
        }

telegram_alert_service = TelegramAlertService()
