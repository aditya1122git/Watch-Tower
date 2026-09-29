from datetime import datetime, timezone
from sqlalchemy import (
    Column, Integer, String, Text, Float, DateTime, ForeignKey, JSON, Index
)
from sqlalchemy.orm import relationship
from app.database import Base

def utcnow():
    return datetime.now(timezone.utc)

class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey("posts.id", ondelete="CASCADE"), nullable=False, index=True)

    alert_type = Column(String(50), nullable=False, index=True) # critical_500, velocity_burst, coordinated_campaign
    severity = Column(String(20), default="warning", index=True) # critical, warning, info
    milestone_value = Column(Integer, default=0) # 500, 1000, 2000

    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)

    negative_comment_count = Column(Integer, default=0)
    negative_pct = Column(Float, default=0.0)
    growth_rate = Column(Float, default=0.0)

    top_topics_json = Column(JSON, default=list)
    top_negative_comments_json = Column(JSON, default=list) # Array of {text, permalink, like_count}

    status = Column(String(30), default="active", index=True) # active, acknowledged, resolved
    acknowledged_by = Column(String(100), nullable=True)
    resolved_by = Column(String(100), nullable=True)

    triggered_at = Column(DateTime(timezone=True), default=utcnow, index=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    post = relationship("Post", back_populates="alerts")

    __table_args__ = (
        Index("ix_alerts_type_status", "alert_type", "status"),
    )
