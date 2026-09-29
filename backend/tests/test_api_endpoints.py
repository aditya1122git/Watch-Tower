import pytest
import pytest_asyncio
import csv
import io
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from app.main import app
from app.database import Base, get_db
from app.services.seed_service import seed_database

TEST_DB_URL = "sqlite+aiosqlite:///:memory:"

@pytest_asyncio.fixture
async def client():
    # Setup in-memory test database
    engine = create_async_engine(TEST_DB_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    Session = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

    async def override_get_db():
        async with Session() as session:
            yield session

    # Seed test data
    async with Session() as session:
        await seed_database(session)

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()

@pytest.mark.asyncio
async def test_health_check(client: AsyncClient):
    resp = await client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "healthy"
    assert "Samrat Choudhary" in data["target"]

@pytest.mark.asyncio
async def test_metrics(client: AsyncClient):
    resp = await client.get("/metrics")
    assert resp.status_code == 200
    data = resp.json()
    assert data["watchtower_posts_tracked_total"] >= 5

@pytest.mark.asyncio
async def test_list_posts(client: AsyncClient):
    resp = await client.get("/api/v1/posts")
    assert resp.status_code == 200
    posts = resp.json()
    assert len(posts) >= 5

@pytest.mark.asyncio
async def test_links_explorer_negative_tab(client: AsyncClient):
    resp = await client.get("/api/v1/links?tab=negative")
    assert resp.status_code == 200
    posts = resp.json()
    assert len(posts) > 0
    for p in posts:
        assert p["sentiment_verdict"] == "Negative"

@pytest.mark.asyncio
async def test_links_explorer_export_csv(client: AsyncClient):
    resp = await client.get("/api/v1/links/export?tab=negative")
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("text/csv")
    
    # Parse CSV content
    reader = csv.DictReader(io.StringIO(resp.text))
    rows = list(reader)
    assert len(rows) > 0
    for row in rows:
        assert row["sentiment"] == "Negative"
        assert row["url"].startswith("http")

@pytest.mark.asyncio
async def test_alerts_endpoint(client: AsyncClient):
    resp = await client.get("/api/v1/alerts")
    assert resp.status_code == 200
    alerts = resp.json()
    assert len(alerts) >= 1
    crit_alert = next((a for a in alerts if a["alert_type"] == "critical_500"), None)
    assert crit_alert is not None
    assert crit_alert["milestone_value"] == 500
    assert crit_alert["negative_comment_count"] >= 500
    assert len(crit_alert["top_negative_comments_json"]) >= 5

@pytest.mark.asyncio
async def test_stats_overview(client: AsyncClient):
    resp = await client.get("/api/v1/stats/overview")
    assert resp.status_code == 200
    data = resp.json()
    assert "overall_sentiment_score" in data
    assert data["total_posts"] >= 5
    assert data["total_comments"] >= 500
    assert data["active_alerts"] >= 1
    assert "youtube" in data["platforms"]

@pytest.mark.asyncio
async def test_news_channels_report_endpoint(client: AsyncClient):
    resp = await client.get("/api/v1/reports/news-channels")
    assert resp.status_code == 200
    data = resp.json()
    assert "summary" in data
    assert "channels" in data
    assert data["summary"]["total_news_outlets"] >= 7
    assert data["summary"]["total_news_reach"] >= 1000000
    assert data["summary"]["most_critical_outlet"] is not None
    assert data["summary"]["most_supportive_outlet"] is not None
    
    # Check individual news channels
    channel_names = [c["name"] for c in data["channels"]]
    assert "News18 Bihar Jharkhand" in channel_names
    assert "Zee Bihar Jharkhand" in channel_names
    assert "Live Cities Media" in channel_names
    assert "News4Nation" in channel_names
    assert "ABP News Bihar" in channel_names

    # Check structure
    sample = data["channels"][0]
    assert "stance_score" in sample
    assert "stance_label" in sample
    assert "negative_comment_pct" in sample
    assert "top_story" in sample
    assert sample["top_story"]["permalink"].startswith("http")

@pytest.mark.asyncio
async def test_executive_pdf_report_endpoint(client: AsyncClient):
    resp = await client.get("/api/v1/reports/pdf")
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "application/pdf"
    assert len(resp.content) > 1000

@pytest.mark.asyncio
async def test_list_collectors_endpoint(client: AsyncClient):
    resp = await client.get("/api/v1/collectors")
    assert resp.status_code == 200
    data = resp.json()
    assert "free_public_collectors" in data
    assert "key_based_collectors" in data
    assert len(data["free_public_collectors"]) == 9
    platforms = [c["platform"] for c in data["free_public_collectors"]]
    assert "rss" in platforms
    assert "reddit" in platforms
    assert "mastodon" in platforms
    assert "wikipedia" in platforms
    assert "telegram" in platforms
    assert "youtube" in platforms
    assert "twitter" in platforms
    assert "facebook" in platforms
    assert "instagram" in platforms

@pytest.mark.asyncio
async def test_run_free_collectors_endpoint(client: AsyncClient):
    # Test running with small max limit
    resp = await client.post("/api/v1/collectors/run-free", json={"max_per_platform": 2})
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert "total_fetched" in data
    assert "platforms" in data

@pytest.mark.asyncio
async def test_scheduler_and_timeline_endpoints(client: AsyncClient):
    # Test timeline report
    resp = await client.get("/api/v1/reports/timeline")
    assert resp.status_code == 200
    tl = resp.json()
    assert "summary" in tl
    assert "hourly_trend" in tl
    assert len(tl["hourly_trend"]) == 24
    assert "minute_logs" in tl

    # Test scheduler status
    st_resp = await client.get("/api/v1/scheduler/status")
    assert st_resp.status_code == 200
    st = st_resp.json()
    assert "is_running" in st
    assert "interval_seconds" in st

@pytest.mark.asyncio
async def test_telegram_config_and_test_endpoints(client: AsyncClient):
    # Test GET /telegram/config
    resp = await client.get("/api/v1/telegram/config")
    assert resp.status_code == 200
    data = resp.json()
    assert data["target_chat_id"] == "@Rajnish517"
    assert "format_template" in data

    # Test POST /telegram/config
    update_resp = await client.post("/api/v1/telegram/config", json={
        "target_chat_id": "@Rajnish517",
        "bot_token": "fake_token_for_testing"
    })
    assert update_resp.status_code == 200
    up_data = update_resp.json()
    assert up_data["target_chat_id"] == "@Rajnish517"
    assert up_data["has_bot_token"] is True

    # Test POST /telegram/test (without real network token, handles gracefully)
    test_resp = await client.post("/api/v1/telegram/test", json={})
    assert test_resp.status_code == 200
    t_data = test_resp.json()
    assert "preview_text" in t_data
    assert "🔴 ALERT — YouTube — Samrat Choudhary Ji" in t_data["preview_text"]
    assert "Views: 13.3K" in t_data["preview_text"]
    assert "Sentiment: NEGATIVE" in t_data["preview_text"]
    assert "Account: Molitics" in t_data["preview_text"]

def test_telegram_format_matches_user_photo():
    from app.services.telegram_alert_service import telegram_alert_service
    sample_post = {
        "platform": "youtube",
        "author_name": "Molitics",
        "views": 13300,
        "text": "निकम्मी पुलिस बिहार की, रील से होगा Crime Control? | Know The News | Nivedita and Neeraj Jha",
        "permalink_url": "https://www.youtube.com/watch?v=sample"
    }
    msg_html = telegram_alert_service.format_alert_message_html(sample_post)
    assert "Watch-Tower" in msg_html
    assert "Admin" in msg_html
    assert "🔴 <b>ALERT — YouTube — Samrat Choudhary Ji</b>" in msg_html
    assert "<b>Views:</b> 13.3K" in msg_html
    assert "<b>Sentiment:</b> NEGATIVE" in msg_html
    assert "<b>Account:</b> Molitics" in msg_html
    assert "निकम्मी पुलिस बिहार की" in msg_html
    assert "🔗 View on YouTube" in msg_html


