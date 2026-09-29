from fastapi import APIRouter, Depends
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models.post import Post
from app.models.comment import Comment
from app.models.alert import Alert
from app.schemas.post import PostResponse

router = APIRouter(prefix="/stats", tags=["stats"])

@router.get("/overview")
async def get_overview_stats(db: AsyncSession = Depends(get_db)):
    # 1. Total counts
    total_posts = await db.scalar(select(func.count(Post.id))) or 0
    total_comments = await db.scalar(select(func.count(Comment.id))) or 0
    active_alerts = await db.scalar(select(func.count(Alert.id)).where(Alert.status == "active")) or 0

    # 2. Aggregated sentiment averages
    avg_score = await db.scalar(select(func.avg(Post.sentiment_score))) or 0.0
    total_negative_comments = await db.scalar(select(func.sum(Post.negative_comment_count))) or 0
    total_positive_comments = await db.scalar(select(func.sum(Post.positive_comment_count))) or 0
    total_neutral_comments = await db.scalar(select(func.sum(Post.neutral_comment_count))) or 0

    # 3. Platform breakdown
    platform_res = await db.execute(
        select(Post.platform, func.count(Post.id)).group_by(Post.platform)
    )
    platforms = {row[0]: row[1] for row in platform_res.all()}

    # 4. Verdict breakdown
    verdict_res = await db.execute(
        select(Post.sentiment_verdict, func.count(Post.id)).group_by(Post.sentiment_verdict)
    )
    verdicts = {row[0]: row[1] for row in verdict_res.all()}

    # 5. Top 5 Most Negative Posts (Focus on highest severity attacks & controversy)
    most_neg_res = await db.execute(
        select(Post)
        .where(Post.sentiment_verdict == "Negative")
        .order_by(Post.sentiment_score.asc(), desc(Post.negative_comment_count))
        .limit(5)
    )
    top_negative_posts = [PostResponse.model_validate(p) for p in most_neg_res.scalars().all()]

    # 6. Top 5 Most Positive Posts (Supportive & pro-govt achievements)
    most_pos_res = await db.execute(
        select(Post)
        .where(Post.sentiment_verdict == "Positive")
        .order_by(desc(Post.sentiment_score), desc(Post.positive_comment_count))
        .limit(5)
    )
    top_positive_posts = [PostResponse.model_validate(p) for p in most_pos_res.scalars().all()]

    return {
        "overall_sentiment_score": round(float(avg_score), 2),
        "total_posts": total_posts,
        "total_comments": total_comments,
        "active_alerts": active_alerts,
        "total_negative_comments": total_negative_comments,
        "total_positive_comments": total_positive_comments,
        "total_neutral_comments": total_neutral_comments,
        "platforms": platforms,
        "verdicts": verdicts,
        "top_negative_posts": top_negative_posts,
        "top_positive_posts": top_positive_posts
    }
