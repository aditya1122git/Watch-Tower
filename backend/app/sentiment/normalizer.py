import re
import unicodedata
import hashlib
from typing import Tuple

def compute_text_hash(text: str) -> str:
    """Computes SHA-256 hash of normalized text for deduplication and sentiment caching."""
    norm = normalize_text(text)
    return hashlib.sha256(norm.encode("utf-8")).hexdigest()

def normalize_text(text: str) -> str:
    """
    Cleans and normalizes text across Hindi (Devanagari), English, Hinglish, and Bhojpuri:
    - Normalizes Unicode (NFKC)
    - Strips excess whitespace, zero-width spaces, and control characters
    - Preserves political hashtags and emojis while cleaning malformed characters
    """
    if not text:
        return ""

    # Unicode normalization
    text = unicodedata.normalize("NFKC", text)

    # Remove zero-width spaces and non-printable characters (except standard newlines/spaces)
    text = re.sub(r"[\u200B-\u200D\uFEFF]", "", text)

    # Replace multiple consecutive spaces and tabs with single space
    text = re.sub(r"[ \t]+", " ", text)

    # Replace 3+ consecutive newlines with 2 newlines
    text = re.sub(r"\n{3,}", "\n\n", text)

    return text.strip()

ABUSIVE_KEYWORDS = {
    "chutiya", "madarchod", "bhosdike", "gaandu", "harami", "kutta",
    "चूतिया", "मादरचोद", "भोसड़ीके", "गांडू", "हरामी", "कुत्ता"
}

def check_abusive(text: str) -> bool:
    """Detects overtly abusive or profane language."""
    lower = text.lower()
    for word in ABUSIVE_KEYWORDS:
        if word in lower:
            return True
    return False
