import re
from urllib.parse import urlparse, parse_qs, urlencode, urlunparse
import httpx
import logging

logger = logging.getLogger(__name__)

TRACKING_PARAMS = {
    "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
    "fbclid", "gclid", "si", "feature", "ref", "ref_src", "s"
}

def normalize_url(url: str) -> str:
    """
    Normalizes URLs:
    - Strips marketing/tracking parameters (utm_*, fbclid, si, etc.)
    - Canonicalizes youtu.be shortlinks to standard youtube.com/watch?v=
    - Canonicalizes twitter.com to x.com/i/status/
    """
    if not url:
        return ""
    
    url = url.strip()
    try:
        parsed = urlparse(url)
    except Exception:
        return url

    # Handle youtu.be shortlinks
    if parsed.netloc in ("youtu.be", "www.youtu.be"):
        video_id = parsed.path.lstrip("/")
        query = parse_qs(parsed.query)
        clean_query = {k: v for k, v in query.items() if k not in TRACKING_PARAMS}
        clean_query["v"] = [video_id]
        new_query_str = urlencode(clean_query, doseq=True)
        return f"https://www.youtube.com/watch?{new_query_str}"

    # Handle x.com / twitter.com
    if parsed.netloc in ("twitter.com", "www.twitter.com", "x.com", "www.x.com"):
        match = re.search(r"/(?:i/web/status|[^/]+/status)/(\d+)", parsed.path)
        if match:
            tweet_id = match.group(1)
            return f"https://x.com/i/status/{tweet_id}"

    # Handle standard URLs - strip tracking params
    query = parse_qs(parsed.query)
    clean_query = {k: v for k, v in query.items() if k not in TRACKING_PARAMS}
    clean_query_str = urlencode(clean_query, doseq=True)

    # Reconstruct
    cleaned = urlunparse((
        parsed.scheme or "https",
        parsed.netloc.lower(),
        parsed.path,
        parsed.params,
        clean_query_str,
        "" # Drop fragment unless necessary
    ))
    return cleaned

def build_youtube_video_url(video_id: str) -> str:
    return f"https://www.youtube.com/watch?v={video_id}"

def build_youtube_comment_url(video_id: str, comment_id: str) -> str:
    # If the comment_id is synthetic/local (e.g. starts with c_), link directly to the playable video URL
    # so that YouTube opens the real video cleanly without "Linked comment was not found" errors!
    if not comment_id or comment_id.startswith("c_") or "fake" in comment_id:
        return f"https://www.youtube.com/watch?v={video_id}"
    return f"https://www.youtube.com/watch?v={video_id}&lc={comment_id}"

def build_twitter_url(tweet_id: str) -> str:
    return f"https://x.com/i/status/{tweet_id}"

async def verify_link_health(url: str, timeout: float = 6.0) -> str:
    """
    Checks if a link is active or deleted/private without downloading full body.
    Returns: 'active' | 'unavailable' | 'private'
    """
    if not url:
        return "unavailable"

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    }

    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=timeout) as client:
            resp = await client.head(url, headers=headers)
            if resp.status_code in (404, 410):
                return "unavailable"
            if resp.status_code in (401, 403):
                return "private"
            if resp.status_code < 400:
                return "active"
            # If HEAD returns 405 Method Not Allowed, try light GET
            if resp.status_code == 405:
                get_resp = await client.get(url, headers=headers)
                if get_resp.status_code in (404, 410):
                    return "unavailable"
                if get_resp.status_code < 400:
                    return "active"
            return "active"
    except Exception as e:
        logger.debug(f"Link verification failed for {url}: {e}")
        # Default to active on network timeout so we don't prematurely mark items unavailable
        return "active"
