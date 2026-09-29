from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, desc, asc, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models.post import Post
from app.models.comment import Comment
from app.models.metric_snapshot import MetricSnapshot
from app.schemas.post import PostResponse
from app.schemas.comment import CommentResponse

router = APIRouter(prefix="/posts", tags=["posts"])

@router.get("", response_model=List[PostResponse])
async def list_posts(
    platform: Optional[str] = None,
    media_type: Optional[str] = None,
    sentiment: Optional[str] = None,
    author_label: Optional[str] = None,
    topic: Optional[str] = None,
    language: Optional[str] = None,
    link_status: Optional[str] = None,
    alert_only: Optional[bool] = None,
    search: Optional[str] = None,
    sort_by: str = Query("newest", pattern="^(newest|highest_reach|most_negative|velocity|engagement|most_positive)$"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db)
):
    query = select(Post)

    if platform:
        query = query.where(Post.platform == platform)
    if media_type:
        query = query.where(Post.media_type == media_type)
    if sentiment:
        query = query.where(Post.sentiment_verdict == sentiment)
    if author_label:
        query = query.where(Post.author_label == author_label)
    if topic:
        query = query.where(Post.top_topic == topic)
    if language:
        query = query.where(Post.language == language)
    if link_status:
        query = query.where(Post.link_status == link_status)
    if alert_only:
        query = query.where(Post.alert_flag == True)
    if search:
        search_pattern = f"%{search}%"
        query = query.where(
            or_(
                Post.text.ilike(search_pattern),
                Post.author_name.ilike(search_pattern),
                Post.author_handle.ilike(search_pattern)
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

@router.get("/{post_id}")
async def get_post_detail(post_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Post).where(Post.id == post_id))
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    # Get top 5 negative and top 5 positive comments
    neg_res = await db.execute(
        select(Comment)
        .where(Comment.post_id == post_id, Comment.sentiment_label == "Negative")
        .order_by(desc(Comment.like_count))
        .limit(5)
    )
    pos_res = await db.execute(
        select(Comment)
        .where(Comment.post_id == post_id, Comment.sentiment_label == "Positive")
        .order_by(desc(Comment.like_count))
        .limit(5)
    )

    # Get snapshots
    snap_res = await db.execute(
        select(MetricSnapshot)
        .where(MetricSnapshot.post_id == post_id)
        .order_by(asc(MetricSnapshot.snapshot_at))
    )

    return {
        "post": PostResponse.model_validate(post),
        "top_negative_comments": [CommentResponse.model_validate(c) for c in neg_res.scalars().all()],
        "top_positive_comments": [CommentResponse.model_validate(c) for c in pos_res.scalars().all()],
        "snapshots": [
            {
                "snapshot_at": s.snapshot_at,
                "views": s.views,
                "likes": s.likes,
                "comments": s.comments,
                "negative_comments": s.negative_comments,
                "velocity": s.velocity
            } for s in snap_res.scalars().all()
        ]
    }

@router.get("/{post_id}/comments", response_model=List[CommentResponse])
async def list_post_comments(
    post_id: int,
    sentiment: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db)
):
    query = select(Comment).where(Comment.post_id == post_id)
    if sentiment:
        query = query.where(Comment.sentiment_label == sentiment)
    query = query.order_by(desc(Comment.like_count), desc(Comment.timestamp)).offset(offset).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()
