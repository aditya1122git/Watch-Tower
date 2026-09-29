import re
from typing import Dict, Any
from app.sentiment.normalizer import check_abusive

POSITIVE_WORDS_HI = {
    "प्रगति", "विकास", "धन्यवाद", "सराहनीय", "ऐतिहासिक", "उत्कृष्ट", "सख्त",
    "जय", "ईमानदार", "तेजी", "काबिल", "सुधार", "अच्छा", "अच्छी", "अच्छे", "मजबूत", "गौरव", "आभार",
    "प्रशंसनीय", "प्रशंसा", "निवेश", "चकाचक", "सराहना", "समर्थन", "भरोसा", "सफल",
    "सफलता", "शांति", "अमन", "बच", "सख्त कार्रवाई", "शानदार", "बढ़िया", "सचहूँ", "बेहतर", "सुधरा"
}

POSITIVE_WORDS_EN = {
    "great", "excellent", "progress", "development", "appreciate", "proud",
    "speed", "historic", "honest", "good", "best", "praise", "kudos", "strong",
    "dhanyawad", "shandar", "zabardast", "badhiya", "achha", "accha", "sahi",
    "initiative", "connectivity", "tremendously", "stern", "action", "reform",
    "peace", "support", "capable", "hardworking", "decisive", "real", "truth",
    "tight", "safal", "reinforced", "reinforcement", "speeded", "improved", "improve",
    "improvement", "better", "fast", "forward", "vikas", "tarakki", "pragati", "kaam",
    "bach", "bachaya"
}

NEGATIVE_WORDS_HI = {
    "नाकाम", "बर्बाद", "भ्रष्टाचार", "घोटाला", "फेल", "भाषणबाजी", "बेरोजगारी",
    "बदहाल", "परेशान", "गुंडागर्दी", "अपराध", "चोर", "झूठ", "लापरवाही", "नुकसान",
    "धोखा", "लूट", "दोष", "तबाही", "मुसीबत", "त्रासदी", "लीक", "निकम्मी", "टूटा",
    "टूट", "धोखाधड़ी", "असमर्थ", "इस्तीफा", "अत्याचार", "लापरवाह", "विफल", "विफलता",
    "घटिया", "बदनाम", "चिंताजनक", "कमजोर", "रिश्वत", "जंगलराज", "आरोप", "विवाद",
    "बवाल", "केस", "सजा", "चूक", "मुश्किल", "चरमरा", "वार", "हमला", "बरसे", "सवाल",
    "बदसलूकी", "हड़कंप", "हल्लाबोल", "घमासान", "खामियां", "कमी"
}

NEGATIVE_WORDS_EN = {
    "fail", "failed", "failure", "disaster", "corrupt", "corruption", "scam",
    "ghotala", "worst", "deteriorating", "fake", "jumla", "crime", "unemployment",
    "loot", "shame", "useless", "pothole", "potholes", "delay", "broken", "chor", "dhokha",
    "barbaad", "bakwas", "jhoot", "naakaam", "pareshan", "leak", "leakage", "negligence",
    "incapable", "resigned", "atrocity", "stunt", "weak", "bribe", "problematic", "loss",
    "toot", "toota", "gir", "gira", "loot", "lut", "nakam", "barbaad", "bhrashtachar",
    "bhrasht", "jungle", "jungleraj", "gunda", "gundaraj", "fir", "case", "controversy",
    "allegation", "criticism", "attack", "oppose", "resignation", "resign", "exposed",
    "pocso", "blame", "fault", "arrest", "trouble", "collapse"
}

ATTACK_PHRASES = [
    "के खिलाफ fir", "दर्ज कराने थाने", "मांगा इस्तीफा", "देंगे इस्तीफा", "कानूनी मुश्किल",
    "हुई बड़ी चूक", "पहचान उजागर", "कानून की समझ नहीं", "चरमरा गई", "पुलिसिंग पूरी तरह चरमरा",
    "पोल खुल गई", "धज्जियां", "जेल जाएंगे", "बदसलूकी पर भड़कीं", "तीखा वार", "बरसे",
    "सवाल उठाए", "लापरवाही", "हड़कंप", "गंभीर आरोप", "विपक्ष ने घेरा", "बड़ा आरोप",
    "pocso", "यौन हिंसा", "थाने पहुंचीं", "सेल्फ गोल", "गलतियों पर पर्दा",
    "नाम के मुख्यमंत्री", "काम के नहीं", "घमंड", "घर तोड़ा जा रहा",
    "प्राथमिकी", "जेल भेजे", "कोर्ट तक घसीटेंगे", "मुँह छुपा के भागे",
    "अपराधी", "केस होना चाहिए", "पर भी केस", "fir दर्ज होगी", "साधा निशाना",
    "तेजस्वी यादव का हमला", "विपक्ष का हमला"
]

OPPOSITION_MARKERS = {
    "rjd", "tejashwi", "lalu", "congress", "jan suraaj", "prashant kishor", "तेजस्वी", "लालू", "राजद"
}

CONTRASTIVE_MARKERS = {
    "लेकिन", "मगर", "परन्तु", "परंतु", "but", "however", "although", "still", "yet", "हालाँकि", "तथापि"
}

