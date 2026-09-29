from datetime import datetime, timezone
from sqlalchemy import Column, Integer, Float, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from app.database import Base

def utcnow():
    return datetime.now(timezone.utc)

class MetricSnapshot(Base):
    __tablename__ = "metric_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey("posts.id", ondelete="CASCADE"), nullable=False, index=True)
    snapshot_at = Column(DateTime(timezone=True), default=utcnow, index=True)

    views = Column(Integer, default=0)
    likes = Column(Integer, default=0)
    shares = Column(Integer, default=0)
    comments = Column(Integer, default=0)
    negative_comments = Column(Integer, default=0)
    velocity = Column(Float, default=0.0) # comments per hour

    # Relationships
    post = relationship("Post", back_populates="snapshots")

    __table_args__ = (
        Index("ix_snapshots_post_time", "post_id", "snapshot_at"),
    )
