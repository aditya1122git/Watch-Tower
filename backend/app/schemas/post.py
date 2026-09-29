from datetime import datetime
from typing import List, Optional, Any
from pydantic import BaseModel, ConfigDict, Field

class PostBase(BaseModel):
    platform: str
    platform_item_id: str
    author_handle: str
    author_name: str
    author_label: str = "neutral"
    permalink_url: str
    canonical_url: str
    text: str
    media_type: str = "post"
    language: str = "en"
    posted_at: datetime
    link_status: str = "active"
    sentiment_verdict: str = "Neutral"
    sentiment_score: float = 0.0
    confidence: float = 0.0
    top_topic: str = "other"
    views: int = 0
    likes: int = 0
    shares: int = 0
    comment_count: int = 0
    negative_comment_count: int = 0
    positive_comment_count: int = 0
    neutral_comment_count: int = 0
    mixed_comment_count: int = 0
    negative_comment_pct: float = 0.0
    growth_velocity: float = 0.0
    alert_flag: bool = False
    matched_keywords: List[str] = Field(default_factory=list)

class PostCreate(PostBase):
    pass

class PostResponse(PostBase):
    id: int
    first_seen_at: datetime
    last_checked_at: datetime
    alert_milestone: int

    model_config = ConfigDict(from_attributes=True)

class PostFilterParams(BaseModel):
    platform: Optional[str] = None
    sentiment: Optional[str] = None # Positive, Negative, Neutral, Mixed, Needs Review
    author_label: Optional[str] = None # official, supporter, opposition, news-media, neutral
    topic: Optional[str] = None
    language: Optional[str] = None
    link_status: Optional[str] = None
    alert_only: Optional[bool] = None
    min_reach: Optional[int] = None
    min_comments: Optional[int] = None
    min_negative_comments: Optional[int] = None
    search: Optional[str] = None # full text search
    from_date: Optional[datetime] = None
    to_date: Optional[datetime] = None
    sort_by: str = "newest" # newest, highest_reach, most_negative, velocity, engagement
    limit: int = 50
    offset: int = 0
