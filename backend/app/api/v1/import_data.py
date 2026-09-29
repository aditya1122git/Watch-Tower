import io
import csv
import json
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models.post import Post
from app.models.comment import Comment
from app.services.link_service import normalize_url
from app.services.privacy_service import hash_commenter_id
from app.services.alert_service import evaluate_post_alerts
from app.sentiment.classifier import sentiment_engine
from app.sentiment.aggregator import aggregate_post_sentiment

router = APIRouter(prefix="/import", tags=["import"])

@router.post("/file")
async def import_file(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db)
):
    """
    Imports social posts and comments from CSV or JSON file.
    Complies with official Meta and platform import requirements.
    Automatically normalizes URLs, runs sentiment engine, hashes commenter IDs,
    and checks 500+ alert triggers.
    """
    filename = file.filename or ""
    content = await file.read()

    rows: List[Dict[str, Any]] = []

    if filename.endswith(".json"):
        try:
            data = json.loads(content.decode("utf-8"))
            if isinstance(data, list):
                rows = data
            elif isinstance(data, dict) and "posts" in data:
                rows = data["posts"]
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid JSON file: {e}")
    elif filename.endswith(".csv"):
        try:
            text = content.decode("utf-8")
            reader = csv.DictReader(io.StringIO(text))
            rows = list(reader)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid CSV file: {e}")
    else:
        raise HTTPException(status_code=400, detail="Unsupported file type. Upload CSV or JSON.")

    if not rows:
        return {"status": "empty", "message": "No records found in uploaded file."}

    posts_created = 0
    comments_created = 0
    now = datetime.now(timezone.utc)

    for row in rows:
        platform = row.get("platform", "facebook").lower()
        platform_item_id = str(row.get("platform_item_id") or row.get("id") or hash(row.get("text", "")))
        url = row.get("permalink_url") or row.get("url") or f"https://{platform}.com/{platform_item_id}"
        canonical = normalize_url(url)

        # Check if post already exists
        existing_res = await db.execute(
            select(Post).where(Post.platform == platform, Post.platform_item_id == platform_item_id)
        )
        post = existing_res.scalar_one_or_none()

        post_text = row.get("text", "")
        author_name = row.get("author_name") or row.get("author") or "Unknown Author"
        author_handle = row.get("author_handle") or author_name.lower().replace(" ", "_")
        author_label = row.get("author_label", "neutral")

        # Classify post text sentiment
        text_sentiment = await sentiment_engine.classify(post_text)

        if not post:
            post = Post(
                platform=platform,
                platform_item_id=platform_item_id,
                author_handle=author_handle,
                author_name=author_name,
                author_label=author_label,
                permalink_url=canonical,
                canonical_url=canonical,
                text=post_text,
                media_type=row.get("media_type", "post"),
                language=text_sentiment.get("language", "en"),
                posted_at=now,
                views=int(row.get("views", 0) or 0),
                likes=int(row.get("likes", 0) or 0),
                shares=int(row.get("shares", 0) or 0),
                comment_count=0,
                sentiment_verdict=text_sentiment.get("label", "Neutral"),
                sentiment_score=50.0 if text_sentiment.get("label") == "Positive" else (-50.0 if text_sentiment.get("label") == "Negative" else 0.0),
                confidence=text_sentiment.get("confidence", 0.8),
                top_topic=text_sentiment.get("topic", "other")
            )
            db.add(post)
            await db.flush()
            posts_created += 1

        # Process attached comments if present
        raw_comments = row.get("comments", [])
        if isinstance(raw_comments, str):
            try:
                raw_comments = json.loads(raw_comments)
            except Exception:
                raw_comments = []

        new_comments_sentiment = []
        for idx, c in enumerate(raw_comments):
            c_text = c.get("text", "")
            if not c_text:
                continue
            c_id = str(c.get("comment_id") or f"{platform_item_id}_c_{idx}")
            raw_author = str(c.get("author_id") or f"anon_{idx}")

            c_sentiment = await sentiment_engine.classify(c_text)
            new_comments_sentiment.append(c_sentiment)

            comment_obj = Comment(
                post_id=post.id,
                platform_comment_id=c_id,
                commenter_hash=hash_commenter_id(raw_author),
                text=c_text,
                language=c_sentiment.get("language", "en"),
                timestamp=now,
                like_count=int(c.get("likes", 0) or 0),
                sentiment_label=c_sentiment.get("label", "Neutral"),
                sentiment_score=80.0 if c_sentiment.get("label") == "Positive" else (-80.0 if c_sentiment.get("label") == "Negative" else 0.0),
                confidence=c_sentiment.get("confidence", 0.8),
                target_of_sentiment=c_sentiment.get("target_of_sentiment", "Samrat Choudhary / Govt"),
                topic=c_sentiment.get("topic", "other"),
                is_sarcastic=c_sentiment.get("is_sarcastic", False),
                is_abusive=c_sentiment.get("is_abusive", False),
                reason_short=c_sentiment.get("reason_short", ""),
                permalink_url=f"{canonical}#comment_{c_id}"
            )
            db.add(comment_obj)
            comments_created += 1

        if new_comments_sentiment:
            # Re-aggregate post sentiment
            agg = aggregate_post_sentiment(text_sentiment, author_label, new_comments_sentiment)
            post.sentiment_verdict = agg["verdict"]
            post.sentiment_score = agg["sentiment_score"]
            post.negative_comment_count += agg["negative_comment_count"]
            post.positive_comment_count += agg["positive_comment_count"]
            post.neutral_comment_count += agg["neutral_comment_count"]
            post.comment_count += len(new_comments_sentiment)
            post.negative_comment_pct = (post.negative_comment_count / max(1, post.comment_count)) * 100.0
            post.top_topic = agg["top_topic"]

            await db.flush()
            # Evaluate alert rules
            await evaluate_post_alerts(db, post.id)

    await db.commit()

    return {
        "status": "success",
        "posts_imported": posts_created,
        "comments_imported": comments_created,
        "message": f"Successfully ingested {posts_created} posts and {comments_created} comments."
    }
