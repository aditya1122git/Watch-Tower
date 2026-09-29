from datetime import datetime
from typing import List, Optional, Any
from pydantic import BaseModel, ConfigDict

class AlertResponse(BaseModel):
    id: int
    post_id: int
    post_permalink: Optional[str] = None
    post_title: Optional[str] = None
    platform: Optional[str] = "youtube"
    alert_type: str
    severity: str
    milestone_value: int
    title: str
    message: str
    negative_comment_count: int
    negative_pct: float
    growth_rate: float
    top_topics_json: List[Any]
    top_negative_comments_json: List[Any]
    status: str
    acknowledged_by: Optional[str] = None
    resolved_by: Optional[str] = None
    triggered_at: datetime
    resolved_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

class AlertAction(BaseModel):
    action: str # acknowledge, resolve
    user: str = "analyst"
