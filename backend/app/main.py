import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.config import settings
from app.database import init_db, AsyncSessionLocal, get_db
from app.models.post import Post
from app.services.seed_service import seed_database

# Routers
from app.api.v1.posts import router as posts_router
from app.api.v1.links import router as links_router
from app.api.v1.alerts import router as alerts_router
from app.api.v1.stats import router as stats_router
from app.api.v1.watchlist import router as watchlist_router
from app.api.v1.seed import router as seed_router
from app.api.v1.sse import router as sse_router
from app.api.v1.import_data import router as import_router
from app.api.v1.reports import router as reports_router
from app.api.v1.collectors import router as collectors_router
from app.api.v1.scheduler import router as scheduler_router
from app.api.v1.telegram import router as telegram_router
from app.api.v1.auth import router as auth_router
from app.services.scheduler_service import scheduler_service
from app.services.auth_service import init_default_users

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("watchtower")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing database schema...")
    await init_db()

    # Automatically seed synthetic data on first run if database is empty & initialize default users
    async with AsyncSessionLocal() as session:
        await init_default_users(session)
        count = await session.scalar(select(func.count(Post.id)))
        if not count:
            logger.info("Database is empty. Populating with initial synthetic dataset...")
            await seed_database(session)

    # Start automated background refresh scheduler (runs every 60s)
    scheduler_service.start()

    yield
    scheduler_service.stop()
    logger.info("Shutting down Social Media Watchtower...")

app = FastAPI(
    title="Social Media Watchtower API - Bihar CM Samrat Choudhary",
    description="Target-based public opinion monitoring, links explorer, and critical negative comment alerting system.",
    version="1.0.0",
    lifespan=lifespan
)

# CORS configuration
allowed_origins_env = getattr(settings, "ALLOWED_ORIGINS", None)
if allowed_origins_env and allowed_origins_env.strip() != "*":
    origins = [o.strip() for o in allowed_origins_env.split(",") if o.strip()]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    # Development / internal deployment with dynamic local/LAN origins support
    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=r"https?://.*",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# Include API v1 routers
app.include_router(posts_router, prefix="/api/v1")
app.include_router(links_router, prefix="/api/v1")
app.include_router(alerts_router, prefix="/api/v1")
app.include_router(stats_router, prefix="/api/v1")
app.include_router(watchlist_router, prefix="/api/v1")
app.include_router(seed_router, prefix="/api/v1")
app.include_router(sse_router, prefix="/api/v1")
app.include_router(import_router, prefix="/api/v1")
app.include_router(reports_router, prefix="/api/v1")
app.include_router(collectors_router, prefix="/api/v1")
app.include_router(scheduler_router, prefix="/api/v1")
app.include_router(telegram_router, prefix="/api/v1")
app.include_router(auth_router, prefix="/api/v1")

@app.get("/health", tags=["system"])
async def health_check():
    return {
        "status": "healthy",
        "service": "social-watchtower-api",
        "target": "Samrat Choudhary (CM Bihar)",
        "version": "1.0.0"
    }

@app.get("/metrics", tags=["system"])
async def metrics(db: AsyncSession = Depends(get_db)):
    total_posts = await db.scalar(select(func.count(Post.id))) or 0
    total_negative = await db.scalar(select(func.sum(Post.negative_comment_count))) or 0
    return {
        "watchtower_posts_tracked_total": total_posts,
        "watchtower_negative_comments_total": total_negative
    }

@app.get("/", tags=["system"])
async def root():
    return {
        "message": "Welcome to Social Media Watchtower for CM Samrat Choudhary",
        "documentation": "/docs",
        "health": "/health"
    }
