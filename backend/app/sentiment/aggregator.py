from typing import List, Dict, Any
from collections import Counter

def aggregate_post_sentiment(
    post_text_sentiment: Dict[str, Any],
    author_label: str,
    comments_sentiments: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Combines:
    1. Comment sentiment distribution (weighted by engagement/likes)
    2. Post body text stance
    3. Author channel label (official / supporter / opposition / news-media / neutral)
    Produces final verdict, score (-100 to +100), confidence, and top topic.
    """
    total_comments = len(comments_sentiments)

    # 1. Base score from post caption itself
    caption_label = post_text_sentiment.get("label", "Neutral")
    caption_score = 50.0 if caption_label == "Positive" else (-50.0 if caption_label == "Negative" else 0.0)

    # Author label bias
    author_bias = 0.0
    if author_label in ("official", "supporter"):
        author_bias = 15.0
    elif author_label == "opposition":
        author_bias = -25.0

    if total_comments == 0:
        final_score = max(-100.0, min(100.0, caption_score + author_bias))
        verdict = "Positive" if final_score > 20 else ("Negative" if final_score < -20 else "Neutral")
        return {
            "verdict": verdict,
            "sentiment_score": round(final_score, 1),
            "confidence": post_text_sentiment.get("confidence", 0.8),
            "negative_comment_count": 0,
            "positive_comment_count": 0,
            "neutral_comment_count": 0,
            "mixed_comment_count": 0,
            "negative_pct": 0.0,
            "top_topic": post_text_sentiment.get("topic", "other")
        }

    # 2. Aggregate comments
    pos_count = 0
    neg_count = 0
    neu_count = 0
    mix_count = 0
    topics = []

    weighted_sum = 0.0
    total_weight = 0.0

    for c in comments_sentiments:
        lbl = c.get("label", "Neutral")
        weight = 1.0 + min(5.0, c.get("like_count", 0) / 50.0)
        total_weight += weight
        topics.append(c.get("topic", "other"))

        if lbl == "Positive":
            pos_count += 1
            weighted_sum += (100.0 * weight)
        elif lbl == "Negative":
            neg_count += 1
            weighted_sum += (-100.0 * weight)
        elif lbl == "Mixed":
            mix_count += 1
            weighted_sum += (0.0 * weight)
        else:
            neu_count += 1
            weighted_sum += (0.0 * weight)

    comment_avg_score = weighted_sum / max(1.0, total_weight)

    # Blend: 70% comment reaction + 20% post text + 10% author baseline
    blended_score = (0.70 * comment_avg_score) + (0.20 * caption_score) + (0.10 * author_bias)
    final_score = max(-100.0, min(100.0, blended_score))

    neg_pct = (neg_count / total_comments) * 100.0

    # Top topic
    most_common_topics = Counter(t for t in topics if t != "other").most_common(1)
    top_topic = most_common_topics[0][0] if most_common_topics else post_text_sentiment.get("topic", "other")

    # Verdict determination
    if neg_pct >= 55.0 or final_score <= -30.0:
        verdict = "Negative"
    elif (pos_count / total_comments) >= 0.50 or final_score >= 30.0:
        verdict = "Positive"
    elif mix_count > pos_count and mix_count > neg_count:
        verdict = "Mixed"
    elif (pos_count > 0 and neg_count > 0 and abs(pos_count - neg_count) <= 0.15 * total_comments):
        verdict = "Mixed"
    else:
        verdict = "Neutral"

    confidence = min(0.98, 0.75 + (total_comments / 1000.0))

    return {
        "verdict": verdict,
        "sentiment_score": round(final_score, 1),
        "confidence": round(confidence, 2),
        "negative_comment_count": neg_count,
        "positive_comment_count": pos_count,
        "neutral_comment_count": neu_count,
        "mixed_comment_count": mix_count,
        "negative_pct": round(neg_pct, 2),
        "top_topic": top_topic
    }
