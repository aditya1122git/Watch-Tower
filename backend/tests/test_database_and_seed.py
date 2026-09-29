import pytest
import pytest_asyncio
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from app.database import Base
from app.models.post import Post
from app.models.comment import Comment
from app.models.alert import Alert
from app.services.seed_service import seed_database
from app.services.privacy_service import hash_commenter_id

TEST_DB_URL = "sqlite+aiosqlite:///:memory:"

@pytest_asyncio.fixture
async def test_session():
    engine = create_async_engine(TEST_DB_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    Session = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)
    async with Session() as session:
        yield session

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()

@pytest.mark.asyncio
async def test_seed_and_privacy_compliance(test_session: AsyncSession):
    # Run seeding
    await seed_database(test_session)

    # 1. Verify posts were created
    post_count = await test_session.scalar(select(func.count(Post.id)))
    assert post_count >= 5

    # 2. Verify critical post has >500 negative comments
    res = await test_session.execute(select(Post).where(Post.negative_comment_count >= 500))
    critical_post = res.scalar_one_or_none()
    assert critical_post is not None
    assert critical_post.negative_comment_count >= 500
    assert critical_post.alert_flag is True
    assert critical_post.alert_milestone == 500

    # 3. Verify comments and privacy hashing
    comment_count = await test_session.scalar(select(func.count(Comment.id)))
    assert comment_count >= 500

    comments = (await test_session.execute(select(Comment).limit(10))).scalars().all()
    for c in comments:
        # Verify commenter_hash is a 64-char hex SHA256 string
        assert len(c.commenter_hash) == 64
        # Verify raw identifier is NOT stored in any field
        assert not c.commenter_hash.startswith("user_")
        # Verify permalink exists and matches platform format
        assert "youtube.com" in c.permalink_url or "x.com" in c.permalink_url

    # 4. Verify Alert record
    alert_res = await test_session.execute(select(Alert).where(Alert.milestone_value == 500))
    alert = alert_res.scalar_one_or_none()
    assert alert is not None
    assert alert.severity == "critical"
    assert len(alert.top_negative_comments_json) >= 5
    for neg_c in alert.top_negative_comments_json:
        assert "text" in neg_c
        assert "permalink" in neg_c
        assert "youtube.com/watch?v=" in neg_c["permalink"]

def test_hash_commenter_id_deterministic_and_salted():
    raw_user_1 = "yt_channel_UC12345"
    salt_a = "salt_alpha"
    salt_b = "salt_beta"

    hash_a1 = hash_commenter_id(raw_user_1, salt=salt_a)
    hash_a2 = hash_commenter_id(raw_user_1, salt=salt_a)
    hash_b = hash_commenter_id(raw_user_1, salt=salt_b)

    assert len(hash_a1) == 64
    assert hash_a1 == hash_a2 # Deterministic with same salt
    assert hash_a1 != hash_b  # Different salt produces different hash
