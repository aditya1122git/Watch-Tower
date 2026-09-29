import logging
import re
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
from sqlalchemy import select, or_, and_, desc
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.post import Post

logger = logging.getLogger(__name__)

TARGET_CHANNELS = [
    {
        "id": "news18_bihar",
        "name": "News18 Bihar/Jharkhand",
        "short_name": "News18",
        "color": "#E11D48", # Rose/Red
        "patterns": ["news18 bihar", "news 18 bihar", "news18 bihar/jharkhand", "news18 bihar jharkhand", "news18"]
    },
    {
        "id": "zee_bihar",
        "name": "Zee Bihar/Jharkhand",
        "short_name": "Zee Bihar",
        "color": "#2563EB", # Blue
        "patterns": ["zee bihar", "zee bihar/jharkhand", "zee bihar jharkhand", "zee news bihar"]
    },
    {
        "id": "abp_bihar",
        "name": "ABP Bihar",
        "short_name": "ABP Bihar",
        "color": "#DC2626", # Red
        "patterns": ["abp bihar", "abp news bihar", "abplive bihar", "abp news", "abp live"]
    },
    {
        "id": "news_state",
        "name": "News State Bihar/Jharkhand",
        "short_name": "News State",
        "color": "#D97706", # Amber
        "patterns": ["news state bihar", "news state bihar/jharkhand", "news state bihar jharkhand", "news state"]
    },
    {
        "id": "sahara_samay",
        "name": "Sahara Samay Bihar/Jharkhand",
        "short_name": "Sahara Samay",
        "color": "#059669", # Emerald
        "patterns": ["sahara samay bihar", "samay bihar", "sahara samay"]
    },
    {
        "id": "bihar_tak",
        "name": "Bihar Tak",
        "short_name": "Bihar Tak",
        "color": "#EA580C", # Orange
        "patterns": ["bihar tak", "bihartak", "tak"]
    },
    {
        "id": "first_bihar",
        "name": "First Bihar",
        "short_name": "First Bihar",
        "color": "#9333EA", # Purple
        "patterns": ["first bihar", "firstbihar", "first bihar jharkhand"]
    },
    {
        "id": "live_cities",
        "name": "Live Cities",
        "short_name": "Live Cities",
        "color": "#0284C7", # Sky blue
        "patterns": ["live cities", "livecities", "live cities media"]
    },
    {
        "id": "news4nation",
        "name": "News4Nation",
        "short_name": "News4Nation",
        "color": "#7C3AED", # Violet
        "patterns": ["news4nation", "news 4 nation"]
    },
    {
        "id": "hindustani_media",
        "name": "Hindustani Media",
        "short_name": "Hindustani Media",
        "color": "#16A34A", # Green
        "patterns": ["hindustani media", "hindustanimedia"]
    }
]

def match_bihar_channel(author_name: str, text: str) -> Optional[str]:
    """Matches author name or post text to one of the 10 target Bihar media channels."""
    author_lower = (author_name or "").lower()
    text_lower = (text or "").lower()

    for ch in TARGET_CHANNELS:
        for p in ch["patterns"]:
            if p in author_lower or f"| {p}" in text_lower or f"- {p}" in text_lower or f"#{p.replace(' ', '')}" in text_lower:
                return ch["id"]
    return None

