import pytest
from app.collectors.youtube import YouTubeAdapter
from app.services.link_service import normalize_url, build_youtube_video_url, build_youtube_comment_url

def test_youtube_permalink_builders():
    adapter = YouTubeAdapter(api_key=None)
    video_id = "abc123XYZ"
    comment_id = "UgxK987654321"

    post_url = adapter.build_post_permalink(video_id)
    assert post_url == f"https://www.youtube.com/watch?v={video_id}"

    comment_url = adapter.build_comment_permalink(video_id, comment_id)
    assert comment_url == f"https://www.youtube.com/watch?v={video_id}&lc={comment_id}"

def test_url_normalization():
    # Test tracking parameter stripping
    dirty_yt_url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ&utm_source=twitter&utm_medium=social&si=xyz123"
    cleaned = normalize_url(dirty_yt_url)
    assert "utm_source" not in cleaned
    assert "utm_medium" not in cleaned
    assert "si=" not in cleaned
    assert "v=dQw4w9WgXcQ" in cleaned

    # Test youtu.be shortlink resolution
    short_yt = "https://youtu.be/dQw4w9WgXcQ?si=abcdef"
    canonical = normalize_url(short_yt)
    assert canonical.startswith("https://www.youtube.com/watch?")
    assert "v=dQw4w9WgXcQ" in canonical
    assert "si=" not in canonical

    # Test twitter.com to x.com normalization
    dirty_tw = "https://twitter.com/samrat4bjp/status/177218903429188096?s=20&t=abcdef"
    clean_tw = normalize_url(dirty_tw)
    assert clean_tw == "https://x.com/i/status/177218903429188096"

@pytest.mark.asyncio
async def test_youtube_adapter_without_key():
    adapter = YouTubeAdapter(api_key=None)
    posts = await adapter.fetch_new_posts(["Samrat Choudhary"])
    assert isinstance(posts, list)
    comments = await adapter.fetch_comments("any_id")
    assert comments == []
