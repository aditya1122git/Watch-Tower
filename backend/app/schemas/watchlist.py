from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict

class WatchlistItemBase(BaseModel):
    item_type: str # keyword, handle, channel
    platform: Optional[str] = "all"
    value: str
    display_name: Optional[str] = None
    label: str = "neutral"
    is_active: bool = True

class WatchlistItemCreate(WatchlistItemBase):
    pass

class WatchlistItemResponse(WatchlistItemBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
