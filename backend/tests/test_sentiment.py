import pytest
from app.sentiment.normalizer import normalize_text, check_abusive, compute_text_hash
from app.sentiment.detector import detect_language
from app.sentiment.classifier import sentiment_engine
from app.sentiment.local_fallback import classify_local_fallback
from app.sentiment.aggregator import aggregate_post_sentiment
from app.sentiment.eval_runner import run_evaluation

def test_text_normalizer_and_abuse():
    raw = "  मुख्यमंत्री  सम्राट   चौधरी   जी!  \u200B\n\n\n\nविकास कार्य बहुत बढ़िया। "
    cleaned = normalize_text(raw)
    assert "  " not in cleaned
    assert "\u200B" not in cleaned
    assert cleaned.startswith("मुख्यमंत्री")

    # Abuse check
    assert check_abusive("Ye sab chor aur chutiya hain") is True
    assert check_abusive("Sarkar ko kaam karna chahiye") is False

    # Hash consistency
    h1 = compute_text_hash("Samrat Choudhary")
    h2 = compute_text_hash("Samrat Choudhary  ")
    assert h1 == h2

def test_language_detection():
    # Hindi Devanagari
    assert detect_language("बिहार में सड़कों का काम बहुत तेजी से चल रहा है।") == "hi"
    # Bhojpuri
    assert detect_language("का हो सम्राट बाबू, कब ले पुल बन के तइयार होई?") == "bho"
    # Hinglish
    assert detect_language("Patna metro project me speed bohot accha hai bhaiya") == "hinglish"
    # English
    assert detect_language("The Chief Minister held a review meeting with administrative officers.") == "en"

@pytest.mark.asyncio
async def test_target_based_sentiment_classification():
    # 1. Pro-CM direct praise
    res1 = await sentiment_engine.classify("माननीय मुख्यमंत्री सम्राट चौधरी जी के नेतृत्व में बिहार तेजी से प्रगति कर रहा है।")
    assert res1["label"] == "Positive"
    assert res1["confidence"] >= 0.70

    # 2. Anti-CM governance failure
    res2 = await sentiment_engine.classify("पेपर लीक पर सरकार पूरी तरह नाकाम साबित हुई है। युवाओं का भविष्य बर्बाद हो रहा है।")
    assert res2["label"] == "Negative"
    assert res2["topic"] in ("education", "jobs", "corruption")

    # 3. Negation handling ("vikas nahi hua")
    res3 = await sentiment_engine.classify("कोई विकास नहीं हुआ है, सिर्फ भाषणबाजी चल रही है।")
    assert res3["label"] == "Negative"

    # 4. Sarcasm detection
    res4 = await sentiment_engine.classify("Wah CM sahab kya vikas kiya hai, pehli baarish me hi bridge toot gaya!")
    assert res4["label"] == "Negative"
    assert res4["is_sarcastic"] is True

    # 5. Anti-opposition = Pro-CM
    res5 = await sentiment_engine.classify("RJD ke jungle raj aur Tejashwi ke bhrashtachar se Bihar bach gaya.")
    assert res5["label"] == "Positive"

    # 6. Neutral informational
    res6 = await sentiment_engine.classify("Notification was released yesterday, check the official website.")
    assert res6["label"] == "Neutral"

def test_post_level_aggregator():
    post_text_sentiment = {"label": "Negative", "topic": "floods", "confidence": 0.9}
    author_label = "news-media"
    comments = [
        {"label": "Negative", "topic": "floods", "like_count": 20},
        {"label": "Negative", "topic": "floods", "like_count": 50},
        {"label": "Negative", "topic": "corruption", "like_count": 10},
        {"label": "Positive", "topic": "development", "like_count": 5}
    ]

    res = aggregate_post_sentiment(post_text_sentiment, author_label, comments)
    assert res["verdict"] == "Negative"
    assert res["sentiment_score"] < -40.0
    assert res["negative_comment_count"] == 3
    assert res["top_topic"] == "floods"

@pytest.mark.asyncio
async def test_sentiment_evaluation_benchmark_300_samples():
    """Evaluates >=300 labeled comments and ensures precision/recall meet acceptable standards."""
    eval_res = await run_evaluation(sample_count=320)
    assert eval_res["total_samples"] >= 300
    assert eval_res["overall_accuracy"] >= 0.80

    per_class = eval_res["per_class"]
    assert per_class["Positive"]["precision"] >= 0.70
    assert per_class["Positive"]["recall"] >= 0.70
    assert per_class["Negative"]["precision"] >= 0.75
    assert per_class["Negative"]["recall"] >= 0.75
