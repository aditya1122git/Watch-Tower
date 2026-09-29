import asyncio
import os
import json
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
from collections import defaultdict
from pathlib import Path
from sqlalchemy import select, func, and_, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import AsyncSessionLocal
from app.models.post import Post
from app.models.comment import Comment
from app.models.alert import Alert
from app.models.metric_snapshot import MetricSnapshot
from app.services.collector_service import collector_service
from app.services.alert_service import broadcast_event
from app.services.telegram_dedup_service import telegram_dedup_service

logger = logging.getLogger("watchtower.scheduler")

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
LOGS_DIR = Path(__file__).resolve().parent.parent.parent / "logs"
DATA_DIR.mkdir(parents=True, exist_ok=True)
LOGS_DIR.mkdir(parents=True, exist_ok=True)

STATE_FILE = DATA_DIR / "scheduler_state.json"
REFRESH_LOG_FILE = LOGS_DIR / "platform_refresh.log"

class BackgroundSchedulerService:
    """
    Automated Multi-Tier Ingestion & Monitoring Engine.
    Configurable Refresh Cycles:
      - Facebook: every 80 minutes (REFRESH_INTERVAL_FB_INSTA_MINUTES)
      - Instagram: every 80 minutes (REFRESH_INTERVAL_FB_INSTA_MINUTES)
      - Other Platforms (YouTube, Twitter, RSS, Reddit, Mastodon, Wikipedia): every 10 minutes (REFRESH_INTERVAL_OTHER_MINUTES)
      - Telegram: Event / New-Message based processing with strict deduplication
    
    Timers are persistent and do NOT reset on page reload.
    Maintains platform_refresh.log audit trail.
    """

    def __init__(self, interval_seconds: int = 5400):
        self.interval_seconds = getattr(settings, "SCHEDULER_INTERVAL_SECONDS", interval_seconds) or 5400
        self.fb_insta_interval_minutes = getattr(settings, "REFRESH_INTERVAL_FB_INSTA_MINUTES", 80) or 80
        self.other_interval_minutes = getattr(settings, "REFRESH_INTERVAL_OTHER_MINUTES", 10) or 10

        self.is_running: bool = False
        self._task: Optional[asyncio.Task] = None
        self.last_run: Optional[datetime] = None
        self.next_run: Optional[datetime] = None
        self.total_runs: int = 0
        self.total_new_items_today: int = 0
        self.history: List[Dict[str, Any]] = [] # max 100 entries
        self.recent_minute_logs: List[Dict[str, Any]] = [] # max 100 live items

        # Platform-specific state tracking
        self.platforms: Dict[str, Dict[str, Any]] = {
            "facebook": {
                "id": "facebook",
                "display_name": "Facebook",
                "platforms": ["facebook"],
                "interval_minutes": self.fb_insta_interval_minutes,
                "is_event_based": False,
                "status": "Current", # Current | Updating | Failed
                "last_updated": None,
                "next_refresh": None,
                "last_successful_update": None,
                "last_error": None,
                "items_fetched": 0,
                "new_saved": 0
            },
            "instagram": {
                "id": "instagram",
                "display_name": "Instagram",
                "platforms": ["instagram"],
                "interval_minutes": self.fb_insta_interval_minutes,
                "is_event_based": False,
                "status": "Current",
                "last_updated": None,
                "next_refresh": None,
                "last_successful_update": None,
                "last_error": None,
                "items_fetched": 0,
                "new_saved": 0
            },
            "other": {
                "id": "other",
                "display_name": "Other Platforms",
                "platforms": ["youtube", "twitter", "rss", "reddit", "mastodon", "wikipedia"],
                "interval_minutes": self.other_interval_minutes,
                "is_event_based": False,
                "status": "Current",
                "last_updated": None,
                "next_refresh": None,
                "last_successful_update": None,
                "last_error": None,
                "items_fetched": 0,
                "new_saved": 0
            },
            "telegram": {
                "id": "telegram",
                "display_name": "Telegram",
                "platforms": ["telegram"],
                "interval_minutes": None,
                "is_event_based": True,
                "status": "New",
                "last_updated": None,
                "next_refresh": None,
                "last_successful_update": None,
                "last_error": None,
                "items_fetched": 0,
                "new_saved": 0
            }
        }

        self._load_state()

    def _load_state(self):
        """Loads persistent timer state from data/scheduler_state.json to prevent resets on reload."""
        now = datetime.now(timezone.utc)
        try:
            if STATE_FILE.exists():
                with open(STATE_FILE, "r", encoding="utf-8") as f:
                    saved = json.load(f)
                    self.total_runs = saved.get("total_runs", 0)
                    self.total_new_items_today = saved.get("total_new_items_today", 0)

                    saved_platforms = saved.get("platforms", {})
                    for p_key, p_val in saved_platforms.items():
                        if p_key in self.platforms:
                            target = self.platforms[p_key]
                            if p_val.get("last_updated"):
                                try:
                                    target["last_updated"] = datetime.fromisoformat(p_val["last_updated"])
                                except Exception:
                                    pass
                            if p_val.get("next_refresh"):
                                try:
                                    target["next_refresh"] = datetime.fromisoformat(p_val["next_refresh"])
                                except Exception:
                                    pass
                            if p_val.get("last_successful_update"):
                                try:
                                    target["last_successful_update"] = datetime.fromisoformat(p_val["last_successful_update"])
                                except Exception:
                                    pass
                            target["status"] = p_val.get("status", "Current")
                            target["last_error"] = p_val.get("last_error")
                            target["items_fetched"] = p_val.get("items_fetched", 0)
                            target["new_saved"] = p_val.get("new_saved", 0)
                logger.info("Loaded persistent scheduler timestamps from scheduler_state.json.")
        except Exception as e:
            logger.warning(f"Could not load scheduler_state.json: {e}")

        # Ensure future next_refresh dates for scheduled platforms
        for p_key, p in self.platforms.items():
            if not p["is_event_based"]:
                mins = p["interval_minutes"] or 10
                if not p["last_updated"]:
                    p["last_updated"] = now
                if not p["last_successful_update"]:
                    p["last_successful_update"] = now
                if not p["next_refresh"] or p["next_refresh"] <= now:
                    p["next_refresh"] = now + timedelta(minutes=mins)
            else:
                if not p["last_updated"]:
                    p["last_updated"] = telegram_dedup_service.last_new_update_at or now
                if not p["last_successful_update"]:
                    p["last_successful_update"] = p["last_updated"]

        self.last_run = self.platforms["other"]["last_updated"]
        self.next_run = min(
            (p["next_refresh"] for p in self.platforms.values() if p.get("next_refresh")),
            default=now + timedelta(minutes=10)
        )
        self._save_state()

    def _save_state(self):
        """Persists scheduler timestamps and status to disk."""
        try:
            data = {
                "total_runs": self.total_runs,
                "total_new_items_today": self.total_new_items_today,
                "platforms": {}
            }
            for p_key, p in self.platforms.items():
                data["platforms"][p_key] = {
                    "status": p.get("status", "Current"),
                    "last_updated": p["last_updated"].isoformat() if p.get("last_updated") else None,
                    "next_refresh": p["next_refresh"].isoformat() if p.get("next_refresh") else None,
                    "last_successful_update": p["last_successful_update"].isoformat() if p.get("last_successful_update") else None,
                    "last_error": p.get("last_error"),
                    "items_fetched": p.get("items_fetched", 0),
                    "new_saved": p.get("new_saved", 0)
                }
            with open(STATE_FILE, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2)
        except Exception as e:
            logger.warning(f"Could not write scheduler_state.json: {e}")

    def _write_refresh_log(self, platform_key: str, status: str, fetched: int, new_items: int, details: str = ""):
        """Appends audit record to logs/platform_refresh.log."""
        try:
            ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
            line = f"[{ts}] PLATFORM={platform_key:<10} STATUS={status:<7} FETCHED={fetched:<3} NEW={new_items:<3} {details}\n"
            with open(REFRESH_LOG_FILE, "a", encoding="utf-8") as f:
                f.write(line)
        except Exception as e:
            logger.warning(f"Could not write to platform_refresh.log: {e}")

    def start(self):
        if self.is_running and self._task and not self._task.done():
            logger.info("Background multi-platform scheduler already active.")
            return

        self.is_running = True
        self._task = asyncio.create_task(self._run_loop())
        logger.info(
            f"Automated Multi-Tier Scheduler started. "
            f"FB/Insta: {self.fb_insta_interval_minutes}m, "
            f"Other: {self.other_interval_minutes}m, "
            f"Telegram: Event-based (dedup active)."
        )

    def stop(self):
        self.is_running = False
        if self._task and not self._task.done():
            self._task.cancel()
        logger.info("Background multi-platform scheduler stopped.")

    async def _run_loop(self):
        # Initial delay on server launch
        await asyncio.sleep(4)

        while self.is_running:
            now = datetime.now(timezone.utc)
            try:
                # Check scheduled platforms
                for p_key, p in self.platforms.items():
                    if p.get("is_event_based"):
                        continue
                    next_ref = p.get("next_refresh")
                    if next_ref and now >= next_ref and p.get("status") != "Updating":
                        # Trigger background task for this platform group
                        asyncio.create_task(self.refresh_platform(p_key))

                # Periodically check Telegram events / channels gently every 60s
                # (respecting Telegram rate limits with zero spam)
                tg = self.platforms["telegram"]
                if tg.get("status") != "Updating":
                    last_tg = tg.get("last_updated") or (now - timedelta(minutes=10))
                    if (now - last_tg).total_seconds() >= 60:
                        asyncio.create_task(self.refresh_platform("telegram", is_background_event=True))

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in scheduler tick: {e}", exc_info=True)

            await asyncio.sleep(5) # Non-blocking tick every 5 seconds

    async def refresh_platform(self, platform_key: str, is_manual: bool = False, is_background_event: bool = False, **kwargs) -> Dict[str, Any]:
        """
        Executes an isolated refresh cycle for a specific platform or platform group:
        - Facebook: 80 mins
        - Instagram: 80 mins
        - Other Platforms: 10 mins
        - Telegram: Event-based + deduplication
        """
        if platform_key not in self.platforms:
            raise ValueError(f"Unknown platform key: {platform_key}")

        cfg = self.platforms[platform_key]
        now = datetime.now(timezone.utc)

        # Mark status as Updating
        cfg["status"] = "Updating"
        self._save_state()

        # Broadcast updating indicator
        await broadcast_event("platform_refresh_started", {
            "platform": platform_key,
            "status": "Updating",
            "timestamp": now.isoformat()
        })

        try:
            async with AsyncSessionLocal() as session:
                target_platforms = cfg["platforms"]
                res = await collector_service.run_platform_collectors(
                    db=session,
                    platforms=target_platforms,
                    max_per_platform=10
                )

                fetched = res.get("total_fetched", 0)
                new_saved = res.get("new_posts_saved", 0)
                deduped = res.get("telegram_deduped_count", 0)

                cfg["items_fetched"] = fetched
                cfg["new_saved"] = new_saved
                cfg["last_updated"] = now
                cfg["last_successful_update"] = now
                cfg["last_error"] = None
                cfg["status"] = "Current" if platform_key != "telegram" else ("New" if new_saved > 0 else "Current")

                if not cfg["is_event_based"]:
                    mins = cfg["interval_minutes"] or 10
                    cfg["next_refresh"] = now + timedelta(minutes=mins)

                self.total_runs += 1
                self.total_new_items_today += new_saved

                # Record in history
                hist_entry = {
                    "platform": platform_key,
                    "timestamp": now.isoformat(),
                    "time_display": now.strftime("%I:%M %p"),
                    "total_fetched": fetched,
                    "new_saved": new_saved,
                    "status": "Current",
                    "next_refresh": cfg["next_refresh"].isoformat() if cfg.get("next_refresh") else None
                }
                self.history.insert(0, hist_entry)
                if len(self.history) > 100:
                    self.history.pop()

                # Audit log
                next_str = cfg["next_refresh"].strftime("%I:%M %p") if cfg.get("next_refresh") else "—"
                self._write_refresh_log(
                    platform_key, "SUCCESS", fetched, new_saved,
                    f"NextRefresh={next_str} Deduped={deduped}"
                )

                self._save_state()

                # Broadcast completion to frontend
                await broadcast_event("platform_refresh_completed", {
                    "platform": platform_key,
                    "status": cfg["status"],
                    "last_updated": now.isoformat(),
                    "next_refresh": cfg["next_refresh"].isoformat() if cfg.get("next_refresh") else None,
                    "fetched": fetched,
                    "new_saved": new_saved
                })

                return hist_entry

        except Exception as e:
            logger.error(f"Platform refresh failed for '{platform_key}': {e}", exc_info=True)
            cfg["status"] = "Failed"
            cfg["last_error"] = str(e)
            cfg["last_updated"] = now
            # Next cycle continues on schedule even if this one failed
            if not cfg["is_event_based"]:
                mins = cfg["interval_minutes"] or 10
                cfg["next_refresh"] = now + timedelta(minutes=mins)

            self._save_state()

            last_succ_str = cfg["last_successful_update"].strftime("%I:%M %p") if cfg.get("last_successful_update") else "Never"
            self._write_refresh_log(
                platform_key, "FAILED", 0, 0,
                f"Error='{str(e)}' LastSuccess={last_succ_str}"
            )

            await broadcast_event("platform_refresh_failed", {
                "platform": platform_key,
                "status": "Failed",
                "error": str(e),
                "last_successful_update": cfg["last_successful_update"].isoformat() if cfg.get("last_successful_update") else None,
                "next_refresh": cfg["next_refresh"].isoformat() if cfg.get("next_refresh") else None
            })

            return {
                "platform": platform_key,
                "status": "Failed",
                "error": str(e),
                "next_refresh": cfg["next_refresh"].isoformat() if cfg.get("next_refresh") else None
            }

    def get_platform_statuses(self) -> List[Dict[str, Any]]:
        """
        Returns the compact 4-row Data Refresh Status table:
        Platform | Refresh Interval | Last Updated | Next Refresh | Status
        """
        now = datetime.now(timezone.utc)
        result = []

        # Order: Facebook, Instagram, Other Platforms, Telegram
        order = ["facebook", "instagram", "other", "telegram"]
        for p_key in order:
            p = self.platforms[p_key]
            last_up = p.get("last_updated")
            next_ref = p.get("next_refresh")
            last_succ = p.get("last_successful_update")

            # Calculate remaining seconds for live countdown
            remaining_seconds: Optional[int] = None
            if next_ref:
                diff = int((next_ref - now).total_seconds())
                remaining_seconds = max(0, diff)

            # Format intervals
            if p["is_event_based"]:
                refresh_interval = "New Update"
                next_display = "—"
            else:
                refresh_interval = f"{p['interval_minutes']} min"
                next_display = next_ref.strftime("%I:%M %p") if next_ref else "—"

            status = p.get("status", "Current")

            entry = {
                "platform": p_key,
                "display_name": p["display_name"],
                "refresh_interval": refresh_interval,
                "interval_minutes": p.get("interval_minutes"),
                "last_updated": last_up.isoformat() if last_up else None,
                "last_updated_display": last_up.strftime("%I:%M %p") if last_up else "Pending",
                "next_refresh": next_ref.isoformat() if next_ref else None,
                "next_refresh_display": next_display,
                "status": status,
                "seconds_remaining": remaining_seconds,
                "last_successful_update": last_succ.isoformat() if last_succ else None,
                "last_successful_update_display": last_succ.strftime("%I:%M %p") if last_succ else "None",
                "last_error": p.get("last_error"),
                "items_fetched": p.get("items_fetched", 0),
                "new_saved": p.get("new_saved", 0),
                "deduplicated_count": telegram_dedup_service.duplicates_ignored_count if p_key == "telegram" else None
            }
            result.append(entry)

        return result

    async def trigger_cycle(self) -> Dict[str, Any]:
        """Legacy trigger wrapper: runs all platforms."""
        now = datetime.now(timezone.utc)
        results = {}
        for p_key in ["other", "facebook", "instagram", "telegram"]:
            res = await self.refresh_platform(p_key, is_manual=True)
            results[p_key] = res
        return {
            "status": "success",
            "message": "All platform cycles refreshed successfully.",
            "platforms": results,
            "executed_at": now.isoformat()
        }

    def get_status(self) -> Dict[str, Any]:
        """Detailed status including legacy and platform tables."""
        return {
            "is_running": self.is_running,
            "interval_seconds": self.interval_seconds,
            "last_run": self.last_run.isoformat() if self.last_run else None,
            "next_run": self.next_run.isoformat() if self.next_run else None,
            "total_runs": self.total_runs,
            "total_new_items_today": self.total_new_items_today,
            "platform_statuses": self.get_platform_statuses(),
            "recent_cycles": self.history[:10]
        }

    async def get_timeline_report(self, db: AsyncSession) -> Dict[str, Any]:
        """Generates comprehensive hourly and minute-by-minute activity report."""
        now = datetime.now(timezone.utc)
        start_24h = now - timedelta(hours=24)

        posts_res = await db.execute(
            select(Post).where(Post.posted_at >= start_24h).order_by(desc(Post.posted_at))
        )
        posts_24h = posts_res.scalars().all()

        if len(posts_24h) < 5:
            all_posts_res = await db.execute(select(Post).order_by(desc(Post.first_seen_at)).limit(50))
            posts_24h = all_posts_res.scalars().all()

        hourly_buckets: List[Dict[str, Any]] = []
        for i in range(23, -1, -1):
            h_start = now - timedelta(hours=i + 1)
            h_end = now - timedelta(hours=i)
            h_label = h_start.strftime("%H:00")

            in_bucket = [
                p for p in posts_24h
                if (p.posted_at and h_start.hour == p.posted_at.hour) or
                   (p.first_seen_at and h_start.hour == p.first_seen_at.hour)
            ]

            p_count = len(in_bucket)
            reach = sum(p.views for p in in_bucket)
            pos_c = sum(1 for p in in_bucket if p.sentiment_verdict == "Positive")
            neg_c = sum(1 for p in in_bucket if p.sentiment_verdict == "Negative")
            neu_c = sum(1 for p in in_bucket if p.sentiment_verdict in ("Neutral", "Mixed"))

            avg_score = round(sum(p.sentiment_score for p in in_bucket) / p_count, 1) if p_count > 0 else 0.0
            vel = round(sum(p.growth_velocity for p in in_bucket), 1)

            topics_counter: Dict[str, int] = defaultdict(int)
            for p in in_bucket:
                if p.top_topic:
                    topics_counter[p.top_topic] += 1
            top_topics = sorted(topics_counter.keys(), key=lambda k: topics_counter[k], reverse=True)[:3]

            hourly_buckets.append({
                "hour": h_label,
                "hour_iso": h_start.isoformat(),
                "post_count": p_count,
                "reach": reach,
                "positive_count": pos_c,
                "negative_count": neg_c,
                "neutral_count": neu_c,
                "negative_pct": round((neg_c / p_count * 100.0), 1) if p_count > 0 else 0.0,
                "avg_sentiment_score": avg_score,
                "velocity": vel,
                "top_topics": top_topics
            })

        total_24h_posts = len(posts_24h)
        total_24h_reach = sum(p.views for p in posts_24h)
        total_24h_neg_comments = sum(p.negative_comment_count for p in posts_24h)
        current_hour_bucket = hourly_buckets[-1] if hourly_buckets else {}

        minute_logs = list(self.recent_minute_logs[:50])
        if len(minute_logs) < 10:
            for p in posts_24h[:15]:
                minute_logs.append({
                    "id": p.id,
                    "timestamp": p.first_seen_at.strftime("%H:%M:%S") if p.first_seen_at else "Now",
                    "time_iso": p.first_seen_at.isoformat() if p.first_seen_at else now.isoformat(),
                    "platform": p.platform,
                    "author": p.author_name,
                    "title": p.text[:120],
                    "sentiment": p.sentiment_verdict,
                    "score": p.sentiment_score,
                    "topic": p.top_topic,
                    "permalink": p.permalink_url
                })

        return {
            "summary": {
                "total_posts_24h": total_24h_posts,
                "total_reach_24h": total_24h_reach,
                "total_negative_comments_24h": total_24h_neg_comments,
                "current_hour_posts": current_hour_bucket.get("post_count", 0),
                "current_hour_negative_pct": current_hour_bucket.get("negative_pct", 0.0),
                "current_hour_velocity": current_hour_bucket.get("velocity", 0.0),
                "scheduler_active": self.is_running,
                "refresh_interval_seconds": self.interval_seconds,
                "total_cycles_today": self.total_runs,
                "items_ingested_today": self.total_new_items_today,
                "last_refreshed_at": self.last_run.isoformat() if self.last_run else None,
                "next_refresh_at": self.next_run.isoformat() if self.next_run else None,
                "platform_statuses": self.get_platform_statuses()
            },
            "hourly_trend": hourly_buckets,
            "minute_logs": minute_logs[:40],
            "execution_history": self.history[:15]
        }

scheduler_service = BackgroundSchedulerService()
