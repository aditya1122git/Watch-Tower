from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db, AsyncSessionLocal
from app.services.collector_service import collector_service
from app.config import settings

router = APIRouter(prefix="/collectors", tags=["collectors"])

class RunFreeCollectorsRequest(BaseModel):
    keywords: Optional[List[str]] = Field(default=None, description="Target keywords (e.g. Samrat Choudhary, सम्राट चौधरी)")
    max_per_platform: int = Field(default=15, ge=1, le=50, description="Max posts to fetch per platform")

@router.get("", response_model=Dict[str, Any])
async def list_collectors():
    """
    Returns discovery metadata and live status for all supported collectors:
    - Free Public APIs (Google News RSS, Reddit Atom/RSS, Mastodon, Wikipedia, Telegram Web)
    - Optional Key-Based Adapters (YouTube Data API v3, Twitter/X API v2, Meta Graph API)
    """
    free_collectors = collector_service.get_collector_metadata()

    key_based_collectors = [
        {
            "platform": "youtube",
            "display_name": "YouTube Data API v3",
            "type": "Official Google Cloud API",
            "description": "Direct search and comment thread retrieval for official Bihar news and political speeches.",
            "requires_api_key": True,
            "has_api_key": bool(settings.YOUTUBE_API_KEY),
            "status": "ready" if settings.YOUTUBE_API_KEY else "key_optional_fallback_active",
            "rate_limit": "10,000 quota units / day",
            "features": ["Video Comments", "Verified Channels", "Live Transcripts"]
        },
        {
            "platform": "twitter",
            "display_name": "X / Twitter API v2",
            "type": "Official X Developer API",
            "description": "Real-time tweet stream and filtered search for official and opposition political handles.",
            "requires_api_key": True,
            "has_api_key": bool(settings.TWITTER_BEARER_TOKEN),
            "status": "ready" if settings.TWITTER_BEARER_TOKEN else "key_optional_fallback_active",
            "rate_limit": "Basic / Pro Tier limits",
            "features": ["Public Tweets", "Quotes & Replies", "Author Metrics"]
        },
        {
            "platform": "meta",
            "display_name": "Meta Graph API (Facebook / Instagram)",
            "type": "Official Meta Graph API",
            "description": "Page public content access and file-based JSON/CSV data import.",
            "requires_api_key": True,
            "has_api_key": bool(settings.META_ACCESS_TOKEN),
            "status": "ready" if settings.META_ACCESS_TOKEN else "file_import_mode_active",
            "rate_limit": "App Rate Limits / Offline Batch",
            "features": ["Page Posts", "Reels", "JSON/CSV Importer"]
        }
    ]

    return {
        "free_public_collectors": free_collectors,
        "key_based_collectors": key_based_collectors,
        "active_llm_provider": settings.LLM_PROVIDER,
        "has_gemini_key": bool(settings.GEMINI_API_KEY),
        "target_person": "Samrat Choudhary (Chief Minister of Bihar)"
    }

@router.post("/run-free")
async def run_free_collectors_endpoint(
    req: RunFreeCollectorsRequest = RunFreeCollectorsRequest(),
    db: AsyncSession = Depends(get_db)
):
    """
    Executes all 5 zero-cost, key-free public collectors concurrently:
    - Google News Hindi & English RSS
    - Reddit (r/bihar, r/india, r/biharpolitics)
    - Mastodon Fediverse (#Bihar, #SamratChoudhary)
    - Wikipedia Revision & Bio Action API
    - Telegram Public Channel Previews

    Classifies target sentiment, deduplicates, stores in database, and triggers alerts.
    """
    try:
        result = await collector_service.run_free_collectors(
            db=db,
            keywords=req.keywords,
            max_per_platform=req.max_per_platform
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Collector execution failed: {e}")
