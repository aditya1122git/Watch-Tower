from datetime import datetime, timezone
from sqlalchemy import (
    Column, Integer, String, Text, Float, Boolean, DateTime, ForeignKey, Index
)
from sqlalchemy.orm import relationship
from app.database import Base

def utcnow():
    return datetime.now(timezone.utc)

class Comment(Base):
    __tablename__ = "comments"

    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey("posts.id", ondelete="CASCADE"), nullable=False, index=True)
    platform_comment_id = Column(String(255), nullable=False, index=True)

    # Privacy & DPDP Act 2023: Hashed ID only, NEVER store raw handle or phone/email
    commenter_hash = Column(String(64), nullable=False, index=True)

    text = Column(Text, nullable=False)
    language = Column(String(20), default="en", index=True)
    timestamp = Column(DateTime(timezone=True), nullable=False, index=True)
    like_count = Column(Integer, default=0)
    parent_thread_id = Column(String(255), nullable=True)

    # Sentiment Results
    sentiment_label = Column(String(30), default="Neutral", index=True) # Positive, Negative, Neutral, Mixed
    sentiment_score = Column(Float, default=0.0) # -100 to +100
    confidence = Column(Float, default=0.0)
    target_of_sentiment = Column(String(100), default="Samrat Choudhary / Govt")
    topic = Column(String(100), default="other", index=True)
    is_sarcastic = Column(Boolean, default=False)
    is_abusive = Column(Boolean, default=False)
    reason_short = Column(Text, default="")

    permalink_url = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    # Relationships
    post = relationship("Post", back_populates="comments")

    __table_args__ = (
        Index("ix_comments_post_sentiment", "post_id", "sentiment_label"),
    )
