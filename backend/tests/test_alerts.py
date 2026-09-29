import pytest
import pytest_asyncio
from datetime import datetime, timezone, timedelta
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from app.database import Base
from app.models.post import Post
from app.models.comment import Comment
from app.models.alert import Alert
from app.services.alert_service import evaluate_post_alerts, detect_coordinated_activity
from app.services.privacy_service import hash_commenter_id
from app.services.link_service import build_youtube_video_url, build_youtube_comment_url

TEST_DB_URL = "sqlite+aiosqlite:///:memory:"

@pytest_asyncio.fixture
async def session():
    engine = create_async_engine(TEST_DB_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    Session = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)
    async with Session() as sess:
        yield sess

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()

@pytest.mark.asyncio
async def test_alert_at_500_and_501_deduplication_and_1000(session: AsyncSession):
    now = datetime.now(timezone.utc)
    v_id = "test_alert_vid_001"
    post = Post(
        platform="youtube",
        platform_item_id=v_id,
        author_handle="ChannelXYZ",
        author_name="XYZ News",
        permalink_url=build_youtube_video_url(v_id),
        canonical_url=build_youtube_video_url(v_id),
        text="Bihar law and order debate video",
        media_type="video",
        posted_at=now - timedelta(hours=10),
        views=10000,
        comment_count=500,
        negative_comment_count=500,
        negative_comment_pct=100.0,
        growth_velocity=25.0,
        alert_flag=False,
        alert_milestone=0
    )
    session.add(post)
    await session.commit()
    await session.refresh(post)

    distinct_texts = [
        "Road infrastructure is severely damaged in Patna district",
        "Hospital management has completely failed during seasonal fever",
        "Youth unemployment numbers are rising without any job fair",
        "Exam paper leaks must be investigated by a central agency",
        "Crime rates in rural police stations require immediate review"
    ]
    for i, txt in enumerate(distinct_texts, 1):
        c_id = f"comm_neg_{i}"
        session.add(
            Comment(
                post_id=post.id,
                platform_comment_id=c_id,
                commenter_hash=hash_commenter_id(f"user_{i}"),
                text=txt,
                timestamp=now - timedelta(minutes=i * 20),
                sentiment_label="Negative",
                like_count=i * 10,
                permalink_url=build_youtube_comment_url(v_id, c_id)
            )
        )
    await session.commit()

    # 1. Evaluate at exactly 500 negative comments:
    # Expect: Exactly ONE critical alert fired for milestone 500
    alerts_fired_1 = await evaluate_post_alerts(session, post.id)
    assert len(alerts_fired_1) == 1
    a1 = alerts_fired_1[0]
    assert a1.alert_type == "critical_500"
    assert a1.severity == "critical"
    assert a1.milestone_value == 500
    assert len(a1.top_negative_comments_json) == 5
    assert "&lc=comm_neg_" in a1.top_negative_comments_json[0]["permalink"]

    # 2. Advance to 501 negative comments:
    post.negative_comment_count = 501
    post.comment_count = 501
    await session.commit()

    # Re-evaluate at 501:
    # Acceptance Criterion: At 501, no duplicate alert fired!
    alerts_fired_2 = await evaluate_post_alerts(session, post.id)
    assert len(alerts_fired_2) == 0

    # Total alerts in database must still be exactly 1
    total_alerts = await session.scalar(select(func.count(Alert.id)))
    assert total_alerts == 1

    # 3. Advance to 999 negative comments:
    post.negative_comment_count = 999
    await session.commit()
    alerts_fired_3 = await evaluate_post_alerts(session, post.id)
    assert len(alerts_fired_3) == 0
    total_alerts = await session.scalar(select(func.count(Alert.id)))
    assert total_alerts == 1

    # 4. Cross milestone 1000:
    post.negative_comment_count = 1001
    await session.commit()

    # Acceptance Criterion: At 1001, a second alert is created for milestone 1000!
    alerts_fired_4 = await evaluate_post_alerts(session, post.id)
    assert len(alerts_fired_4) == 1
    a2 = alerts_fired_4[0]
    assert a2.milestone_value == 1000
    assert a2.alert_type == "critical_500"

    total_alerts = await session.scalar(select(func.count(Alert.id)))
    assert total_alerts == 2

@pytest.mark.asyncio
async def test_velocity_burst_alert(session: AsyncSession):
    now = datetime.now(timezone.utc)
    v_id = "test_velocity_vid"
    post = Post(
        platform="youtube",
        platform_item_id=v_id,
        author_handle="NewsPortal",
        author_name="News Portal",
        permalink_url=build_youtube_video_url(v_id),
        canonical_url=build_youtube_video_url(v_id),
        text="Breaking report",
        posted_at=now - timedelta(hours=2),
        negative_comment_count=120,
        negative_comment_pct=80.0,
        alert_milestone=0
    )
    session.add(post)
    await session.commit()

    # Add 105 negative comments within last 15 minutes
    for i in range(105):
        session.add(
            Comment(
                post_id=post.id,
                platform_comment_id=f"c_burst_{i}",
                commenter_hash=hash_commenter_id(f"burst_user_{i}"),
                text="Scandalous response by government",
                timestamp=now - timedelta(minutes=i % 25),
                sentiment_label="Negative",
                permalink_url=build_youtube_comment_url(v_id, f"c_burst_{i}")
            )
        )
    await session.commit()

    alerts = await evaluate_post_alerts(session, post.id)
    velocity_alerts = [a for a in alerts if a.alert_type == "velocity_spike"]
    assert len(velocity_alerts) == 1
    assert velocity_alerts[0].severity == "warning"

def test_coordinated_bot_activity_detector():
    now = datetime.now(timezone.utc)
    # Generate 6 near-duplicate comments within 10 minutes
    spam_text = "CM Samrat Choudhary must resign immediately #BiharProtest2026"
    comments = []
    for i in range(6):
        comments.append(
            Comment(
                post_id=1,
                platform_comment_id=f"bot_{i}",
                commenter_hash=hash_commenter_id(f"bot_account_{i}"),
                text=spam_text if i % 2 == 0 else f"{spam_text} please take note",
                timestamp=now - timedelta(minutes=i * 2),
                permalink_url="http://test"
            )
        )

    res = detect_coordinated_activity(comments)
    assert res is not None
    assert res["is_flagged"] is True
    assert res["cluster_size"] >= 5
    assert "Possible coordinated/bot campaign" in res["note"]
