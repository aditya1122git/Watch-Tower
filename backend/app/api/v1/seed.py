from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.config import settings
from app.services.seed_service import seed_database
from app.services.auth_service import verify_session_token

router = APIRouter(prefix="/seed", tags=["seed"])

@router.post("")
async def trigger_seed(
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID"),
    db: AsyncSession = Depends(get_db)
):
    if settings.ENV == "production" and not settings.DEBUG:
        if not x_session_id:
            raise HTTPException(status_code=401, detail="लॉगिन आवश्यक है (Admin authentication required in production)")
        user_info = await verify_session_token(db, x_session_id)
        if not user_info or user_info.get("role") != "admin":
            raise HTTPException(status_code=403, detail="केवल एडमिन ही डेटाबेस री-सीड कर सकते हैं (Admin role required)")

    await seed_database(db)
    return {"status": "success", "message": "Database successfully seeded with realistic synthetic Bihar CM dataset and 501+ negative comments alert scenario."}
