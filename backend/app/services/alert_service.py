import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional, Set
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.post import Post
from app.models.comment import Comment
from app.models.alert import Alert
from app.config import settings

logger = logging.getLogger(__name__)

# Real-time SSE event bus subscribers
sse_subscribers: Set[asyncio.Queue] = set()

async def broadcast_event(event_name: str, payload: Dict[str, Any]):
    """Broadcasts arbitrary event and payload to all connected SSE clients."""
    for queue in list(sse_subscribers):
        try:
            await queue.put({"event": event_name, "data": payload})
        except Exception:
            sse_subscribers.discard(queue)

async def broadcast_alert(alert_data: Dict[str, Any]):
    """Broadcasts alert payload to all connected SSE clients."""
    await broadcast_event("alert", alert_data)

def compute_jaccard_similarity(text1: str, text2: str) -> float:
    """Computes token Jaccard similarity between two texts."""
    tokens1 = set(text1.lower().split())
    tokens2 = set(text2.lower().split())
    if not tokens1 or not tokens2:
        return 0.0
    intersection = tokens1.intersection(tokens2)
    union = tokens1.union(tokens2)
    return len(intersection) / len(union)

def detect_coordinated_activity(comments: List[Comment]) -> Optional[Dict[str, Any]]:
    """
    Heuristic bot/coordinated campaign detector:
    - Identifies clusters of near-duplicate comments within short time windows.
    - Never states as definitive fact; flags as 'Possible coordinated/bot campaign'.
    """
    if len(comments) < 5:
        return None

    # Sort comments chronologically
    sorted_comments = sorted(comments, key=lambda c: c.timestamp)
    window = timedelta(minutes=20)

    # Group comments by time window and compare text similarity
    clusters = []
    for i in range(len(sorted_comments)):
        c_i = sorted_comments[i]
        current_cluster = [c_i]
        for j in range(i + 1, len(sorted_comments)):
            c_j = sorted_comments[j]
            if (c_j.timestamp - c_i.timestamp) > window:
                break
            similarity = compute_jaccard_similarity(c_i.text, c_j.text)
            if similarity >= 0.70:
                current_cluster.append(c_j)

        if len(current_cluster) >= 5:
            clusters.append(current_cluster)

    if clusters:
        largest_cluster = max(clusters, key=len)
        sample_text = largest_cluster[0].text[:80]
        confidence = min(0.92, 0.65 + (len(largest_cluster) * 0.04))
        return {
            "is_flagged": True,
            "confidence": round(confidence, 2),
            "cluster_size": len(largest_cluster),
            "sample_snippet": sample_text,
            "note": "Possible coordinated/bot campaign detected based on near-duplicate comment patterns."
        }
    return None