TOPIC_KEYWORDS = {
    "education": ["पेपर", "लीक", "paper", "leak", "bpsc", "bssc", "teacher", "शिक्षक", "स्कूल", "college", "शिक्षा", "छात्र", "exam", "परीक्षा"],
    "jobs": ["job", "jobs", "employment", "recruitment", "vacancy", "नौकरी", "रोजगार", "भर्ती", "बेरोजगारी"],
    "floods": ["flood", "floods", "water", "river", "rain", "drainage", "बाढ़", "पानी", "नदी", "बारिश", "जलभराव", "राहत", "तटबंध", "embankment", "relief"],
    "law & order": ["crime", "police", "mafia", "law", "order", "अपराध", "पुलिस", "माफिया", "कानून", "गुंडागर्दी"],
    "corruption": ["corruption", "scam", "bribe", "ghotala", "भ्रष्टाचार", "घोटाला", "रिश्वत", "लूट"],
    "development": ["metro", "road", "roads", "expressway", "bridge", "hospital", "उद्योग", "मेट्रो", "सड़क", "पुल", "अस्पताल", "विकास", "infra", "infrastructure"],
    "caste/religion": ["caste", "religion", "mandir", "masjid", "जाति", "धर्म", "मंदिर", "मस्जिद"],
    "party politics": ["bjp", "jdu", "rjd", "election", "rally", "गठबंधन", "चुनाव", "रैली", "वोट"]
}

def classify_local_fallback(text: str) -> Dict[str, Any]:
    """
    Offline target-based sentiment classification towards CM Samrat Choudhary & Bihar Govt.
    """
    lower = text.lower()
    is_abusive = check_abusive(text)
    is_sarcastic = bool(re.search(r"वाह\s+सीएम|wah\s+cm|kya\s+baat\s+hai|महान\s+सरकार|kya\s+vikas", lower))

    # Detect Topic
    detected_topic = "other"
    for topic, kws in TOPIC_KEYWORDS.items():
        if any(kw in lower for kw in kws):
            detected_topic = topic
            break

    # Check mention of opposition
    mentions_opposition = any(op in lower for op in OPPOSITION_MARKERS)
    has_contrast = any(c in lower for c in CONTRASTIVE_MARKERS)

    # Score polarity
    pos_score = 0
    neg_score = 0

    tokens = re.findall(r"[\w\u0900-\u097F]+", lower)
    has_negation = any(neg in lower for neg in ["nahi", "nhi", "not", "नहीं", "नाहीं", "never", "zero"])

    for token in tokens:
        if token in POSITIVE_WORDS_HI or token in POSITIVE_WORDS_EN:
            pos_score += 1
        elif token in NEGATIVE_WORDS_HI or token in NEGATIVE_WORDS_EN:
            neg_score += 1

    for phrase in ATTACK_PHRASES:
        if phrase in lower:
            neg_score += 3

    # Contrastive Mixed check: (e.g. "roads are good but hospitals are weak")
    if has_contrast and (pos_score > 0 and neg_score > 0):
        return {
            "label": "Mixed",
            "confidence": 0.85,
            "target_of_sentiment": "Samrat Choudhary / Govt",
            "topic": detected_topic,
            "is_sarcastic": is_sarcastic,
            "is_abusive": is_abusive,
            "reason_short": "Contains contrastive clause acknowledging both achievements and governance concerns."
        }

    # Negation inversion: "vikas nahi hua" / "zero implementation" -> negative
    if has_negation and pos_score > 0:
        neg_score += pos_score + 1
        pos_score = 0

    # Sarcasm flips positive to negative: "Wah CM sahab kya vikas kiya"
    if is_sarcastic:
        neg_score += pos_score + 2
        pos_score = 0

    # Opposition target adjustment:
    # If anger/criticism is directed at opposition -> supportive/positive for CM
    if mentions_opposition and neg_score > pos_score and not any(cm in lower for cm in ["samrat", "सम्राट", "govt", "वर्तमान", "cm sahab"]):
        label = "Positive"
        confidence = 0.85
        reason = "Criticism targeted at opposition rivals; supportive of CM stance."
    elif pos_score > 0 and neg_score > 0:
        label = "Mixed"
        confidence = 0.78
        reason = "Presents mixed sentiments balancing progress and shortcomings."
    elif neg_score > pos_score:
        label = "Negative"
        confidence = min(0.96, 0.75 + (neg_score * 0.08))
        reason = f"Identified {neg_score} critical indicators concerning governance or delivery."
    elif pos_score > neg_score:
        label = "Positive"
        confidence = min(0.96, 0.75 + (pos_score * 0.08))
        reason = f"Identified {pos_score} positive indicators praising CM or development."
    else:
        label = "Neutral"
        confidence = 0.80
        reason = "Informational or balanced comment without strong sentiment polarity."

    return {
        "label": label,
        "confidence": round(confidence, 2),
        "target_of_sentiment": "Samrat Choudhary / Govt",
        "topic": detected_topic,
        "is_sarcastic": is_sarcastic,
        "is_abusive": is_abusive,
        "reason_short": reason
    }
