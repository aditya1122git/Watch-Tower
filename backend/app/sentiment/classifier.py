from typing import List, Dict, Any, Optional
from app.sentiment.normalizer import normalize_text, compute_text_hash
from app.sentiment.detector import detect_language
from app.sentiment.gemini_classifier import GeminiSentimentClassifier
from app.sentiment.local_fallback import classify_local_fallback

class SentimentEngine:
    def __init__(self, api_key: Optional[str] = None):
        self.gemini_classifier = GeminiSentimentClassifier(api_key=api_key)
        self._cache: Dict[str, Dict[str, Any]] = {}

    async def classify(self, raw_text: str) -> Dict[str, Any]:
        text = normalize_text(raw_text)
        if not text:
            return {
                "label": "Neutral",
                "confidence": 1.0,
                "target_of_sentiment": "Samrat Choudhary / Govt",
                "topic": "other",
                "is_sarcastic": False,
                "is_abusive": False,
                "reason_short": "Empty text",
                "language": "en",
                "text_hash": ""
            }

        text_hash = compute_text_hash(text)
        if text_hash in self._cache:
            return self._cache[text_hash]

        lang = detect_language(text)
        res = await self.gemini_classifier.classify_text(text)
        res["language"] = lang
        res["text_hash"] = text_hash

        # Cache result
        self._cache[text_hash] = res
        return res

    async def classify_batch(self, texts: List[str]) -> List[Dict[str, Any]]:
        return [await self.classify(t) for t in texts]

sentiment_engine = SentimentEngine()
