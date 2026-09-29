import re
import html
import logging
from datetime import datetime, timezone
from typing import List, Optional
import httpx
from app.collectors.base import BaseCollectorAdapter, RawPostData, RawCommentData, RawMetricData
from app.services.link_service import normalize_url

logger = logging.getLogger(__name__)

class MastodonAdapter(BaseCollectorAdapter):
    """
    Free Public Fediverse / Mastodon Collector.
    Monitors public hashtags (#Bihar, #SamratChoudhary, #IndiaPolitics) across decentralized Mastodon instances.
    Zero API keys required.
    """
    DEFAULT_INSTANCE = "https://mastodon.social"

    def __init__(self, instance_url: Optional[str] = None):
        super().__init__(platform_name="mastodon", is_enabled=True)
        self.instance_url = (instance_url or self.DEFAULT_INSTANCE).rstrip("/")

    def build_post_permalink(self, platform_item_id: str) -> str:
        if platform_item_id.startswith("http"):
            return platform_item_id
        return f"{self.instance_url}/@{platform_item_id}"

    def build_comment_permalink(self, platform_item_id: str, platform_comment_id: str) -> str:
        return self.build_post_permalink(platform_comment_id)

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
        tags_to_check = ["bihar", "SamratChoudhary", "india"]
        headers = {"User-Agent": "BiharWatchtower/1.0.0 (Research Analytics Bot)"}

        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True, headers=headers) as client:
            for tag in tags_to_check:
                if len(posts) >= max_results:
                    break
                url = f"{self.instance_url}/api/v1/timelines/tag/{tag}"
                try:
                    resp = await client.get(url, params={"limit": 10})
                    if resp.status_code != 200:
                        continue
                    statuses = resp.json()
                    if not isinstance(statuses, list):
                        continue

                    for s in statuses:
                        if len(posts) >= max_results:
                            break
                        content_raw = s.get("content", "")
                        clean_text = self._strip_html(content_raw)
                        if not clean_text:
                            continue

                        status_id = str(s.get("id", ""))
                        permalink = s.get("url") or f"{self.instance_url}/web/statuses/{status_id}"
                        canonical = normalize_url(permalink)

                        account = s.get("account", {})
                        author_handle = account.get("acct", "mastodon_user")
                        author_name = account.get("display_name") or author_handle

                        created_str = s.get("created_at", "")
                        try:
                            posted_at = datetime.fromisoformat(created_str.replace("Z", "+00:00"))
                        except Exception:
                            posted_at = datetime.now(timezone.utc)

                        posts.append(
                            RawPostData(
                                platform="mastodon",
                                platform_item_id=status_id or canonical,
                                author_handle=author_handle,
                                author_name=author_name,
                                author_label="neutral",
                                permalink_url=canonical,
                                canonical_url=canonical,
                                text=clean_text,
                                media_type="post",
                                language="hi" if any(ord(c) >= 0x0900 and ord(c) <= 0x097F for c in clean_text) else "en",
                                posted_at=posted_at,
                                views=0,
                                likes=int(s.get("favourites_count", 0)),
                                shares=int(s.get("reblogs_count", 0)),
                                comment_count=int(s.get("replies_count", 0)),
                                matched_keywords=[k for k in keywords if k.lower() in clean_text.lower()]
                            )
                        )
                except Exception as e:
                    logger.warning(f"Error fetching Mastodon #{tag}: {e}")

        return posts

    async def fetch_comments(self, platform_post_id: str, max_results: int = 100) -> List[RawCommentData]:
        return []

    async def fetch_metrics(self, platform_post_id: str) -> RawMetricData:
        return RawMetricData(views=0, likes=0, shares=0, comment_count=0)
