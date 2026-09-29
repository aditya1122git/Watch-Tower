from datetime import datetime, timezone
from sqlalchemy import (
    Column, Integer, String, Text, Float, Boolean, DateTime, UniqueConstraint, JSON
)
from sqlalchemy.orm import relationship
from app.database import Base

def utcnow():
    return datetime.now(timezone.utc)

class Post(Base):
    __tablename__ = "posts"

    id = Column(Integer, primary_key=True, index=True)
    platform = Column(String(50), nullable=False, index=True) # youtube, twitter, facebook, etc.
    platform_item_id = Column(String(255), nullable=False, index=True)
    author_handle = Column(String(255), nullable=False, index=True)
    author_name = Column(String(255), nullable=False)
    author_label = Column(String(50), default="neutral", index=True) # official, supporter, opposition, news-media, neutral

    permalink_url = Column(Text, nullable=False)
    canonical_url = Column(Text, nullable=False, index=True)
    text = Column(Text, nullable=False)
    media_type = Column(String(50), default="post") # video, reel, tweet, article
    language = Column(String(20), default="en", index=True)

    posted_at = Column(DateTime(timezone=True), nullable=False, index=True)
    first_seen_at = Column(DateTime(timezone=True), default=utcnow)
    last_checked_at = Column(DateTime(timezone=True), default=utcnow)
    link_status = Column(String(30), default="active", index=True) # active, deleted, private, unavailable

    sentiment_verdict = Column(String(30), default="Neutral", index=True) # Positive, Negative, Neutral, Mixed, Needs Review
    sentiment_score = Column(Float, default=0.0) # -100 to +100
    confidence = Column(Float, default=0.0)
    top_topic = Column(String(100), default="other", index=True)

    views = Column(Integer, default=0)
    likes = Column(Integer, default=0)
    shares = Column(Integer, default=0)
    comment_count = Column(Integer, default=0)

    negative_comment_count = Column(Integer, default=0, index=True)
    positive_comment_count = Column(Integer, default=0)
    neutral_comment_count = Column(Integer, default=0)
    mixed_comment_count = Column(Integer, default=0)
    negative_comment_pct = Column(Float, default=0.0)

    growth_velocity = Column(Float, default=0.0) # comments per hour or velocity metric
    alert_flag = Column(Boolean, default=False, index=True)
    alert_milestone = Column(Integer, default=0) # last milestone alerted (e.g. 500, 1000)
    matched_keywords = Column(JSON, default=list)

    # Relationships
    comments = relationship("Comment", back_populates="post", cascade="all, delete-orphan")
    snapshots = relationship("MetricSnapshot", back_populates="post", cascade="all, delete-orphan")
    alerts = relationship("Alert", back_populates="post", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("platform", "platform_item_id", name="uq_platform_item_id"),
    )
