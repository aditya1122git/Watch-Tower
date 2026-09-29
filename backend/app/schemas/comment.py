from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict

class CommentBase(BaseModel):
    platform_comment_id: str
    commenter_hash: str
    text: str
    language: str = "en"
    timestamp: datetime
    like_count: int = 0
    parent_thread_id: Optional[str] = None
    sentiment_label: str = "Neutral"
    sentiment_score: float = 0.0
    confidence: float = 0.0
    target_of_sentiment: str = "Samrat Choudhary / Govt"
    topic: str = "other"
    is_sarcastic: bool = False
    is_abusive: bool = False
    reason_short: str = ""
    permalink_url: str

class CommentCreate(CommentBase):
    post_id: int

class CommentResponse(CommentBase):
    id: int
    post_id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
