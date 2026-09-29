import logging
import xml.etree.ElementTree as ET
from datetime import datetime, timezone, timedelta
from urllib.parse import quote_plus
from typing import List, Optional
import httpx
from app.collectors.base import BaseCollectorAdapter, RawPostData, RawCommentData, RawMetricData
from app.services.link_service import normalize_url

logger = logging.getLogger(__name__)

class NewsRSSAdapter(BaseCollectorAdapter):
    """
    Public Google News and News RSS feed adapter for Bihar CM coverage.
    """
    RSS_URL = "https://news.google.com/rss/search"

    def __init__(self):
        super().__init__(platform_name="rss", is_enabled=True)

    def build_post_permalink(self, platform_item_id: str) -> str:
        return platform_item_id

    def build_comment_permalink(self, platform_item_id: str, platform_comment_id: str) -> str:
        return platform_item_id

    async def fetch_new_posts(
        self,
        keywords: List[str],
        since: Optional[datetime] = None,
        max_results: int = 25
    ) -> List[RawPostData]:
        posts: List[RawPostData] = []
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
        }

        four_hours_ago = datetime.now(timezone.utc) - timedelta(hours=4)
        # Multi-lingual queries targeting the 10 key Bihar news channels with 4h freshness
        queries = [
            ("hi", 'सम्राट चौधरी ("News18" OR "Zee Bihar" OR "ABP Bihar" OR "Bihar Tak" OR "First Bihar") when:4h', "hl=hi&gl=IN&ceid=IN:hi"),
            ("hi", 'सम्राट चौधरी ("Live Cities" OR "News4Nation" OR "Hindustani Media" OR "News State" OR "Sahara Samay") when:4h', "hl=hi&gl=IN&ceid=IN:hi"),
            ("hi", "सम्राट चौधरी ताजा खबर when:4h", "hl=hi&gl=IN&ceid=IN:hi"),
            ("hi", "सम्राट चौधरी FIR OR केस OR इस्तीफा OR जमुई when:4h", "hl=hi&gl=IN&ceid=IN:hi"),
            ("en", 'Samrat Choudhary ("Live Cities" OR "News4Nation" OR "Bihar Tak" OR "News18") when:4h', "hl=en-IN&gl=IN&ceid=IN:en"),
            ("en", "Samrat Choudhary Bihar Chief Minister when:4h", "hl=en-IN&gl=IN&ceid=IN:en")
        ]

        seen_links = set()
        async with httpx.AsyncClient(timeout=12.0, follow_redirects=True, headers=headers) as client:
            for lang, q_text, query_params in queries:
                if len(posts) >= max_results:
                    break
                encoded_q = quote_plus(q_text)
                url = f"{self.RSS_URL}?q={encoded_q}&{query_params}"
                try:
                    resp = await client.get(url)
                    if resp.status_code != 200:
                        continue
                    root = ET.fromstring(resp.content)
                except Exception as e:
                    logger.warning(f"Error fetching Google News RSS ({lang}): {e}")
                    continue

                channel = root.find("channel")
                if channel is None:
                    continue

                items = channel.findall("item")
                for item in items:
                    if len(posts) >= max_results:
                        break
                    title = item.findtext("title", "")
                    link = item.findtext("link", "")
                    pub_date_str = item.findtext("pubDate", "")
                    source_el = item.find("source")
                    source_name = source_el.text.strip() if source_el is not None and source_el.text else "News Media"

                    if not title or not link or link in seen_links:
                        continue
                    seen_links.add(link)

                    canonical = normalize_url(link)
                    try:
                        # RSS pubDate format: RFC 822 / 2822
                        posted_at = datetime.strptime(pub_date_str[:25], "%a, %d %b %Y %H:%M:%S").replace(tzinfo=timezone.utc)
                    except Exception:
                        posted_at = datetime.now(timezone.utc)

                    if posted_at < four_hours_ago:
                        continue

                    # Estimate digital news readership
                    s_lower = source_name.lower()
                    if any(top in s_lower for top in ["bhaskar", "aaj", "jagran", "hindustan", "abp", "zee", "ndtv", "jansatta", "navbharat"]):
                        est_views = 95000
                        est_comments = 180
                    else:
                        est_views = 35000
                        est_comments = 45

                    posts.append(
                        RawPostData(
                            platform="rss",
                            platform_item_id=canonical,
                            author_handle=source_name.lower().replace(" ", "_").replace(".", ""),
                            author_name=source_name,
                            author_label="news-media",
                            permalink_url=canonical,
                            canonical_url=canonical,
                            text=title,
                            media_type="article",
                            language="hi" if any(ord(c) >= 0x0900 and ord(c) <= 0x097F for c in title) else "en",
                            posted_at=posted_at,
                            views=est_views,
                            likes=int(est_views * 0.03),
                            shares=int(est_views * 0.01),
                            comment_count=est_comments,
                            matched_keywords=[k for k in keywords if k.lower() in title.lower()] or ["Samrat Choudhary"]
                        )
                    )

        posts.sort(key=lambda p: p.posted_at, reverse=True)
        return posts

    async def fetch_comments(
        self,
        platform_post_id: str,
        max_results: int = 100
    ) -> List[RawCommentData]:
        # RSS articles typically do not expose an open standard comment feed API
        return []

    async def fetch_metrics(self, platform_post_id: str) -> RawMetricData:
        return RawMetricData(views=0, likes=0, shares=0, comment_count=0)
