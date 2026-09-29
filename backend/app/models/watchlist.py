from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Boolean, DateTime
from app.database import Base

def utcnow():
    return datetime.now(timezone.utc)

class WatchlistItem(Base):
    __tablename__ = "watchlist_items"

    id = Column(Integer, primary_key=True, index=True)
    item_type = Column(String(30), nullable=False) # keyword, handle, channel
    platform = Column(String(50), nullable=True) # youtube, twitter, all
    value = Column(String(255), nullable=False, unique=True, index=True)
    display_name = Column(String(255), nullable=True)
    label = Column(String(50), default="neutral") # official, supporter, opposition, news-media, neutral
    is_active = Column(Boolean, default=True, index=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)
