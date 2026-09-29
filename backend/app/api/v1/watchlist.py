from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models.watchlist import WatchlistItem
from app.schemas.watchlist import WatchlistItemResponse, WatchlistItemCreate

router = APIRouter(prefix="/watchlist", tags=["watchlist"])

@router.get("", response_model=List[WatchlistItemResponse])
async def list_watchlist(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(WatchlistItem).order_by(WatchlistItem.id))
    return result.scalars().all()

@router.post("", response_model=WatchlistItemResponse)
async def create_watchlist_item(item_in: WatchlistItemCreate, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(WatchlistItem).where(WatchlistItem.value == item_in.value))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Item value already exists in watchlist")
    item = WatchlistItem(**item_in.model_dump())
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item
