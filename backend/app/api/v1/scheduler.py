import asyncio
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from app.services.scheduler_service import scheduler_service

router = APIRouter(prefix="/scheduler", tags=["scheduler"])

class IntervalUpdate(BaseModel):
    interval_seconds: int = Field(default=60, ge=15, le=86400, description="Interval in seconds (min 15s)")

class ToggleRequest(BaseModel):
    enabled: bool

@router.get("/status")
async def get_scheduler_status():
    """
    Returns live background scheduler state, next refresh countdown,
    total cycles run, items ingested today, and recent execution history.
    """
    return scheduler_service.get_status()

@router.get("/platforms")
async def get_platform_refresh_statuses():
    """
    Returns the compact Data Refresh Status table:
    Platform | Refresh Interval | Last Updated | Next Refresh | Status
    """
    return scheduler_service.get_platform_statuses()

@router.post("/trigger/{platform_key}")
async def trigger_platform_refresh(platform_key: str):
    """
    Triggers refresh for a specific platform group: facebook, instagram, other, telegram.
    Launches as an asynchronous background task so UI transitions to 'Updating' without HTTP timeout.
    """
    clean_key = platform_key.strip().lower()
    if clean_key not in scheduler_service.platforms:
        raise HTTPException(status_code=400, detail=f"Invalid platform key: {platform_key}. Valid: {list(scheduler_service.platforms.keys())}")

    # Mark updating immediately
    scheduler_service.platforms[clean_key]["status"] = "Updating"
    asyncio.create_task(scheduler_service.refresh_platform(clean_key, is_manual=True))

    return {
        "status": "success",
        "message": f"Refresh initiated for platform: {clean_key}",
        "platform_statuses": scheduler_service.get_platform_statuses()
    }

@router.post("/trigger")
async def trigger_immediate_refresh():
    """
    Triggers an immediate live ingestion cycle across all 5 free public APIs,
    bypassing the timer interval.
    """
    try:
        res = await scheduler_service.trigger_cycle()
        return {
            "status": "success",
            "message": "Live ingestion cycle completed successfully.",
            "data": res
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Live ingestion failed: {e}")

@router.post("/toggle")
async def toggle_scheduler(req: ToggleRequest):
    """
    Starts or pauses the automated background scheduler loop.
    """
    if req.enabled:
        scheduler_service.start()
        msg = f"Automated background refresh started (every {scheduler_service.interval_seconds}s)."
    else:
        scheduler_service.stop()
        msg = "Automated background refresh paused."

    return {
        "status": "success",
        "is_running": scheduler_service.is_running,
        "message": msg
    }

@router.post("/interval")
async def set_scheduler_interval(req: IntervalUpdate):
    """
    Updates the refresh interval (e.g. 60s for every minute, 300s for 5 mins, 3600s for hourly).
    """
    scheduler_service.set_interval(req.interval_seconds)
    return {
        "status": "success",
        "interval_seconds": scheduler_service.interval_seconds,
        "message": f"Refresh interval set to {scheduler_service.interval_seconds} seconds."
    }
