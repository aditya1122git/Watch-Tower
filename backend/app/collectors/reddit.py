import re
import html
import logging
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from urllib.parse import quote_plus
from typing import List, Optional
import httpx
from app.collectors.base import BaseCollectorAdapter, RawPostData, RawCommentData, RawMetricData
from app.services.link_service import normalize_url

logger = logging.getLogger(__name__)

class RedditAdapter(BaseCollectorAdapter):
    """
    Free Public Reddit Collector.
    Monitors public subreddits (r/bihar, r/india, r/biharpolitics) and global search via public RSS/Atom feeds.
    Zero API keys required.
    """
    SUBREDDITS = ["bihar", "india", "biharpolitics"]
    ATOM_NS = {"atom": "http://www.w3.org/2005/Atom"}

    def __init__(self):
        super().__init__(platform_name="reddit", is_enabled=True)

    def build_post_permalink(self, platform_item_id: str) -> str:
        if platform_item_id.startswith("http"):
            return platform_item_id
        return f"https://www.reddit.com/comments/{platform_item_id}"

    def build_comment_permalink(self, platform_item_id: str, platform_comment_id: str) -> str:
        base = self.build_post_permalink(platform_item_id)
        return f"{base.rstrip('/')}/_/{platform_comment_id}"

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
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 WatchtowerBot/1.0"
        }

        # Build search queries
        query = quote_plus(" OR ".join([f'"{k}"' for k in keywords[:3]])) if keywords else "Samrat+Choudhary"

        urls_to_try = [
            f"https://www.reddit.com/r/bihar/search.rss?q={query}&restrict_sr=1&sort=new",
            f"https://www.reddit.com/r/india/search.rss?q={query}&restrict_sr=1&sort=new",
            f"https://www.reddit.com/search.rss?q={query}&sort=new"
        ]

        async with httpx.AsyncClient(timeout=12.0, follow_redirects=True, headers=headers) as client:
            for url in urls_to_try:
                if len(posts) >= max_results:
                    break
                try:
                    resp = await client.get(url)
                    if resp.status_code != 200:
                        logger.warning(f"Reddit RSS returned HTTP {resp.status_code} for {url}")
                        continue

                    root = ET.fromstring(resp.content)
                    entries = root.findall("atom:entry", self.ATOM_NS)

                    for entry in entries:
                        if len(posts) >= max_results:
                            break

                        title = entry.findtext("atom:title", "", self.ATOM_NS)
                        link_el = entry.find("atom:link", self.ATOM_NS)
                        link = link_el.attrib.get("href", "") if link_el is not None else ""
                        author_name = entry.findtext("atom:author/atom:name", "reddit_user", self.ATOM_NS)
                        updated_str = entry.findtext("atom:updated", "", self.ATOM_NS)
                        raw_content = entry.findtext("atom:content", "", self.ATOM_NS)

                        clean_content = self._strip_html(raw_content)
                        full_text = f"{title}\n\n{clean_content}".strip()

                        canonical = normalize_url(link) if link else f"https://www.reddit.com/r/bihar"

                        try:
                            posted_at = datetime.fromisoformat(updated_str.replace("Z", "+00:00"))
                        except Exception:
                            posted_at = datetime.now(timezone.utc)

                        # Extract item ID from URL (e.g., .../comments/123abc/title/)
                        id_match = re.search(r'/comments/([a-z0-9]+)/', link)
                        item_id = id_match.group(1) if id_match else canonical

                        posts.append(
                            RawPostData(
                                platform="reddit",
                                platform_item_id=item_id,
                                author_handle=author_name.replace("/u/", "").strip(),
                                author_name=f"Reddit ({author_name})",
                                author_label="neutral",
                                permalink_url=canonical,
                                canonical_url=canonical,
                                text=full_text,
                                media_type="post",
                                language="hi" if any(ord(c) >= 0x0900 and ord(c) <= 0x097F for c in full_text) else "en",
                                posted_at=posted_at,
                                views=0,
                                likes=0,
                                shares=0,
                                comment_count=0,
                                matched_keywords=[k for k in keywords if k.lower() in full_text.lower()]
                            )
                        )
                except Exception as e:
                    logger.warning(f"Error fetching Reddit RSS ({url}): {e}")

        return posts

    async def fetch_comments(
        self,
        platform_post_id: str,
        max_results: int = 100
    ) -> List[RawCommentData]:
        # Public reddit comment extraction via post RSS/JSON
        return []

    async def fetch_metrics(self, platform_post_id: str) -> RawMetricData:
        return RawMetricData(views=0, likes=0, shares=0, comment_count=0)
