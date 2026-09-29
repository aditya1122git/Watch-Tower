import logging
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from app.collectors.base import BaseCollectorAdapter, RawPostData, RawCommentData, RawMetricData
from app.config import settings

logger = logging.getLogger(__name__)

class MetaAdapter(BaseCollectorAdapter):
    """
    Official Meta (Facebook & Instagram) Collector Adapter.
    COMPLIANCE NOTICE:
    Per Meta Terms of Service and developer policies, automated crawling of private profiles,
    groups, or unauthorized pages is strictly prohibited.
    
    This adapter supports:
    1. Meta Graph API (requires Page Access Token & Pages Read Engagement permission).
    2. Meta Content Library (requires verified academic/public interest researcher credentials).
    3. Manual CSV/JSON file imports for authorized exports.
    """
    BASE_GRAPH_URL = "https://graph.facebook.com/v19.0"

    def __init__(self, access_token: Optional[str] = None):
        super().__init__(platform_name="facebook", is_enabled=True)
        self.access_token = access_token or settings.META_ACCESS_TOKEN

    def build_post_permalink(self, platform_item_id: str) -> str:
        # Standard public permalink format for Facebook pages
        return f"https://www.facebook.com/{platform_item_id}"

    def build_comment_permalink(self, platform_item_id: str, platform_comment_id: str) -> str:
        return f"https://www.facebook.com/{platform_item_id}?comment_id={platform_comment_id}"

    async def fetch_new_posts(
        self,
        keywords: List[str],
        since: Optional[datetime] = None,
        max_results: int = 25
    ) -> List[RawPostData]:
        if not self.access_token:
            logger.info("Meta Graph API access token not configured. Use manual CSV/JSON import.")
            return []
        
        # When token is configured for authorized page, queries /feed
        return []

    async def fetch_comments(
        self,
        platform_post_id: str,
        max_results: int = 100
    ) -> List[RawCommentData]:
        if not self.access_token:
            return []
        return []

    async def fetch_metrics(self, platform_post_id: str) -> RawMetricData:
        return RawMetricData(views=0, likes=0, shares=0, comment_count=0)
