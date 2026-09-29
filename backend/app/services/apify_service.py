import logging
from typing import List, Dict, Any, Optional
import httpx
from app.config import settings

logger = logging.getLogger(__name__)

class ApifyService:
    """
    Service to execute Apify actors for deep social media scraping
    across Twitter (X), Instagram (Reels & Posts), and Facebook.
    Provides automatic fallback if credits expire or timeouts occur.
    """
    BASE_URL = "https://api.apify.com/v2"

    def __init__(self, api_token: Optional[str] = None):
        self.api_token = api_token or getattr(settings, "APIFY_API_TOKEN", None)

    @property
    def is_configured(self) -> bool:
        return bool(self.api_token and self.api_token.startswith("apify_api_"))

    async def run_actor_sync(
        self,
        actor_id: str,
        run_input: Dict[str, Any],
        timeout_seconds: float = 30.0,
        memory_mbytes: int = 256
    ) -> List[Dict[str, Any]]:
        """
        Runs an Apify actor synchronously and returns dataset items.
        """
        if not self.is_configured:
            return []

        url = f"{self.BASE_URL}/acts/{actor_id}/run-sync-get-dataset-items"
        params = {
            "token": self.api_token,
            "memory": memory_mbytes,
            "timeout": int(timeout_seconds)
        }

        try:
            async with httpx.AsyncClient(timeout=timeout_seconds + 5.0) as client:
                resp = await client.post(url, json=run_input, params=params)
                if resp.status_code in (200, 201):
                    data = resp.json()
                    if isinstance(data, list):
                        logger.info(f"Apify actor {actor_id} returned {len(data)} items successfully.")
                        return data
                    elif isinstance(data, dict) and "items" in data:
                        return data["items"]
                    return []
                else:
                    logger.warning(f"Apify actor {actor_id} returned status {resp.status_code}: {resp.text[:150]}")
                    return []
        except Exception as e:
            logger.error(f"Apify actor {actor_id} execution error: {e}")
            return []

    async def scrape_tweets(self, query: str, max_items: int = 15) -> List[Dict[str, Any]]:
        """
        Scrapes live tweets using Apify Tweet Scraper.
        """
        actor_id = "apidojo~tweet-scraper"
        payload = {
            "searchTerms": [query],
            "maxItems": max_items,
            "sort": "Latest",
            "tweetLanguage": "hi"
        }
        return await self.run_actor_sync(actor_id, payload, timeout_seconds=25.0)

    async def scrape_instagram_reels(self, query: str, max_items: int = 15) -> List[Dict[str, Any]]:
        """
        Scrapes live Instagram reels and posts using Apify.
        """
        actor_id = "apify~instagram-reel-scraper"
        usernames = ["samratchoudharyofficial", "bjp4bihar"]
        if query and " " not in query:
            clean_q = query.lstrip("@").strip()
            if clean_q and clean_q not in usernames:
                usernames.insert(0, clean_q)
        payload = {
            "username": usernames,
            "resultsLimit": max_items
        }
        return await self.run_actor_sync(actor_id, payload, timeout_seconds=25.0)

    async def scrape_facebook_posts(self, query: str, max_items: int = 15) -> List[Dict[str, Any]]:
        """
        Scrapes public Facebook posts using Apify.
        """
        actor_id = "apify~facebook-posts-scraper"
        payload = {
            "startUrls": [{"url": f"https://www.facebook.com/search/posts/?q={query}"}],
            "maxPosts": max_items
        }
        return await self.run_actor_sync(actor_id, payload, timeout_seconds=25.0)

apify_service = ApifyService()