async def generate_bihar_media_report(db: AsyncSession, hours: Optional[float] = None) -> Dict[str, Any]:
    """
    Analyzes coverage, positive/negative/neutral breakdown, and sentiment scores
    for all 10 target Bihar media channels, optionally within the last N hours.
    """
    posts: List[Post] = []
    if hours is not None and hours > 0:
        from datetime import timedelta
        cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
        query = select(Post).where(Post.posted_at >= cutoff).order_by(desc(Post.posted_at)).limit(300)
        res = await db.execute(query)
        posts = res.scalars().all()

    # If no posts in strict window (e.g. overnight or startup), fallback to latest broadcasts
    if not posts:
        query = select(Post).order_by(desc(Post.posted_at)).limit(300)
        res = await db.execute(query)
        posts = res.scalars().all()

    # Buckets for all 10 channels
    channel_buckets: Dict[str, List[Post]] = {ch["id"]: [] for ch in TARGET_CHANNELS}
    unmatched_news: List[Post] = []

    for post in posts:
        matched_id = match_bihar_channel(post.author_name, post.text)
        if matched_id:
            channel_buckets[matched_id].append(post)
        elif post.author_label == "news-media" or any(w in (post.author_name or "").lower() for w in ["news", "media", "tak", "times"]):
            unmatched_news.append(post)

    # Compile report per channel
    channel_reports: List[Dict[str, Any]] = []
    graph_categories: List[str] = []
    graph_positive: List[int] = []
    graph_negative: List[int] = []
    graph_neutral: List[int] = []
    graph_scores: List[float] = []

    total_tracked_count = 0
    total_negative_count = 0
    total_positive_count = 0
    total_neutral_count = 0

    for ch in TARGET_CHANNELS:
        ch_id = ch["id"]
        ch_posts = channel_buckets[ch_id]

        total = len(ch_posts)
        pos = sum(1 for p in ch_posts if p.sentiment_verdict == "Positive")
        neg = sum(1 for p in ch_posts if p.sentiment_verdict == "Negative")
        neu = total - (pos + neg)

        scores = [p.sentiment_score for p in ch_posts if p.sentiment_score is not None]
        avg_score = round(sum(scores) / len(scores), 1) if scores else 0.0

        if neg > pos:
            stance = "Critical (आलोचनात्मक)"
            stance_color = "rose"
        elif pos > neg:
            stance = "Supportive (सकारात्मक)"
            stance_color = "emerald"
        else:
            stance = "Balanced / Neutral (तटस्थ)"
            stance_color = "slate"

        recent_posts_data = []
        for p in ch_posts[:4]:
            recent_posts_data.append({
                "id": p.id,
                "title": p.text[:100],
                "permalink_url": p.permalink_url,
                "platform": p.platform,
                "sentiment_verdict": p.sentiment_verdict,
                "sentiment_score": p.sentiment_score,
                "views": p.views,
                "posted_at": p.posted_at.isoformat() if p.posted_at else None
            })

        channel_reports.append({
            "id": ch["id"],
            "name": ch["name"],
            "short_name": ch["short_name"],
            "color": ch["color"],
            "total_posts": total,
            "positive_count": pos,
            "negative_count": neg,
            "neutral_count": neu,
            "sentiment_score": avg_score,
            "stance": stance,
            "stance_color": stance_color,
            "recent_posts": recent_posts_data
        })

        graph_categories.append(ch["short_name"])
        graph_positive.append(pos)
        graph_negative.append(neg)
        graph_neutral.append(neu)
        graph_scores.append(avg_score)

        total_tracked_count += total
        total_negative_count += neg
        total_positive_count += pos
        total_neutral_count += neu

    # Ranking by critical intensity (most negative channels at top)
    critical_ranking = sorted(channel_reports, key=lambda c: (c["negative_count"], -c["sentiment_score"]), reverse=True)
    supportive_ranking = sorted(channel_reports, key=lambda c: (c["positive_count"], c["sentiment_score"]), reverse=True)

    return {
        "status": "success",
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "summary": {
            "total_channels": len(TARGET_CHANNELS),
            "total_posts_tracked": total_tracked_count,
            "total_negative_posts": total_negative_count,
            "total_positive_posts": total_positive_count,
            "total_neutral_posts": total_neutral_count,
            "top_critical_channel": critical_ranking[0]["name"] if critical_ranking and critical_ranking[0]["total_posts"] > 0 else "None",
            "top_supportive_channel": supportive_ranking[0]["name"] if supportive_ranking and supportive_ranking[0]["total_posts"] > 0 else "None"
        },
        "channels": channel_reports,
        "graph_data": {
            "categories": graph_categories,
            "series": {
                "positive": graph_positive,
                "negative": graph_negative,
                "neutral": graph_neutral,
                "net_scores": graph_scores
            }
        },
        "rankings": {
            "most_critical": [c["name"] for c in critical_ranking[:5] if c["negative_count"] > 0],
            "most_supportive": [c["name"] for c in supportive_ranking[:5] if c["positive_count"] > 0]
        }
    }
