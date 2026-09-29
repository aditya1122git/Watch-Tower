import re
import html
import logging
from datetime import datetime, timezone
from urllib.parse import quote
from typing import List, Optional
import httpx
from app.collectors.base import BaseCollectorAdapter, RawPostData, RawCommentData, RawMetricData
from app.services.link_service import normalize_url

logger = logging.getLogger(__name__)

class WikipediaAdapter(BaseCollectorAdapter):
    """
    Free Public Wikipedia Knowledge & Public Bio Event Collector.
    Monitors changes, biographical updates, and public articles on Hindi & English Wikipedia.
    Zero API keys required.
    """
    ENDPOINTS = {
        "hi": "https://hi.wikipedia.org/w/api.php",
        "en": "https://en.wikipedia.org/w/api.php"
    }

    def __init__(self):
        super().__init__(platform_name="wikipedia", is_enabled=True)

    def build_post_permalink(self, platform_item_id: str) -> str:
        if platform_item_id.startswith("http"):
            return platform_item_id
        return f"https://en.wikipedia.org/wiki/{platform_item_id}"

    def build_comment_permalink(self, platform_item_id: str, platform_comment_id: str) -> str:
        return self.build_post_permalink(platform_item_id)

    @staticmethod
    def _strip_html(text: str) -> str:
        if not text:
            return ""
        clean = re.sub(r'<[^>]+>', ' ', text)
        clean = html.unescape(clean)
        return re.sub(r'\s+', ' ', clean).strip()

    async def fetch_new_posts(
        self,
        keywords: List[str],
        since: Optional[datetime] = None,
        max_results: int = 25
    ) -> List[RawPostData]:
        posts: List[RawPostData] = []
        headers = {"User-Agent": "BiharWatchtower/1.0.0 (Research Intelligence Bot; contact@watchtower.local)"}

        search_terms = keywords[:4] if keywords else ["Samrat Choudhary", "सम्राट चौधरी", "Bihar Chief Minister"]

        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True, headers=headers) as client:
            for lang, endpoint in self.ENDPOINTS.items():
                if len(posts) >= max_results:
                    break
                for term in search_terms:
                    if len(posts) >= max_results:
                        break
                    params = {
                        "action": "query",
                        "list": "search",
                        "srsearch": term,
                        "format": "json",
                        "srlimit": 5
                    }
                    try:
                        resp = await client.get(endpoint, params=params)
                        if resp.status_code != 200:
                            continue
                        data = resp.json()
                        search_results = data.get("query", {}).get("search", [])

                        for item in search_results:
                            if len(posts) >= max_results:
                                break
                            title = item.get("title", "")
                            raw_snippet = item.get("snippet", "")
                            clean_snippet = self._strip_html(raw_snippet)
                            timestamp_str = item.get("timestamp", "")

                            encoded_title = quote(title.replace(" ", "_"))
                            domain = "hi.wikipedia.org" if lang == "hi" else "en.wikipedia.org"
                            permalink = f"https://{domain}/wiki/{encoded_title}"
                            canonical = normalize_url(permalink)

                            try:
                                posted_at = datetime.fromisoformat(timestamp_str.replace("Z", "+00:00"))
                            except Exception:
                                posted_at = datetime.now(timezone.utc)

                            full_text = f"Wikipedia: {title}\n\n{clean_snippet}"

                            posts.append(
                                RawPostData(
                                    platform="wikipedia",
                                    platform_item_id=str(item.get("pageid", title)),
                                    author_handle="wikipedia_editors",
                                    author_name=f"Wikipedia ({lang.upper()})",
                                    author_label="neutral",
                                    permalink_url=canonical,
                                    canonical_url=canonical,
                                    text=full_text,
                                    media_type="wiki_article",
                                    language=lang,
                                    posted_at=posted_at,
                                    views=item.get("wordcount", 0),
                                    likes=0,
                                    shares=0,
                                    comment_count=0,
                                    matched_keywords=[k for k in keywords if k.lower() in full_text.lower()]
                                )
                            )
                    except Exception as e:
                        logger.warning(f"Error querying Wikipedia ({lang}): {e}")

        return posts

    async def fetch_comments(self, platform_post_id: str, max_results: int = 100) -> List[RawCommentData]:
        return []

    async def fetch_metrics(self, platform_post_id: str) -> RawMetricData:
        return RawMetricData(views=0, likes=0, shares=0, comment_count=0)
