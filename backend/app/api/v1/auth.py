from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Request, Header
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.services.auth_service import (
    login_user,
    logout_session,
    terminate_session_by_id,
    get_active_sessions_list,
    get_active_sessions_count,
    verify_session_token,
    get_all_users_list,
    admin_change_password,
    admin_update_user,
    admin_create_user,
    admin_delete_user,
    link_user_phone,
    generate_and_send_otp,
    verify_otp_and_login,
    verify_password,
    hash_password,
    MAX_CONCURRENT_SESSIONS
)
from sqlalchemy import select

router = APIRouter(prefix="/auth", tags=["auth"])

class SendOtpRequest(BaseModel):
    identifier: str = Field(..., description="Mobile number or username (e.g. admin or +91 94310 12345)")
    phone_fallback: Optional[str] = Field(None, description="Phone number if admin has not linked one yet")

class VerifyOtpRequest(BaseModel):
    identifier: str = Field(..., description="Mobile number or username")
    otp: str = Field(..., min_length=4, max_length=10, description="6-digit OTP code")

class LoginRequest(BaseModel):
    username: str = Field(..., description="User login name")
    password: str = Field(..., description="User password")

class LogoutRequest(BaseModel):
    session_id: Optional[str] = Field(None, description="Active session ID to terminate")

class ChangePasswordRequest(BaseModel):
    new_password: str = Field(..., min_length=4, description="New password")
    terminate_sessions: bool = Field(True, description="Terminate active sessions for user")

class UpdateUserRequest(BaseModel):
    username: Optional[str] = Field(None, min_length=3)
    display_name: Optional[str] = Field(None, min_length=1)
    phone_number: Optional[str] = Field(None)
    role: Optional[str] = Field(None)
    is_active: Optional[bool] = Field(None)

class CreateUserRequest(BaseModel):
    username: str = Field(..., min_length=3)
    password: str = Field(..., min_length=4)
    display_name: str = Field(..., min_length=1)
    phone_number: Optional[str] = Field(None)
    role: str = Field("operator")

class LinkPhoneRequest(BaseModel):
    phone_number: str = Field(..., description="10-digit mobile number")

class SelfChangePasswordRequest(BaseModel):
    old_password: str = Field(...)
    new_password: str = Field(..., min_length=4)

