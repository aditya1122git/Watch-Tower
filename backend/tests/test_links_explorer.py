import pytest
import pytest_asyncio
import csv
import io
from datetime import datetime, timezone, timedelta
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.database import Base, get_db
from app.models.post import Post
from app.services.link_service import build_youtube_video_url, build_youtube_comment_url, build_twitter_url, normalize_url

TEST_DB_URL = "sqlite+aiosqlite:///:memory:"

@pytest_asyncio.fixture
async def links_client():
    engine = create_async_engine(TEST_DB_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    Session = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

    async def override_get_db():
        async with Session() as sess:
            yield sess

    now = datetime.now(timezone.utc)
    # Populate sample posts
    async with Session() as sess:
        p_neg1 = Post(
            platform="youtube",
            platform_item_id="vid_neg_1",
            author_handle="ChannelNeg",
            author_name="Critical Bihar",
            author_label="opposition",
            permalink_url=build_youtube_video_url("vid_neg_1"),
            canonical_url=build_youtube_video_url("vid_neg_1"),
            text="Flood failure exposed",
            posted_at=now - timedelta(days=1),
            sentiment_verdict="Negative",
            sentiment_score=-75.0,
            negative_comment_count=600,
            negative_comment_pct=90.0,
            alert_flag=True,
            link_status="active"
        )
        p_pos1 = Post(
            platform="youtube",
            platform_item_id="vid_pos_1",
            author_handle="ChannelPos",
            author_name="Patna Times",
            author_label="official",
            permalink_url=build_youtube_video_url("vid_pos_1"),
            canonical_url=build_youtube_video_url("vid_pos_1"),
            text="Metro progress accelerated",
            posted_at=now - timedelta(days=2),
            sentiment_verdict="Positive",
            sentiment_score=85.0,
            negative_comment_count=10,
            negative_comment_pct=5.0,
            alert_flag=False,
            link_status="active"
        )
        p_unavail = Post(
            platform="twitter",
            platform_item_id="123456789",
            author_handle="DeletedUser",
            author_name="Deleted User",
            author_label="neutral",
            permalink_url=build_twitter_url("123456789"),
            canonical_url=build_twitter_url("123456789"),
            text="This tweet was taken down",
            posted_at=now - timedelta(days=4),
            sentiment_verdict="Negative",
            sentiment_score=-40.0,
            negative_comment_count=50,
            alert_flag=False,
            link_status="unavailable" # Demonstrates unavailable link
        )
        sess.add_all([p_neg1, p_pos1, p_unavail])
        await sess.commit()

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()

@pytest.mark.asyncio
async def test_links_explorer_tabs_and_links(links_client: AsyncClient):
    # Test Negative Tab
    resp_neg = await links_client.get("/api/v1/links?tab=negative")
    assert resp_neg.status_code == 200
    neg_posts = resp_neg.json()
    assert len(neg_posts) == 2 # p_neg1 and p_unavail
    for p in neg_posts:
        assert p["sentiment_verdict"] == "Negative"
        # Validate permalink format
        assert p["permalink_url"].startswith("https://")

    # Test Positive Tab
    resp_pos = await links_client.get("/api/v1/links?tab=positive")
    assert resp_pos.status_code == 200
    pos_posts = resp_pos.json()
    assert len(pos_posts) == 1
    assert pos_posts[0]["sentiment_verdict"] == "Positive"

    # Test Alerted Tab
    resp_alert = await links_client.get("/api/v1/links?tab=alerted")
    assert resp_alert.status_code == 200
    alert_posts = resp_alert.json()
    assert len(alert_posts) == 1
    assert alert_posts[0]["alert_flag"] is True

@pytest.mark.asyncio
async def test_links_explorer_unavailable_badge(links_client: AsyncClient):
    resp = await links_client.get("/api/v1/links?tab=all")
    assert resp.status_code == 200
    posts = resp.json()
    unavail_post = next((p for p in posts if p["link_status"] == "unavailable"), None)
    assert unavail_post is not None
    assert unavail_post["platform_item_id"] == "123456789"
    # Metadata and sentiment score are preserved
    assert unavail_post["sentiment_score"] == -40.0

@pytest.mark.asyncio
async def test_links_export_row_count_parity(links_client: AsyncClient):
    # Get JSON rows
    resp_json = await links_client.get("/api/v1/links?tab=negative")
    json_count = len(resp_json.json())

    # Get CSV export
    resp_csv = await links_client.get("/api/v1/links/export?tab=negative")
    assert resp_csv.status_code == 200

    csv_reader = csv.DictReader(io.StringIO(resp_csv.text))
    csv_rows = list(csv_reader)
    # Acceptance Criterion: CSV row count equals rows shown under same filters
    assert len(csv_rows) == json_count
    for row in csv_rows:
        assert row["sentiment"] == "Negative"
        assert row["url"].startswith("https://")
