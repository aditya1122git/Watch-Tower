import re
import html
import logging
from datetime import datetime, timezone
from typing import List, Optional
import httpx
from app.collectors.base import BaseCollectorAdapter, RawPostData, RawCommentData, RawMetricData
from app.config import settings

logger = logging.getLogger(__name__)

class TelegramAdapter(BaseCollectorAdapter):
    """
    Telegram Public Channel Web Collector.
    Monitors public channels (e.g. t.me/s/bihargovt, t.me/s/biharnews) via open web preview.
    Zero bot token or phone login required.
    """
    DEFAULT_CHANNELS = ["bihargovt", "biharnews"]

    def __init__(self, bot_token: Optional[str] = None):
        super().__init__(platform_name="telegram", is_enabled=True)
        self.bot_token = bot_token or settings.TELEGRAM_BOT_TOKEN

    def build_post_permalink(self, platform_item_id: str) -> str:
        if platform_item_id.startswith("http"):
            return platform_item_id
        return f"https://t.me/{platform_item_id}"

    def build_comment_permalink(self, platform_item_id: str, platform_comment_id: str) -> str:
        return f"{self.build_post_permalink(platform_item_id)}?comment={platform_comment_id}"

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
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36"}

        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True, headers=headers) as client:
            for channel in self.DEFAULT_CHANNELS:
                if len(posts) >= max_results:
                    break
                url = f"https://t.me/s/{channel}"
                try:
                    resp = await client.get(url)
                    if resp.status_code != 200:
                        continue
                    
                    # Extract individual message wrappers
                    # Pattern matches message date links and message text
                    html_content = resp.text
                    message_blocks = re.findall(
                        r'<div[^>]*class="[^"]*tgme_widget_message_wrap[^"]*"[^>]*>(.*?)</div>\s*</div>\s*</div>',
                        html_content,
                        re.DOTALL
                    )

                    for block in message_blocks:
                        if len(posts) >= max_results:
                            break

                        link_match = re.search(r'href="(https://t\.me/[^"]+/\d+)"', block)
                        if not link_match:
                            continue
                        permalink = link_match.group(1)

                        text_match = re.search(r'<div[^>]*class="[^"]*tgme_widget_message_text[^"]*"[^>]*>(.*?)</div>', block, re.DOTALL)
                        raw_text = text_match.group(1) if text_match else ""
                        clean_text = self._strip_html(raw_text)
                        if not clean_text or len(clean_text) < 10:
                            continue

                        # Extract views
                        views_match = re.search(r'<span[^>]*class="[^"]*tgme_widget_message_views[^"]*"[^>]*>([0-9.KMB]+)</span>', block)
                        views = 0
                        if views_match:
                            raw_v = views_match.group(1).upper()
                            if 'K' in raw_v:
                                views = int(float(raw_v.replace('K', '')) * 1000)
                            elif 'M' in raw_v:
                                views = int(float(raw_v.replace('M', '')) * 1000000)
                            elif raw_v.isdigit():
                                views = int(raw_v)

                        # Extract item ID (e.g. "bihargovt/1234")
                        item_id = permalink.replace("https://t.me/", "")

                        posts.append(
                            RawPostData(
                                platform="telegram",
                                platform_item_id=item_id,
                                author_handle=channel,
                                author_name=f"Telegram (@{channel})",
                                author_label="official" if "govt" in channel else "news-media",
                                permalink_url=permalink,
                                canonical_url=permalink,
                                text=clean_text,
                                media_type="post",
                                language="hi" if any(ord(c) >= 0x0900 and ord(c) <= 0x097F for c in clean_text) else "en",
                                posted_at=datetime.now(timezone.utc),
                                views=views,
                                likes=0,
                                shares=0,
                                comment_count=0,
                                matched_keywords=[k for k in keywords if k.lower() in clean_text.lower()]
                            )
                        )
                except Exception as e:
                    logger.warning(f"Error reading Telegram public channel @{channel}: {e}")

        return posts

    async def fetch_comments(self, platform_post_id: str, max_results: int = 100) -> List[RawCommentData]:
        return []

    async def fetch_metrics(self, platform_post_id: str) -> RawMetricData:
        return RawMetricData(views=0, likes=0, shares=0, comment_count=0)
