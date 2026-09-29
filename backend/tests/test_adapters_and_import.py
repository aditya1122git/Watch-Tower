import pytest
import pytest_asyncio
import json
import io
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from app.main import app
from app.database import Base, get_db
from app.collectors.twitter import TwitterAdapter
from app.collectors.meta_importer import MetaAdapter
from app.collectors.rss_news import NewsRSSAdapter
from app.collectors.telegram import TelegramAdapter

TEST_DB_URL = "sqlite+aiosqlite:///:memory:"

@pytest_asyncio.fixture
async def api_client():
    engine = create_async_engine(TEST_DB_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    Session = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

    async def override_get_db():
        async with Session() as sess:
            yield sess

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()

def test_twitter_adapter_permalink_builders():
    adapter = TwitterAdapter(bearer_token=None)
    assert adapter.build_post_permalink("123456789") == "https://x.com/i/status/123456789"
    assert adapter.build_comment_permalink("123", "456") == "https://x.com/i/status/456"

@pytest.mark.asyncio
async def test_twitter_adapter_no_token():
    adapter = TwitterAdapter(bearer_token=None)
    posts = await adapter.fetch_new_posts(["Samrat Choudhary"])
    assert isinstance(posts, list)
    metrics = await adapter.fetch_metrics("123456")
    assert metrics.views == 0

def test_facebook_adapter_permalink():
    from app.collectors.facebook import FacebookAdapter
    adapter = FacebookAdapter()
    assert adapter.build_post_permalink("12345") == "https://www.facebook.com/watch/?v=12345"

@pytest.mark.asyncio
async def test_facebook_adapter_fetch():
    from app.collectors.facebook import FacebookAdapter
    adapter = FacebookAdapter()
    posts = await adapter.fetch_new_posts(["Samrat Choudhary"], max_results=3)
    assert isinstance(posts, list)
    metrics = await adapter.fetch_metrics("12345")
    assert metrics.views > 0

def test_instagram_adapter_permalink():
    from app.collectors.instagram import InstagramAdapter
    adapter = InstagramAdapter()
    assert adapter.build_post_permalink("12345") == "https://www.instagram.com/p/12345/"

@pytest.mark.asyncio
async def test_instagram_adapter_fetch():
    from app.collectors.instagram import InstagramAdapter
    adapter = InstagramAdapter()
    posts = await adapter.fetch_new_posts(["Samrat Choudhary"], max_results=3)
    assert isinstance(posts, list)
    metrics = await adapter.fetch_metrics("12345")
    assert metrics.views > 0

def test_meta_adapter_permalink_builders():
    adapter = MetaAdapter(access_token=None)
    assert adapter.build_post_permalink("BiharGovt_123") == "https://www.facebook.com/BiharGovt_123"

def test_telegram_adapter_permalink_builders():
    adapter = TelegramAdapter(bot_token=None)
    assert adapter.build_post_permalink("bihar_news/456") == "https://t.me/bihar_news/456"

@pytest.mark.asyncio
async def test_import_json_data(api_client: AsyncClient):
    payload = [
        {
            "platform": "facebook",
            "platform_item_id": "fb_post_999",
            "author_name": "Patna Press Club",
            "author_handle": "patnapress",
            "author_label": "news-media",
            "text": "मुख्यमंत्री सम्राट चौधरी ने नए फ्लाईओव्हर का उद्घाटन किया।",
            "url": "https://www.facebook.com/patnapress/posts/999?utm_source=fb",
            "comments": [
                {
                    "comment_id": "fb_c_1",
                    "author_id": "user_ramesh",
                    "text": "बहुत ही सराहनीय और उपयोगी कदम है। बधाई सीएम जी।",
                    "likes": 12
                },
                {
                    "comment_id": "fb_c_2",
                    "author_id": "user_suresh",
                    "text": "लेकिन पटना की बाकी सड़कों की हालत अभी भी बदहाल है।",
                    "likes": 8
                }
            ]
        }
    ]

    file_bytes = json.dumps(payload).encode("utf-8")
    files = {"file": ("test_import.json", file_bytes, "application/json")}

    resp = await api_client.post("/api/v1/import/file", files=files)
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert data["posts_imported"] == 1
    assert data["comments_imported"] == 2

    # Verify post appears in list with normalized URL
    posts_resp = await api_client.get("/api/v1/posts")
    posts = posts_resp.json()
    imported_post = next((p for p in posts if p["platform_item_id"] == "fb_post_999"), None)
    assert imported_post is not None
    assert "utm_source" not in imported_post["permalink_url"]
    assert imported_post["comment_count"] == 2
