import io
import csv
from datetime import datetime, timezone, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import select, desc, or_
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models.post import Post
from app.schemas.post import PostResponse

router = APIRouter(prefix="/links", tags=["links"])

@router.get("", response_model=List[PostResponse])
async def explore_links(
    tab: str = Query("all", pattern="^(all|positive|negative|neutral|mixed|needs_review|alerted)$"),
    platform: Optional[str] = None,
    source_category: Optional[str] = Query(None, pattern="^(news_channel|youtube|facebook|instagram|twitter|all)$"),
    time_window: Optional[str] = Query(None, pattern="^(4h|12h|24h|all)$"),
    hours: Optional[float] = Query(None),
    media_type: Optional[str] = None,
    author_label: Optional[str] = None,
    topic: Optional[str] = None,
    language: Optional[str] = None,
    search: Optional[str] = None,
    from_date: Optional[datetime] = None,
    to_date: Optional[datetime] = None,
    sort_by: str = Query("newest", pattern="^(newest|highest_reach|most_negative|velocity|engagement|most_positive)$"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db)
):
    query = select(Post)

    # Tab filtering
    if tab == "positive":
        query = query.where(Post.sentiment_verdict == "Positive")
    elif tab == "negative":
        query = query.where(Post.sentiment_verdict == "Negative")
    elif tab == "neutral":
        query = query.where(Post.sentiment_verdict == "Neutral")
    elif tab == "mixed":
        query = query.where(Post.sentiment_verdict == "Mixed")
    elif tab == "needs_review":
        query = query.where(or_(Post.confidence < 0.75, Post.sentiment_verdict == "Needs Review"))
    elif tab == "alerted":
        query = query.where(Post.alert_flag == True)

    # Source Category Filtering: Separates News Channels, YouTube, Facebook, Instagram
    if source_category == "news_channel":
        news_keywords = ["news", "media", "tak", "zee", "abp", "aaj", "bharat", "jagran", "bhaskar", "hindustan", "cities", "nation", "prabhat", "kashish", "times", "express", "patrika", "samachar", "khabar", "etv", "sahara"]
        news_patterns = [Post.author_name.ilike(f"%{kw}%") for kw in news_keywords]
        query = query.where(
            or_(
                Post.author_label == "news-media",
                Post.media_type.in_(["news_bulletin", "article"]),
                Post.platform == "rss",
                *news_patterns
            )
        )
    elif source_category == "youtube":
        query = query.where(Post.platform == "youtube")
    elif source_category == "facebook":
        query = query.where(Post.platform == "facebook")
    elif source_category == "instagram":
        query = query.where(Post.platform == "instagram")
    elif source_category == "twitter":
        query = query.where(Post.platform == "twitter")

    # Time Window Freshness Filtering (Within 4 hours, 12h, 24h)
    now_utc = datetime.now(timezone.utc)
    if time_window == "4h" or hours == 4:
        query = query.where(Post.posted_at >= now_utc - timedelta(hours=4))
    elif time_window == "12h" or hours == 12:
        query = query.where(Post.posted_at >= now_utc - timedelta(hours=12))
    elif time_window == "24h" or hours == 24:
        query = query.where(Post.posted_at >= now_utc - timedelta(hours=24))
    elif hours is not None and hours > 0:
        query = query.where(Post.posted_at >= now_utc - timedelta(hours=hours))

    if platform:
        query = query.where(Post.platform == platform)
    if media_type:
        query = query.where(Post.media_type == media_type)
    if author_label:
        query = query.where(Post.author_label == author_label)
    if topic:
        query = query.where(Post.top_topic == topic)
    if language:
        query = query.where(Post.language == language)
    if from_date:
        query = query.where(Post.posted_at >= from_date)
    if to_date:
        query = query.where(Post.posted_at <= to_date)
    if search:
        pattern = f"%{search}%"
        query = query.where(
            or_(
                Post.text.ilike(pattern),
                Post.author_name.ilike(pattern),
                Post.author_handle.ilike(pattern)
            )
        )

    # Sorting
    if sort_by == "highest_reach":
        query = query.order_by(desc(Post.views))
    elif sort_by == "most_negative":
        query = query.order_by(Post.sentiment_score.asc(), desc(Post.negative_comment_count))
    elif sort_by == "most_positive":
        query = query.order_by(desc(Post.sentiment_score), desc(Post.views))
    elif sort_by == "velocity":
        query = query.order_by(desc(Post.growth_velocity))
    elif sort_by == "engagement":
        query = query.order_by(desc(Post.likes + Post.comment_count + Post.shares))
    else:
        query = query.order_by(desc(Post.posted_at))

    query = query.offset(offset).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()

