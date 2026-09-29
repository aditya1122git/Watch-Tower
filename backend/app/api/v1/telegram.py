from typing import Optional, Dict, Any, List
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from app.services.telegram_alert_service import telegram_alert_service
from app.config import settings

router = APIRouter(prefix="/telegram", tags=["telegram"])

class TelegramConfigRequest(BaseModel):
    bot_token: Optional[str] = Field(default=None, description="Telegram Bot API Token (from @BotFather)")
    target_chat_id: Optional[str] = Field(default=None, description="Comma-separated Telegram usernames or Chat IDs")
    target_chat_ids: Optional[List[str]] = Field(default=None, description="List of Telegram usernames or Chat IDs")

class RecipientRequest(BaseModel):
    chat_id: str = Field(..., description="Telegram username or numeric Chat ID to add or remove")

class TelegramTestRequest(BaseModel):
    bot_token: Optional[str] = Field(default=None, description="Optional Bot Token override for testing")
    target_chat_id: Optional[str] = Field(default=None, description="Optional target username/ID override")

@router.get("/config")
async def get_telegram_config() -> Dict[str, Any]:
    """Returns current Telegram Alert configuration, token status, recipients, and recent dispatch history."""
    return {
        "target_chat_id": telegram_alert_service.target_chat_id,
        "target_chat_ids": telegram_alert_service.target_chat_ids,
        "recipient_count": len(telegram_alert_service.target_chat_ids),
        "has_bot_token": bool(telegram_alert_service.bot_token),
        "recent_dispatched_count": len(telegram_alert_service.dispatched_history),
        "recent_history": telegram_alert_service.dispatched_history[:10],
        "format_template": "🔴 ALERT — {Platform} — Samrat Choudhary Ji\nViews: {Views}\nSentiment: NEGATIVE\nAccount: {Account}\n\n{Text}\n\n🔗 View on {Platform}"
    }

def _persist_to_env(updates: Dict[str, str]):
    try:
        from app.config import BASE_DIR
        env_path = BASE_DIR / ".env"
        lines = []
        if env_path.exists():
            with open(env_path, "r", encoding="utf-8") as f:
                lines = f.readlines()

        keys_set = set()
        new_lines = []
        for line in lines:
            matched = False
            for k, v in updates.items():
                if line.startswith(f"{k}=") or line.startswith(f"#{k}="):
                    new_lines.append(f"{k}={v}\n")
                    keys_set.add(k)
                    matched = True
                    break
            if not matched:
                new_lines.append(line)

        for k, v in updates.items():
            if k not in keys_set:
                new_lines.append(f"{k}={v}\n")

        with open(env_path, "w", encoding="utf-8") as f:
            f.writelines(new_lines)
    except Exception as e:
        pass

from fastapi import APIRouter, HTTPException, Depends, Header
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.services.auth_service import verify_session_token

@router.post("/config")
async def update_telegram_config(
    req: TelegramConfigRequest,
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID"),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Updates Telegram bot token and target chat IDs and persists to .env."""
    if settings.ENV == "production" and not settings.DEBUG:
        if not x_session_id:
            raise HTTPException(status_code=401, detail="लॉगिन सत्र आवश्यक है (Session required)")
        user_info = await verify_session_token(db, x_session_id)
        if not user_info:
            raise HTTPException(status_code=401, detail="अमान्य या समाप्त सत्र (Invalid session)")

    telegram_alert_service.update_config(
        bot_token=req.bot_token,
        target_chat_id=req.target_chat_id,
        target_chat_ids=req.target_chat_ids
    )
    env_updates = {}
    if req.bot_token:
        settings.TELEGRAM_BOT_TOKEN = req.bot_token
        env_updates["TELEGRAM_BOT_TOKEN"] = req.bot_token
    
    joined_ids = ", ".join(telegram_alert_service.target_chat_ids)
    settings.TELEGRAM_CHAT_ID = joined_ids
    settings.TELEGRAM_CHAT_IDS = joined_ids
    env_updates["TELEGRAM_CHAT_ID"] = joined_ids
    env_updates["TELEGRAM_CHAT_IDS"] = joined_ids
    
    _persist_to_env(env_updates)

    return {
        "status": "success",
        "message": f"Telegram alerts configured for {joined_ids}.",
        "has_bot_token": bool(telegram_alert_service.bot_token),
        "target_chat_id": joined_ids,
        "target_chat_ids": telegram_alert_service.target_chat_ids
    }

@router.post("/add-recipient")
async def add_recipient(
    req: RecipientRequest,
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID"),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Adds a new Telegram username or numeric Chat ID to the recipients list."""
    if settings.ENV == "production" and not settings.DEBUG:
        if not x_session_id:
            raise HTTPException(status_code=401, detail="लॉगिन सत्र आवश्यक है (Session required)")
        user_info = await verify_session_token(db, x_session_id)
        if not user_info:
            raise HTTPException(status_code=401, detail="अमान्य या समाप्त सत्र (Invalid session)")

    telegram_alert_service.add_recipient(req.chat_id)
    joined_ids = ", ".join(telegram_alert_service.target_chat_ids)
    settings.TELEGRAM_CHAT_ID = joined_ids
    settings.TELEGRAM_CHAT_IDS = joined_ids
    _persist_to_env({
        "TELEGRAM_CHAT_ID": joined_ids,
        "TELEGRAM_CHAT_IDS": joined_ids
    })
    return {
        "status": "success",
        "message": f"Added recipient {req.chat_id}",
        "target_chat_ids": telegram_alert_service.target_chat_ids
    }

@router.post("/remove-recipient")
async def remove_recipient(
    req: RecipientRequest,
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID"),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Removes a Telegram recipient from the list."""
    if settings.ENV == "production" and not settings.DEBUG:
        if not x_session_id:
            raise HTTPException(status_code=401, detail="लॉगिन सत्र आवश्यक है (Session required)")
        user_info = await verify_session_token(db, x_session_id)
        if not user_info:
            raise HTTPException(status_code=401, detail="अमान्य या समाप्त सत्र (Invalid session)")

    telegram_alert_service.remove_recipient(req.chat_id)
    joined_ids = ", ".join(telegram_alert_service.target_chat_ids)
    settings.TELEGRAM_CHAT_ID = joined_ids
    settings.TELEGRAM_CHAT_IDS = joined_ids
    _persist_to_env({
        "TELEGRAM_CHAT_ID": joined_ids,
        "TELEGRAM_CHAT_IDS": joined_ids
    })
    return {
        "status": "success",
        "message": f"Removed recipient {req.chat_id}",
        "target_chat_ids": telegram_alert_service.target_chat_ids
    }

@router.post("/test")
async def send_test_telegram_alert(req: TelegramTestRequest) -> Dict[str, Any]:
    """Sends a sample test alert formatted exactly as in the user's reference."""
    res = await telegram_alert_service.send_test_alert(
        bot_token=req.bot_token,
        chat_id=req.target_chat_id
    )
    return res
