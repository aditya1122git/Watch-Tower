import json
import logging
from typing import Dict, Any, Optional
from app.config import settings
from app.sentiment.local_fallback import classify_local_fallback

logger = logging.getLogger(__name__)

TARGET_SENTIMENT_SYSTEM_INSTRUCTION = """
You are a political sentiment intelligence analyst monitoring public discourse in Bihar, India.
Your target subject is SAMRAT CHOUDHARY, the Chief Minister of Bihar, and his administration.

CRITICAL INSTRUCTIONS:
1. TARGET-BASED ORIENTATION:
   - Sentiment must be assessed strictly TOWARDS CM SAMRAT CHOUDHARY and his government.
   - Anger or criticism directed at political opponents (RJD, Congress, Jan Suraaj) is POSITIVE for the CM.
   - Praise or support for political opponents is NEGATIVE for the CM.
   - Direct praise for Bihar infrastructure, policing, jobs, or CM leadership is POSITIVE.
   - Direct criticism of Bihar roads, floods, scams, exam paper leaks, or CM failure is NEGATIVE.
   - Neutral questions, links, or dates without polarity are NEUTRAL.
   - Comments containing both praise and blame are MIXED.

2. LANGUAGE: The text can be in English, Hindi (Devanagari), Hinglish (Roman Hindi), Bhojpuri, or Maithili. Handle sarcasm, colloquial Bihari slang, and emojis.

Return strict JSON adhering to this schema:
{
  "label": "Positive" | "Negative" | "Neutral" | "Mixed",
  "confidence": 0.0 to 1.0,
  "target_of_sentiment": "Samrat Choudhary / Govt",
  "topic": "law & order" | "jobs" | "education" | "floods" | "corruption" | "development" | "caste/religion" | "party politics" | "other",
  "is_sarcastic": boolean,
  "is_abusive": boolean,
  "reason_short": "Concise 1-sentence rationale"
}
"""

class GeminiSentimentClassifier:
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or settings.GEMINI_API_KEY
        self.client = None
        self._cooldown_until: float = 0.0
        if self.api_key:
            try:
                from google import genai
                self.client = genai.Client(api_key=self.api_key)
            except Exception as e:
                logger.warning(f"Could not initialize Google GenAI client: {e}")

    async def classify_text(self, text: str) -> Dict[str, Any]:
        import time
        now = time.time()
        if not self.client or now < self._cooldown_until:
            return classify_local_fallback(text)

        try:
            prompt = f"Analyze sentiment towards Bihar CM Samrat Choudhary for the following comment:\n\n\"{text}\""
            
            response = self.client.models.generate_content(
                model="gemini-flash-latest",
                contents=prompt,
                config={
                    "system_instruction": TARGET_SENTIMENT_SYSTEM_INSTRUCTION,
                    "response_mime_type": "application/json"
                }
            )

            result = json.loads(response.text)
            # Validate essential fields
            if "label" in result and result["label"] in ("Positive", "Negative", "Neutral", "Mixed"):
                return result
            return classify_local_fallback(text)
        except Exception as e:
            err_str = str(e)
            if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str or "quota" in err_str.lower():
                self._cooldown_until = time.time() + 60.0
                logger.warning("Gemini API free tier rate-limit hit. Cooldown active for 60s; using instant local classifier.")
            else:
                logger.warning(f"Gemini API classification failed: {e}. Falling back to local classifier.")
            return classify_local_fallback(text)