@router.get("/export")
async def export_links(
    tab: str = "all",
    platform: Optional[str] = None,
    source_category: Optional[str] = Query(None, pattern="^(news_channel|youtube|facebook|instagram|twitter|all)$"),
    time_window: Optional[str] = Query(None, pattern="^(4h|12h|24h|all)$"),
    hours: Optional[float] = Query(None),
    media_type: Optional[str] = None,
    author_label: Optional[str] = None,
    topic: Optional[str] = None,
    language: Optional[str] = None,
    search: Optional[str] = None,
    from_date: Optional[datetime] = None,
    to_date: Optional[datetime] = None,
    db: AsyncSession = Depends(get_db)
):
    """
    Exports filtered links directly to CSV. Row count matches the exact filter results.
    """
    query = select(Post)

    if tab == "positive":
        query = query.where(Post.sentiment_verdict == "Positive")
    elif tab == "negative":
        query = query.where(Post.sentiment_verdict == "Negative")
    elif tab == "neutral":
        query = query.where(Post.sentiment_verdict == "Neutral")
    elif tab == "mixed":
        query = query.where(Post.sentiment_verdict == "Mixed")
    elif tab == "needs_review":
        query = query.where(or_(Post.confidence < 0.75, Post.sentiment_verdict == "Needs Review"))
    elif tab == "alerted":
        query = query.where(Post.alert_flag == True)

    if source_category == "news_channel":
        news_keywords = ["news", "media", "tak", "zee", "abp", "aaj", "bharat", "jagran", "bhaskar", "hindustan", "cities", "nation", "prabhat", "kashish", "times", "express", "patrika", "samachar", "khabar", "etv", "sahara"]
        news_patterns = [Post.author_name.ilike(f"%{kw}%") for kw in news_keywords]
        query = query.where(
            or_(
                Post.author_label == "news-media",
                Post.media_type.in_(["news_bulletin", "article"]),
                Post.platform == "rss",
                *news_patterns
            )
        )
    elif source_category == "youtube":
        query = query.where(Post.platform == "youtube")
    elif source_category == "facebook":
        query = query.where(Post.platform == "facebook")
    elif source_category == "instagram":
        query = query.where(Post.platform == "instagram")
    elif source_category == "twitter":
        query = query.where(Post.platform == "twitter")

    now_utc = datetime.now(timezone.utc)
    if time_window == "4h" or hours == 4:
        query = query.where(Post.posted_at >= now_utc - timedelta(hours=4))
    elif time_window == "12h" or hours == 12:
        query = query.where(Post.posted_at >= now_utc - timedelta(hours=12))
    elif time_window == "24h" or hours == 24:
        query = query.where(Post.posted_at >= now_utc - timedelta(hours=24))
    elif hours is not None and hours > 0:
        query = query.where(Post.posted_at >= now_utc - timedelta(hours=hours))

    if platform:
        query = query.where(Post.platform == platform)
    if media_type:
        query = query.where(Post.media_type == media_type)
    if author_label:
        query = query.where(Post.author_label == author_label)
    if topic:
        query = query.where(Post.top_topic == topic)
    if language:
        query = query.where(Post.language == language)
    if from_date:
        query = query.where(Post.posted_at >= from_date)
    if to_date:
        query = query.where(Post.posted_at <= to_date)
    if search:
        pattern = f"%{search}%"
        query = query.where(
            or_(
                Post.text.ilike(pattern),
                Post.author_name.ilike(pattern),
                Post.author_handle.ilike(pattern)
            )
        )

    query = query.order_by(desc(Post.posted_at))
    result = await db.execute(query)
    posts = result.scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "id", "sentiment", "sentiment_score", "platform", "page_name",
        "author_handle", "url", "posted_at", "reach_views", "likes",
        "shares", "comment_count", "negative_comments", "negative_pct",
        "topic", "alert_flag", "link_status"
    ])

    for p in posts:
        writer.writerow([
            p.id,
            p.sentiment_verdict,
            p.sentiment_score,
            p.platform,
            p.author_name,
            p.author_handle,
            p.permalink_url,
            p.posted_at.isoformat() if p.posted_at else "",
            p.views,
            p.likes,
            p.shares,
            p.comment_count,
            p.negative_comment_count,
            f"{p.negative_comment_pct:.2f}%",
            p.top_topic,
            "YES" if p.alert_flag else "NO",
            p.link_status
        ])

    csv_data = output.getvalue()
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=watchtower_links_{tab}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"}
    )
