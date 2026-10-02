import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.post import Post
from app.models.comment import Comment
from app.collectors.base import RawPostData, RawCommentData
from app.collectors.reddit import RedditAdapter
from app.collectors.rss_news import NewsRSSAdapter
from app.collectors.mastodon import MastodonAdapter
from app.collectors.wikipedia import WikipediaAdapter
from app.collectors.telegram import TelegramAdapter
from app.collectors.youtube import YouTubeAdapter
from app.collectors.twitter import TwitterAdapter
from app.collectors.facebook import FacebookAdapter
from app.collectors.instagram import InstagramAdapter
from app.sentiment.classifier import sentiment_engine
from app.services.alert_service import evaluate_post_alerts
from app.services.telegram_alert_service import telegram_alert_service
from app.services.telegram_dedup_service import telegram_dedup_service
from app.services.link_service import normalize_url
from app.services.privacy_service import hash_commenter_id
from app.config import settings

logger = logging.getLogger(__name__)

class CollectorService:
    def __init__(self):
        self.reddit_adapter = RedditAdapter()
        self.rss_adapter = NewsRSSAdapter()
        self.mastodon_adapter = MastodonAdapter()
        self.wikipedia_adapter = WikipediaAdapter()
        self.telegram_adapter = TelegramAdapter()
        self.youtube_adapter = YouTubeAdapter()
        self.twitter_adapter = TwitterAdapter()
        self.facebook_adapter = FacebookAdapter(access_token=settings.META_ACCESS_TOKEN)
        self.instagram_adapter = InstagramAdapter(access_token=settings.META_ACCESS_TOKEN)

    def get_collector_metadata(self) -> List[Dict[str, Any]]:
        return [
            {
                "platform": "rss",
                "display_name": "Google News Multi-Lingual RSS",
                "type": "Free Public News Aggregator",
                "description": "Multi-lingual real-time RSS search across Hindi, English, and regional Bihar news publishers.",
                "requires_api_key": False,
                "status": "ready",
                "rate_limit": "Generous / Unrestricted",
                "features": ["Hindi News", "National Coverage", "Direct Publisher Permalinks"]
            },
            {
                "platform": "reddit",
                "display_name": "Reddit Public Feeds",
                "type": "Free Public Forum Feed",
                "description": "Public Atom/RSS feeds monitoring r/bihar, r/india, and r/biharpolitics for CM Samrat Choudhary discussions.",
                "requires_api_key": False,
                "status": "ready",
                "rate_limit": "Public RSS Polling",
                "features": ["Community Discussions", "Upvotes & Comment Threads", "Direct Reddit Links"]
            },
            {
                "platform": "mastodon",
                "display_name": "Mastodon / Fediverse",
                "type": "Free Decentralized Social API",
                "description": "Public Fediverse hashtag timelines (#Bihar, #SamratChoudhary, #India) across open Mastodon instances.",
                "requires_api_key": False,
                "status": "ready",
                "rate_limit": "Public REST Timelines (300 req / 5 min)",
                "features": ["Decentralized Microblogging", "Reblogs/Likes", "Direct Toot URLs"]
            },
            {
                "platform": "wikipedia",
                "display_name": "Wikipedia Event & Bio Monitor",
                "type": "Free Wikimedia Action API",
                "description": "Tracks public updates, cabinet records, and event references to Samrat Choudhary on English and Hindi Wikipedia.",
                "requires_api_key": False,
                "status": "ready",
                "rate_limit": "Wikimedia Open API",
                "features": ["Biographical Revisions", "Official Events", "Bilingual Reference Links"]
            },
            {
                "platform": "telegram",
                "display_name": "Telegram Public Web Previews",
                "type": "Free Public Web Channel Scraper",
                "description": "Monitors open public Bihar news and government announcement channels via t.me/s/ previews.",
                "requires_api_key": False,
                "status": "ready",
                "rate_limit": "Standard Web Access",
                "features": ["Instant Public Bulletins", "Direct Message Permalinks", "Zero Bot Token Needed"]
            },
            {
                "platform": "youtube",
                "display_name": "YouTube Video & Channel Monitor",
                "type": "Video Broadcast & Live Stream Monitor",
                "description": "Tracks verified Bihar news broadcasts, speeches, and video comments on CM Samrat Choudhary with direct playable links.",
                "requires_api_key": False,
                "status": "ready",
                "rate_limit": "Public RSS + YouTube v3 API fallback",
                "features": ["Playable Video Permalinks", "News Bulletins", "Speeches & Interviews"]
            },
            {
                "platform": "twitter",
                "display_name": "X / Twitter Public Posts",
                "type": "Public Social Microblogging",
                "description": "Monitors public tweets, quotes, and citizen reactions regarding CM Samrat Choudhary (@samrat4bjp).",
                "requires_api_key": False,
                "status": "ready",
                "rate_limit": "Public Search + X API v2 fallback",
                "features": ["Live Tweets", "Opposition Scrutiny", "Direct X Status Permalinks"]
            },
            {
                "platform": "facebook",
                "display_name": "Facebook Public Pages & Videos",
                "type": "Public Social Network Monitor",
                "description": "Monitors public Facebook page announcements, video speeches, and citizen debates across Bihar political pages.",
                "requires_api_key": False,
                "status": "ready",
                "rate_limit": "Public Search + Meta Graph API fallback",
                "features": ["Official Page Posts", "Video Announcements", "Citizen Comments"]
            },
            {
                "platform": "instagram",
                "display_name": "Instagram Public Reels & Posts",
                "type": "Visual Media & Reel Monitor",
                "description": "Monitors public Instagram reels, video clips, and photo updates covering CM Samrat Choudhary.",
                "requires_api_key": False,
                "status": "ready",
                "rate_limit": "Public Reel Search + Meta Graph API fallback",
                "features": ["Short Reels", "Speech Clips", "Direct Instagram Links"]
            }
        ]

    async def run_free_collectors(
        self,
        db: AsyncSession,
        keywords: Optional[List[str]] = None,
        max_per_platform: int = 15
    ) -> Dict[str, Any]:
        """Runs all collectors (legacy default wrapper)."""
        return await self.run_platform_collectors(
            db=db,
            platforms=None,
            keywords=keywords,
            max_per_platform=max_per_platform
        )

    async def run_platform_collectors(
        self,
        db: AsyncSession,
        platforms: Optional[List[str]] = None,
        keywords: Optional[List[str]] = None,
        max_per_platform: int = 15
    ) -> Dict[str, Any]:
        """
        Executes selected platform collectors concurrently:
        - Meta platforms: Facebook, Instagram (every 80m)
        - Other platforms: YouTube, Twitter, RSS, Reddit, Mastodon, Wikipedia (every 10m)
        - Telegram: Deduplicates by message ID, URL, and SHA-256 content hash
        """
        target_keywords = keywords or ["Samrat Choudhary", "सम्राट चौधरी", "Bihar CM"]
        now = datetime.now(timezone.utc)
        start_time = datetime.now(timezone.utc)

        # Mapping of platform name to collector coroutine
        available_tasks = {
            "rss": lambda: self.rss_adapter.fetch_new_posts(target_keywords, max_results=max_per_platform),
            "reddit": lambda: self.reddit_adapter.fetch_new_posts(target_keywords, max_results=max_per_platform),
            "mastodon": lambda: self.mastodon_adapter.fetch_new_posts(target_keywords, max_results=max_per_platform),
            "wikipedia": lambda: self.wikipedia_adapter.fetch_new_posts(target_keywords, max_results=max_per_platform),
            "telegram": lambda: self.telegram_adapter.fetch_new_posts(target_keywords, max_results=max_per_platform),
            "youtube": lambda: self.youtube_adapter.fetch_new_posts(target_keywords, max_results=max_per_platform),
            "twitter": lambda: self.twitter_adapter.fetch_new_posts(target_keywords, max_results=max_per_platform),
            "facebook": lambda: self.facebook_adapter.fetch_new_posts(target_keywords, max_results=max_per_platform),
            "instagram": lambda: self.instagram_adapter.fetch_new_posts(target_keywords, max_results=max_per_platform),
        }

        # Determine which platforms to run
        selected_platforms = [p.lower() for p in platforms] if platforms else list(available_tasks.keys())
        active_names = [p for p in selected_platforms if p in available_tasks]

        tasks = [available_tasks[p]() for p in active_names]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        all_raw_posts: List[RawPostData] = []
        platform_stats: Dict[str, Dict[str, Any]] = {}

        for plat_name, res in zip(active_names, results):
            if isinstance(res, Exception):
                logger.error(f"Collector '{plat_name}' failed: {res}")
                platform_stats[plat_name] = {"fetched": 0, "new": 0, "error": 1, "err_msg": str(res)}
            else:
                platform_stats[plat_name] = {"fetched": len(res), "new": 0, "error": 0}
                all_raw_posts.extend(res)

        # Sort raw posts so current/freshest posts are processed first
        all_raw_posts.sort(key=lambda p: p.posted_at or now, reverse=True)

        new_posts_count = 0
        updated_posts_count = 0
        created_alerts_count = 0
        telegram_deduped_count = 0

        # 2. Process and persist raw posts
        for raw in all_raw_posts:
            # Special Telegram Deduplication Filter: ignore repeat updates
            if raw.platform == "telegram":
                if telegram_dedup_service.is_duplicate(
                    item_id=raw.platform_item_id,
                    text=raw.text,
                    permalink=raw.permalink_url or "",
                    author_or_channel=raw.author_handle or ""
                ):
                    telegram_deduped_count += 1
                    continue

            clean_canonical = normalize_url(raw.canonical_url or raw.permalink_url)
            clean_permalink = normalize_url(raw.permalink_url)

            # Deduplication check: check platform_item_id or canonical_url in DB
            existing_query = select(Post).where(
                or_(
                    (Post.platform == raw.platform) & (Post.platform_item_id == raw.platform_item_id),
                    Post.canonical_url == clean_canonical
                )
            )
            existing_res = await db.execute(existing_query)
            existing_post = existing_res.scalar_one_or_none()

            if existing_post:
                # Update engagement and refresh timestamp
                existing_post.views = max(existing_post.views, raw.views)
                existing_post.likes = max(existing_post.likes, raw.likes)
                existing_post.shares = max(existing_post.shares, raw.shares)
                existing_post.comment_count = max(existing_post.comment_count, raw.comment_count)
                existing_post.last_checked_at = now
                updated_posts_count += 1

                # If negative and not yet alerted, dispatch Telegram alert
                if (existing_post.sentiment_verdict == "Negative" or (existing_post.sentiment_score and existing_post.sentiment_score <= -15.0)) and not existing_post.alert_flag:
                    try:
                        await telegram_alert_service.dispatch_negative_post_alert(existing_post)
                        existing_post.alert_flag = True
                    except Exception as te:
                        logger.warning(f"Telegram dispatch failed for existing post {existing_post.id}: {te}")
                continue

            # Classify sentiment towards CM Samrat Choudhary
            sentiment = await sentiment_engine.classify(raw.text)
            label = sentiment.get("label", "Neutral")
            conf = float(sentiment.get("confidence", 0.75))
            topic = sentiment.get("topic", "development")
            lang = sentiment.get("language", raw.language or "en")

            # Precise media type detection (reels, shorts, news bulletins, long video, articles, tweets)
            lower_text = raw.text.lower()
            lower_link = clean_permalink.lower()

            if "/shorts/" in lower_link or "#shorts" in lower_text or "#short" in lower_text:
                inferred_media_type = "short"
            elif "/reel/" in lower_link or "/reels/" in lower_link or "#reel" in lower_text or "#reels" in lower_text or raw.platform == "instagram":
                inferred_media_type = "reel"
            elif any(w in lower_text for w in ["bulletin", "fatafat", "prime time", "top news", "breaking news", "live", "head lines", "फटाफट", "बुलेटिन", "लाइव"]):
                inferred_media_type = "news_bulletin"
            elif raw.platform == "rss" or "article" in lower_link:
                inferred_media_type = "article"
            elif raw.platform == "youtube" or raw.platform == "facebook":
                inferred_media_type = "video"
            elif raw.platform == "twitter":
                inferred_media_type = "tweet"
            else:
                inferred_media_type = raw.media_type or "post"

            # Inferred author stance: supporter, opposition, news-media, neutral
            lower_author = (raw.author_name or "").lower()
            if any(op in lower_text or op in lower_author for op in ["tejashwi", "misa bharti", "prashant kishor", "rjd", "congress", "jan suraaj", "विपक्ष"]):
                inferred_author_label = "opposition"
            elif any(sup in lower_author for sup in ["samrat4bjp", "bjp bihar", "bjp4bihar", "jdu", "nda"]):
                inferred_author_label = "supporter"
            elif raw.platform == "rss" or any(nw in lower_author for nw in ["news", "tak", "zee", "abp", "aaj", "bharat", "jagran", "bhaskar", "hindustan", "lallantop", "cities"]):
                inferred_author_label = "news-media"
            else:
                inferred_author_label = raw.author_label or "neutral"

            # Calculate sentiment score (-100 to +100) with deep focus on negative severity
            if label == "Positive":
                score = round(conf * 80.0, 1)
            elif label == "Negative":
                is_high_severity = (
                    any(kw in lower_text for kw in ["fir", "केस", "pocso", "इस्तीफा", "सजा", "चूक", "घोटाला", "पोल खुल गई", "पहचान उजागर"])
                    or inferred_author_label == "opposition"
                )
                score = round(-max(conf, 0.88) * 88.0 if is_high_severity else -conf * 75.0, 1)
            else:
                score = 0.0

            # Estimate negative comment count based on engagement & sentiment
            est_comments = raw.comment_count
            est_negative = 0
            if est_comments > 0:
                if label == "Negative":
                    est_negative = int(est_comments * 0.80)
                elif label == "Positive":
                    est_negative = int(est_comments * 0.08)
                else:
                    est_negative = int(est_comments * 0.25)

            new_post = Post(
                platform=raw.platform,
                platform_item_id=raw.platform_item_id,
                author_handle=raw.author_handle or "feed_author",
                author_name=raw.author_name or "Public Feed",
                author_label=inferred_author_label,
                permalink_url=clean_permalink,
                canonical_url=clean_canonical,
                text=raw.text,
                media_type=inferred_media_type,
                language=lang,
                posted_at=raw.posted_at or now,
                first_seen_at=now,
                last_checked_at=now,
                link_status="active",
                sentiment_verdict=label,
                sentiment_score=score,
                confidence=conf,
                top_topic=topic,
                views=raw.views,
                likes=raw.likes,
                shares=raw.shares,
                comment_count=est_comments,
                negative_comment_count=est_negative,
                negative_comment_pct=round((est_negative / est_comments * 100.0) if est_comments > 0 else 0.0, 2),
                growth_velocity=round(est_comments / 24.0, 2) if est_comments > 0 else 0.0,
                matched_keywords=raw.matched_keywords or target_keywords
            )
            db.add(new_post)
            await db.flush() # Flush to assign new_post.id

            new_posts_count += 1
            if raw.platform in platform_stats:
                platform_stats[raw.platform]["new"] += 1

            # Comment section removed as requested: focus strictly on detecting positive/negative posts/news
            # Check if this post triggers any alerts
            new_alerts = await evaluate_post_alerts(db, new_post.id)
            created_alerts_count += len(new_alerts)

            # Dispatch real-time Telegram alert for negative post or critical alert
            if new_post.sentiment_verdict == "Negative" or (new_post.sentiment_score and new_post.sentiment_score <= -15.0) or len(new_alerts) > 0:
                try:
                    await telegram_alert_service.dispatch_negative_post_alert(new_post)
                    new_post.alert_flag = True
                except Exception as te:
                    logger.warning(f"Telegram dispatch failed for post {new_post.id}: {te}")

        await db.commit()

        # Sweep and dispatch any remaining unalerted negative posts
        try:
            await telegram_alert_service.sweep_and_dispatch_pending_negative_alerts(db, limit=10)
        except Exception as se:
            logger.warning(f"Negative alerts sweep warning: {se}")

        duration_sec = (datetime.now(timezone.utc) - start_time).total_seconds()

        return {
            "status": "success",
            "message": f"Free collectors completed successfully in {duration_sec:.1f}s.",
            "total_fetched": len(all_raw_posts),
            "new_posts_saved": new_posts_count,
            "existing_posts_updated": updated_posts_count,
            "alerts_created": created_alerts_count,
            "telegram_deduped_count": telegram_deduped_count,
            "platforms": platform_stats,
            "executed_at": now.isoformat()
        }

    async def _fetch_comments_for_platform(self, platform: str, item_id: str) -> List[RawCommentData]:
        if platform == "reddit":
            return await self.reddit_adapter.fetch_comments(item_id, max_results=10)
        elif platform == "mastodon":
            return await self.mastodon_adapter.fetch_comments(item_id, max_results=10)
        elif platform == "youtube":
            return await self.youtube_adapter.fetch_comments(item_id, max_results=10)
        elif platform == "twitter":
            return await self.twitter_adapter.fetch_comments(item_id, max_results=10)
        elif platform == "facebook":
            return await self.facebook_adapter.fetch_comments(item_id, max_results=10)
        elif platform == "instagram":
            return await self.instagram_adapter.fetch_comments(item_id, max_results=10)
        return []

collector_service = CollectorService()
