from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, Response, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.services.report_service import generate_executive_pdf_report, get_news_channel_report

router = APIRouter(prefix="/reports", tags=["reports"])

@router.get("/pdf")
async def download_pdf_report(db: AsyncSession = Depends(get_db)):
    """
    Downloads executive intelligence report in PDF format.
    Contains News Media Analysis, Top 20 Negative, Top 20 Positive, and Top 20 Neutral posts with clickable links.
    """
    pdf_bytes = await generate_executive_pdf_report(db)
    filename = f"samrat_choudhary_watchtower_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@router.get("/news-channels")
async def get_news_channel_intelligence(db: AsyncSession = Depends(get_db)):
    """
    Returns aggregated news media intelligence covering CM Samrat Choudhary:
    - Per-channel reach, negative comment %, stance score and label, top headlines
    - High-level media summary
    """
    return await get_news_channel_report(db)

@router.get("/timeline")
async def get_hourly_minute_timeline(db: AsyncSession = Depends(get_db)):
    """
    Returns daily, hourly, and minute-by-minute activity and trend report:
    - 24-hour hourly trend & sentiment velocity
    - Minute-by-minute live ingestion feed
    - Summary metrics
    """
    from app.services.scheduler_service import scheduler_service
    return await scheduler_service.get_timeline_report(db)

@router.get("/bihar-media")
async def get_bihar_media_matrix(
    hours: Optional[float] = None,
    time_window: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """
    Returns comparative intelligence report and side-by-side graph data
    for the 10 specific Bihar news channels requested:
    News18 Bihar, Zee Bihar, ABP Bihar, News State, Sahara Samay,
    Bihar Tak, First Bihar, Live Cities, News4Nation, and Hindustani Media.
    """
    h = 4 if time_window == "4h" else (12 if time_window == "12h" else (24 if time_window == "24h" else hours))
    from app.services.bihar_media_service import generate_bihar_media_report
    return await generate_bihar_media_report(db, hours=h)


