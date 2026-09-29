from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Optional, Dict, Any

@dataclass
class RawPostData:
    platform: str
    platform_item_id: str
    author_handle: str
    author_name: str
    author_label: str
    permalink_url: str
    canonical_url: str
    text: str
    media_type: str
    language: str
    posted_at: datetime
    views: int = 0
    likes: int = 0
    shares: int = 0
    comment_count: int = 0
    matched_keywords: List[str] = field(default_factory=list)
    raw_payload: Optional[Dict[str, Any]] = None

@dataclass
class RawCommentData:
    platform_comment_id: str
    raw_author_id: str # Will be hashed immediately with salt before DB save
    text: str
    timestamp: datetime
    like_count: int = 0
    parent_thread_id: Optional[str] = None
    permalink_url: str = ""
    raw_payload: Optional[Dict[str, Any]] = None

@dataclass
class RawMetricData:
    views: int
    likes: int
    shares: int
    comment_count: int

class BaseCollectorAdapter(ABC):
    def __init__(self, platform_name: str, is_enabled: bool = True):
        self.platform_name = platform_name
        self.is_enabled = is_enabled

    @abstractmethod
    async def fetch_new_posts(
        self,
        keywords: List[str],
        since: Optional[datetime] = None,
        max_results: int = 50
    ) -> List[RawPostData]:
        """Fetch newly published posts matching target keywords."""
        pass

    @abstractmethod
    async def fetch_comments(
        self,
        platform_post_id: str,
        max_results: int = 100
    ) -> List[RawCommentData]:
        """Fetch comments for a given post."""
        pass

    @abstractmethod
    async def fetch_metrics(
        self,
        platform_post_id: str
    ) -> RawMetricData:
        """Fetch up-to-date engagement metrics for a post."""
        pass

    @abstractmethod
    def build_post_permalink(self, platform_item_id: str) -> str:
        """Construct canonical direct link to original post."""
        pass

    @abstractmethod
    def build_comment_permalink(self, platform_item_id: str, platform_comment_id: str) -> str:
        """Construct canonical direct link to original comment."""
        pass
