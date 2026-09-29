from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, desc
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models.alert import Alert
from app.schemas.alert import AlertResponse, AlertAction

router = APIRouter(prefix="/alerts", tags=["alerts"])

@router.get("", response_model=List[AlertResponse])
async def list_alerts(
    status: Optional[str] = Query(None, pattern="^(active|acknowledged|resolved)$"),
    severity: Optional[str] = None,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db)
):
    query = select(Alert).options(selectinload(Alert.post))
    if status:
        query = query.where(Alert.status == status)
    if severity:
        query = query.where(Alert.severity == severity)
    query = query.order_by(desc(Alert.triggered_at)).offset(offset).limit(limit)
    result = await db.execute(query)
    alerts = result.scalars().all()

    enriched: List[AlertResponse] = []
    for a in alerts:
        resp = AlertResponse.model_validate(a)
        if a.post:
            resp.post_permalink = a.post.permalink_url
            resp.post_title = a.post.text
            resp.platform = a.post.platform
        enriched.append(resp)
    return enriched

@router.post("/{alert_id}/action", response_model=AlertResponse)
async def take_alert_action(
    alert_id: int,
    action_in: AlertAction,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Alert).options(selectinload(Alert.post)).where(Alert.id == alert_id)
    )
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    if action_in.action == "acknowledge":
        alert.status = "acknowledged"
        alert.acknowledged_by = action_in.user
    elif action_in.action == "resolve":
        alert.status = "resolved"
        alert.resolved_by = action_in.user
        alert.resolved_at = datetime.now(timezone.utc)
    else:
        raise HTTPException(status_code=400, detail="Invalid action. Must be acknowledge or resolve.")

    await db.commit()
    await db.refresh(alert)

    resp = AlertResponse.model_validate(alert)
    if alert.post:
        resp.post_permalink = alert.post.permalink_url
        resp.post_title = alert.post.text
        resp.platform = alert.post.platform
    return resp