async def evaluate_post_alerts(db: AsyncSession, post_id: int) -> List[Alert]:
    """
    Evaluates alerts for a post:
    1. CRITICAL: Crossing 500 negative comments (deduplicated; re-fires at 1000, 1500, 2000...).
    2. WARNING: Velocity spike (>100 negative in 30 min) or negative share > 60%.
    3. COORDINATED: Bot activity heuristic.
    """
    post_res = await db.execute(select(Post).where(Post.id == post_id))
    post = post_res.scalar_one_or_none()
    if not post:
        return []

    alerts_created: List[Alert] = []
    now = datetime.now(timezone.utc)

    # Fetch top negative comments with deep links
    neg_comments_res = await db.execute(
        select(Comment)
        .where(Comment.post_id == post_id, Comment.sentiment_label == "Negative")
        .order_by(desc(Comment.like_count), desc(Comment.timestamp))
        .limit(5)
    )
    top_neg_comments = neg_comments_res.scalars().all()
    top_neg_json = [
        {
            "platform_comment_id": c.platform_comment_id,
            "text": c.text,
            "permalink": c.permalink_url,
            "like_count": c.like_count,
            "topic": c.topic
        } for c in top_neg_comments
    ]

    # Rule 0: Real-Time Critical Negative Coverage / Controversy Alert
    if post.sentiment_verdict == "Negative":
        existing_alert_res = await db.execute(
            select(Alert).where(Alert.post_id == post_id, Alert.status == "active")
        )
        if not existing_alert_res.scalar_one_or_none():
            is_breaking_critical = (
                post.sentiment_score <= -50 or
                post.views >= 20000 or
                any(kw in (post.text or "").lower() for kw in ["fir", "case", "केस", "pocso", "जेल", "आरोप", "विवाद", "बवाल", "इस्तीफा", "प्रशांत किशोर", "मीसा भारती"])
            )
            sev = "critical" if is_breaking_critical else "warning"
            title = f"🔴 {sev.upper()}: {post.platform.title()} पर ताज़ा नकारात्मक खबर — {(post.text or '')[:65]}"
            message = (
                f"ताज़ा नकारात्मक पोस्ट/कवरेज ({post.platform.title()}):\n"
                f"'{post.text}'\n"
                f"Sentiment Score: {post.sentiment_score:.1f} | Views: {post.views:,} | Account: {post.author_name or 'Public'}"
            )
            breaking_alert = Alert(
                post_id=post.id,
                alert_type="breaking_negative_news",
                severity=sev,
                milestone_value=post.views or 1,
                title=title,
                message=message,
                negative_comment_count=post.negative_comment_count or len(top_neg_comments),
                negative_pct=post.negative_comment_pct if post.negative_comment_pct > 0 else 85.0,
                growth_rate=post.growth_velocity,
                top_topics_json=[post.top_topic or "Controversy/Law & Order"],
                top_negative_comments_json=top_neg_json,
                status="active",
                triggered_at=now
            )
            db.add(breaking_alert)
            post.alert_flag = True
            alerts_created.append(breaking_alert)

    # Rule 1: CRITICAL milestone (500, 1000, 1500, 2000...)
    milestone_step = 500
    current_milestone = (post.negative_comment_count // milestone_step) * milestone_step

    if current_milestone >= 500 and current_milestone > (post.alert_milestone or 0):
        # Fire Critical Alert
        title = f"CRITICAL: Single post crossed {current_milestone}+ negative comments"
        message = (
            f"Post '{post.text[:80]}...' on {post.platform.upper()} has accumulated "
            f"{post.negative_comment_count} negative comments ({post.negative_comment_pct:.1f}% negative). "
            f"Growth rate: {post.growth_velocity:.1f} comments/hr."
        )

        crit_alert = Alert(
            post_id=post.id,
            alert_type="critical_500",
            severity="critical",
            milestone_value=current_milestone,
            title=title,
            message=message,
            negative_comment_count=post.negative_comment_count,
            negative_pct=post.negative_comment_pct,
            growth_rate=post.growth_velocity,
            top_topics_json=[post.top_topic] if post.top_topic else ["other"],
            top_negative_comments_json=top_neg_json,
            status="active",
            triggered_at=now
        )
        db.add(crit_alert)

        # Update post milestone and alert_flag
        post.alert_flag = True
        post.alert_milestone = current_milestone
        alerts_created.append(crit_alert)

    # Rule 2: WARNING Velocity Spike (>100 negative in 30 min)
    thirty_min_ago = now - timedelta(minutes=30)
    recent_neg_count_res = await db.execute(
        select(Comment)
        .where(
            Comment.post_id == post_id,
            Comment.sentiment_label == "Negative",
            Comment.timestamp >= thirty_min_ago
        )
    )
    recent_negatives = recent_neg_count_res.scalars().all()
    if len(recent_negatives) >= 100:
        # Check if already triggered recently
        existing_velocity_alert = await db.execute(
            select(Alert).where(
                Alert.post_id == post_id,
                Alert.alert_type == "velocity_spike",
                Alert.triggered_at >= thirty_min_ago
            )
        )
        if not existing_velocity_alert.scalar_one_or_none():
            warn_alert = Alert(
                post_id=post.id,
                alert_type="velocity_spike",
                severity="warning",
                milestone_value=len(recent_negatives),
                title="WARNING: Rapid negative comment velocity spike",
                message=f"Post has received {len(recent_negatives)} negative comments in the last 30 minutes.",
                negative_comment_count=post.negative_comment_count,
                negative_pct=post.negative_comment_pct,
                growth_rate=float(len(recent_negatives) * 2),
                top_topics_json=[post.top_topic],
                top_negative_comments_json=top_neg_json,
                status="active",
                triggered_at=now
            )
            db.add(warn_alert)
            alerts_created.append(warn_alert)

    # Rule 3: Coordinated activity / bot campaign heuristic
    all_comments_res = await db.execute(
        select(Comment).where(Comment.post_id == post_id).order_by(desc(Comment.timestamp)).limit(50)
    )
    bot_signal = detect_coordinated_activity(all_comments_res.scalars().all())
    if bot_signal and bot_signal["is_flagged"]:
        existing_coord = await db.execute(
            select(Alert).where(
                Alert.post_id == post_id,
                Alert.alert_type == "coordinated_campaign",
                Alert.status == "active"
            )
        )
        if not existing_coord.scalar_one_or_none():
            coord_alert = Alert(
                post_id=post.id,
                alert_type="coordinated_campaign",
                severity="warning",
                milestone_value=bot_signal["cluster_size"],
                title=f"Possible coordinated/bot campaign (Confidence: {int(bot_signal['confidence'] * 100)}%)",
                message=f"Detected cluster of {bot_signal['cluster_size']} near-duplicate comments within 20 mins. Sample: '{bot_signal['sample_snippet']}'",
                negative_comment_count=post.negative_comment_count,
                negative_pct=post.negative_comment_pct,
                growth_rate=post.growth_velocity,
                top_topics_json=[post.top_topic],
                top_negative_comments_json=top_neg_json,
                status="active",
                triggered_at=now
            )
            db.add(coord_alert)
            alerts_created.append(coord_alert)

    if alerts_created:
        await db.commit()
        for a in alerts_created:
            await broadcast_alert({
                "id": a.id,
                "post_id": a.post_id,
                "post_permalink": post.permalink_url,
                "post_title": post.text,
                "platform": post.platform,
                "alert_type": a.alert_type,
                "severity": a.severity,
                "title": a.title,
                "message": a.message,
                "milestone_value": a.milestone_value,
                "negative_comment_count": a.negative_comment_count,
                "triggered_at": a.triggered_at.isoformat()
            })

            # Auto-send to Telegram immediately
            try:
                from app.services.telegram_alert_service import telegram_alert_service
                await telegram_alert_service.dispatch_crisis_alert(a, post)
            except Exception as te:
                logger.warning(f"Auto-send to Telegram failed for alert {a.id}: {te}")

    return alerts_created
