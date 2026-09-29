import re

BHOJPURI_MARKERS = {
    "का हो", "कइलन", "बाटे", "रहल", "कहावत", "लइका", "गाँव", "बड़का", "हमार", "रउआ",
    "ka ho", "kailan", "bate", "rahal", "hamar", "raua", "babu", "laika"
}

MAITHILI_MARKERS = {
    "अछि", "छल", "एहि", "ओहि", "हमर", "अपने", "कोन", "achi", "chhal", "hamar"
}

HINGLISH_WORDS = {
    "hai", "nahi", "nhi", "kya", "aur", "bhi", "yeh", "woh", "kaam", "sarkar",
    "vikas", "bhaiya", "sahab", "choudhary", "bihar", "patna", "karo", "karenge",
    "hua", "raha", "gaya", "chor", "janta", "bjp", "rjd", "sab", "desh", "kuch",
    "kuchh", "paise", "sirf", "babu", "bolta", "karte", "dhanyawad", "mudda"
}

def detect_language(text: str) -> str:
    """
    Detects language of comment/post:
    - 'hi' (Hindi in Devanagari)
    - 'bho' (Bhojpuri)
    - 'mai' (Maithili)
    - 'ur' (Urdu script)
    - 'hinglish' (Roman script with Hindi vocabulary)
    - 'en' (Standard English)
    """
    if not text:
        return "en"

    # Check Devanagari characters
    devanagari_count = sum(1 for c in text if 0x0900 <= ord(c) <= 0x097F)
    # Check Arabic/Urdu characters
    urdu_count = sum(1 for c in text if 0x0600 <= ord(c) <= 0x06FF)
    
    total_chars = len(text.strip())
    if total_chars == 0:
        return "en"

    if urdu_count / total_chars > 0.2:
        return "ur"

    lower = text.lower()

    # Check Bhojpuri markers
    for m in BHOJPURI_MARKERS:
        if m in lower:
            return "bho"

    # Check Maithili markers
    for m in MAITHILI_MARKERS:
        if m in lower:
            return "mai"

    if devanagari_count / total_chars > 0.25:
        return "hi"

    # Roman script: check if Hinglish or English
    words = re.findall(r"[a-z]+", lower)
    if not words:
        return "en"

    hinglish_matches = sum(1 for w in words if w in HINGLISH_WORDS)
    if len(words) > 0 and (hinglish_matches / len(words)) >= 0.15:
        return "hinglish"

    return "en"