async def require_admin_user(
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID"),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Ensures requester is authenticated and has admin role."""
    if not x_session_id:
        raise HTTPException(status_code=401, detail="लॉगिन सत्र आवश्यक है (Session required)")
    user_info = await verify_session_token(db, x_session_id)
    if not user_info:
        raise HTTPException(status_code=401, detail="सत्र समाप्त या अमान्य (Session expired or invalid)")
    if user_info.get("role") != "admin":
        raise HTTPException(
            status_code=403,
            detail="अनुमति अस्वीकृत: केवल एडमिन ही यूज़र व पासवर्ड बदल सकते हैं (Admin role required)"
        )
    return user_info

@router.post("/login")
async def login(
    req: LoginRequest,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    Authenticates user and assigns 1 of 5 concurrent session slots.
    Rejects with 403 Forbidden if all 5 slots are already occupied.
    """
    ip_address = request.client.host if request.client else "127.0.0.1"
    user_agent = request.headers.get("user-agent", "Unknown")

    success, session_data, error_msg = await login_user(
        db=db,
        username=req.username,
        password=req.password,
        ip_address=ip_address,
        user_agent=user_agent
    )

    if not success:
        # If rejected due to session limit, return 403 with detailed payload
        if "सत्र सीमा पूर्ण" in (error_msg or "") or "Maximum" in (error_msg or ""):
            active_slots = await get_active_sessions_list(db)
            raise HTTPException(
                status_code=403,
                detail={
                    "error": "MAX_CONCURRENT_SESSIONS_EXCEEDED",
                    "message": error_msg,
                    "max_allowed": MAX_CONCURRENT_SESSIONS,
                    "active_slots": active_slots
                }
            )
        raise HTTPException(status_code=401, detail=error_msg)

    return {
        "status": "success",
        "data": session_data
    }

@router.post("/otp/send")
async def send_login_otp(
    req: SendOtpRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Generates and sends a secure 6-digit OTP for Admin/User login strictly to their mobile number via SMS.
    """
    success, data, err_msg = await generate_and_send_otp(
        db=db,
        identifier=req.identifier,
        phone_fallback=req.phone_fallback
    )
    if not success:
        raise HTTPException(status_code=400, detail=err_msg)

    return {
        "status": "success",
        "message": (data.get("message") if data else None) or f"OTP आपके Telegram ({data['masked_phone']}) पर भेज दिया गया है।",
        "data": data
    }

@router.post("/otp/verify")
async def verify_login_otp(
    req: VerifyOtpRequest,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    Verifies 6-digit OTP and authenticates user into 1 of the 5 concurrent session slots.
    """
    ip_address = request.client.host if request.client else "127.0.0.1"
    user_agent = request.headers.get("user-agent", "Unknown")

    success, session_data, error_msg = await verify_otp_and_login(
        db=db,
        identifier=req.identifier,
        otp_code=req.otp,
        ip_address=ip_address,
        user_agent=user_agent
    )

    if not success:
        if "सत्र सीमा पूर्ण" in (error_msg or "") or "Maximum" in (error_msg or ""):
            active_slots = await get_active_sessions_list(db)
            raise HTTPException(
                status_code=403,
                detail={
                    "error": "MAX_CONCURRENT_SESSIONS_EXCEEDED",
                    "message": error_msg,
                    "max_allowed": MAX_CONCURRENT_SESSIONS,
                    "active_slots": active_slots
                }
            )
        raise HTTPException(status_code=400, detail=error_msg)

    return {
        "status": "success",
        "message": "OTP verified successfully. War Room access granted.",
        "data": session_data
    }

@router.post("/logout")
async def logout(
    req: LogoutRequest = LogoutRequest(),
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID"),
    db: AsyncSession = Depends(get_db)
):
    """
    Terminates session and immediately frees up 1 of the 5 concurrent session slots.
    """
    target_id = req.session_id or x_session_id
    if not target_id:
        raise HTTPException(status_code=400, detail="Session ID required")

    await logout_session(db, target_id)
    active_count = await get_active_sessions_count(db)

    return {
        "status": "success",
        "message": "Session terminated successfully. Slot is now available.",
        "active_sessions_remaining": active_count,
        "max_allowed": MAX_CONCURRENT_SESSIONS
    }

@router.get("/sessions")
async def list_active_sessions(db: AsyncSession = Depends(get_db)):
    """
    Returns the live status of all 5 session slots.
    Shows which slots are active, username, device info, and which slots are free.
    """
    slots = await get_active_sessions_list(db)
    active_count = sum(1 for s in slots if s["is_occupied"])

    return {
        "status": "success",
        "max_concurrent_logins": MAX_CONCURRENT_SESSIONS,
        "active_sessions_count": active_count,
        "available_slots": MAX_CONCURRENT_SESSIONS - active_count,
        "slots": slots
    }

@router.post("/sessions/{session_id}/terminate")
async def terminate_session(
    session_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Forcefully terminates an active session (e.g. if someone forgot to log out)
    to free up a slot for another operator.
    """
    success = await terminate_session_by_id(db, session_id)
    if not success:
        raise HTTPException(status_code=404, detail="Session not found or already inactive")

    active_count = await get_active_sessions_count(db)
    return {
        "status": "success",
        "message": f"Session {session_id[:8]}... terminated. Slot freed.",
        "active_sessions_count": active_count,
        "max_allowed": MAX_CONCURRENT_SESSIONS
    }

@router.get("/me")
async def get_current_user(
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID"),
    db: AsyncSession = Depends(get_db)
):
    """
    Validates token and returns current user and active session slots count.
    """
    if not x_session_id:
        raise HTTPException(status_code=401, detail="X-Session-ID header missing")

    user_info = await verify_session_token(db, x_session_id)
    if not user_info:
        raise HTTPException(status_code=401, detail="Session expired or invalid")

    active_count = await get_active_sessions_count(db)
    return {
        "status": "success",
        "user": user_info,
        "active_sessions_count": active_count,
        "max_allowed": MAX_CONCURRENT_SESSIONS
    }

@router.post("/heartbeat")
async def heartbeat(
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID"),
    db: AsyncSession = Depends(get_db)
):
    """Keep-alive heartbeat sent by frontend to maintain active session."""
    if not x_session_id:
        raise HTTPException(status_code=400, detail="X-Session-ID required")

    user_info = await verify_session_token(db, x_session_id)
    if not user_info:
        raise HTTPException(status_code=401, detail="Session expired")

    return {"status": "ok", "timestamp": str(user_info.get("last_active_at", ""))}

@router.get("/users")
async def list_users(
    admin: Dict[str, Any] = Depends(require_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """Admin-only: list all system users, their roles, phone numbers, and active sessions."""
    users = await get_all_users_list(db)
    return {"status": "success", "users": users}

@router.post("/users")
async def create_user(
    req: CreateUserRequest,
    admin: Dict[str, Any] = Depends(require_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """Admin-only: create a new operator or analyst user."""
    success, user_data, err = await admin_create_user(
        db=db,
        username=req.username,
        password=req.password,
        display_name=req.display_name,
        phone_number=req.phone_number,
        role=req.role
    )
    if not success:
        raise HTTPException(status_code=400, detail=err)
    return {"status": "success", "message": "यूज़र सफलतापूर्वक बनाया गया", "user": user_data}

@router.post("/users/{user_id}/change-password")
async def change_user_password(
    user_id: int,
    req: ChangePasswordRequest,
    admin: Dict[str, Any] = Depends(require_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """Admin-only: change password of any user/operator directly."""
    success, err = await admin_change_password(
        db=db,
        user_id=user_id,
        new_password=req.new_password,
        terminate_sessions=req.terminate_sessions
    )
    if not success:
        raise HTTPException(status_code=400, detail=err)
    return {
        "status": "success",
        "message": "पासवर्ड सफलतापूर्वक बदल दिया गया (Password updated successfully)"
    }

@router.put("/users/{user_id}")
async def update_user(
    user_id: int,
    req: UpdateUserRequest,
    admin: Dict[str, Any] = Depends(require_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """Admin-only: update user ID (username), display name, mobile number, role, or active status."""
    success, err = await admin_update_user(
        db=db,
        user_id=user_id,
        username=req.username,
        display_name=req.display_name,
        phone_number=req.phone_number,
        role=req.role,
        is_active=req.is_active
    )
    if not success:
        raise HTTPException(status_code=400, detail=err)
    return {"status": "success", "message": "यूज़र विवरण सफलतापूर्वक अपडेट किया गया"}

@router.delete("/users/{user_id}")
async def delete_user(
    user_id: int,
    admin: Dict[str, Any] = Depends(require_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """Admin-only: delete an operator account."""
    success, err = await admin_delete_user(
        db=db,
        user_id=user_id,
        requester_user_id=admin["user_id"]
    )
    if not success:
        raise HTTPException(status_code=400, detail=err)
    return {"status": "success", "message": "यूज़र खाता सफलतापूर्वक हटाया गया"}

@router.post("/link-phone")
async def link_phone(
    req: LinkPhoneRequest,
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID"),
    db: AsyncSession = Depends(get_db)
):
    """Allows authenticated user (Admin or Operator) to link their mobile number."""
    if not x_session_id:
        raise HTTPException(status_code=401, detail="लॉगिन आवश्यक है")
    user_info = await verify_session_token(db, x_session_id)
    if not user_info:
        raise HTTPException(status_code=401, detail="सत्र समाप्त या अमान्य")

    success, err = await link_user_phone(db, user_info["user_id"], req.phone_number)
    if not success:
        raise HTTPException(status_code=400, detail=err)
    return {
        "status": "success",
        "message": "मोबाइल नंबर सफलतापूर्वक लिंक कर दिया गया (Mobile number linked successfully)",
        "phone_number": req.phone_number
    }

@router.post("/change-my-password")
async def change_my_password(
    req: SelfChangePasswordRequest,
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID"),
    db: AsyncSession = Depends(get_db)
):
    """Allows current logged in user to change their own password."""
    if not x_session_id:
        raise HTTPException(status_code=401, detail="लॉगिन आवश्यक है")
    user_info = await verify_session_token(db, x_session_id)
    if not user_info:
        raise HTTPException(status_code=401, detail="सत्र समाप्त या अमान्य")

    user = await db.scalar(select(User).where(User.id == user_info["user_id"]))
    if not user:
        raise HTTPException(status_code=404, detail="यूज़र नहीं मिला")

    if not verify_password(req.old_password, user.password_hash, user.password_salt):
        raise HTTPException(status_code=400, detail="पुराना पासवर्ड गलत है (Incorrect current password)")

    p_hash, p_salt = hash_password(req.new_password)
    user.password_hash = p_hash
    user.password_salt = p_salt
    await db.commit()

    return {"status": "success", "message": "आपका पासवर्ड सफलतापूर्वक बदल दिया गया"}
