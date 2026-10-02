import os
import re
import hashlib
import secrets
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any, Tuple
from sqlalchemy import select, func, and_, desc, text
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user import User, ActiveSession

logger = logging.getLogger(__name__)

MAX_CONCURRENT_SESSIONS = 5
SESSION_TTL_HOURS = 8
INACTIVITY_TIMEOUT_MINUTES = 120 # 2 hours of no heartbeat/activity

DEFAULT_USERS = [
    {
        "username": "admin",
        "password": "Bihar2026@CM",
        "display_name": "CM War Room Lead (Admin)",
        "role": "admin",
        "phone_number": "+91 9140407471"
    }
]

def hash_password(password: str, salt: Optional[str] = None) -> Tuple[str, str]:
    if not salt:
        salt = secrets.token_hex(16)
    combined = (password + salt).encode('utf-8')
    h = hashlib.sha256(combined).hexdigest()
    return h, salt

def verify_password(password: str, password_hash: str, salt: str) -> bool:
    h, _ = hash_password(password, salt)
    return secrets.compare_digest(h, password_hash)

async def init_default_users(db: AsyncSession):
    """Ensure schema updates, seed single primary Admin account, and clean default test placeholders."""
    # Ensure phone_number column exists in users table (SQLite safe alter)
    try:
        await db.execute(text("ALTER TABLE users ADD COLUMN phone_number VARCHAR(25)"))
        await db.commit()
        logger.info("Migrated users table: Added phone_number column.")
    except Exception:
        # Column already exists or table freshly created
        await db.rollback()

    # Ensure admin user has phone number +91 9140407471 registered
    try:
        await db.execute(text("UPDATE users SET phone_number = '+91 9140407471' WHERE username = 'admin'"))
        await db.commit()
    except Exception:
        await db.rollback()

    # Clean up initial placeholder test operators so admin has total custom control
    try:
        await db.execute(
            text("DELETE FROM users WHERE username IN ('operator1', 'operator2', 'analyst1', 'analyst2')")
        )
        await db.commit()
    except Exception:
        await db.rollback()

    for u_info in DEFAULT_USERS:
        existing = await db.scalar(select(User).where(User.username == u_info["username"]))
        if not existing:
            p_hash, p_salt = hash_password(u_info["password"])
            user = User(
                username=u_info["username"],
                password_hash=p_hash,
                password_salt=p_salt,
                display_name=u_info["display_name"],
                phone_number=u_info.get("phone_number"),
                role=u_info["role"],
                is_active=True
            )
            db.add(user)
        else:
            existing.phone_number = u_info["phone_number"]
    await db.commit()
    logger.info("Auth service: Single Primary Admin initialized with registered phone +91 9140407471.")

async def clean_stale_sessions(db: AsyncSession) -> int:
    """Deactivate expired sessions or sessions inactive beyond timeout."""
    now = datetime.now(timezone.utc)
    inactivity_cutoff = now - timedelta(minutes=INACTIVITY_TIMEOUT_MINUTES)

    res = await db.execute(
        select(ActiveSession).where(
            and_(
                ActiveSession.is_active == True,
                (ActiveSession.expires_at < now) | (ActiveSession.last_active_at < inactivity_cutoff)
            )
        )
    )
    stale_sessions = res.scalars().all()
    cleaned = len(stale_sessions)
    for s in stale_sessions:
        s.is_active = False

    if cleaned > 0:
        await db.commit()
        logger.info(f"Auth service: Cleaned {cleaned} stale sessions.")
    return cleaned

async def get_active_sessions_count(db: AsyncSession) -> int:
    """Returns currently active concurrent session count."""
    await clean_stale_sessions(db)
    count = await db.scalar(
        select(func.count(ActiveSession.id)).where(ActiveSession.is_active == True)
    )
    return count or 0

async def get_active_sessions_list(db: AsyncSession) -> List[Dict[str, Any]]:
    """Returns detailed list of all 5 slots and active sessions."""
    await clean_stale_sessions(db)
    res = await db.execute(
        select(ActiveSession).where(ActiveSession.is_active == True).order_by(desc(ActiveSession.last_active_at))
    )
    active = res.scalars().all()

    slots = []
    for i in range(MAX_CONCURRENT_SESSIONS):
        if i < len(active):
            s = active[i]
            slots.append({
                "slot_number": i + 1,
                "is_occupied": True,
                "session_id": s.session_id,
                "user_id": s.user_id,
                "username": s.username,
                "display_name": s.display_name,
                "ip_address": s.ip_address or "127.0.0.1",
                "user_agent": s.user_agent or "Web Browser",
                "device_info": s.device_info or "Desktop",
                "created_at": s.created_at.isoformat() if s.created_at else None,
                "last_active_at": s.last_active_at.isoformat() if s.last_active_at else None
            })
        else:
            slots.append({
                "slot_number": i + 1,
                "is_occupied": False,
                "session_id": None,
                "username": None,
                "display_name": "Available Slot (खाली स्लॉट)",
                "created_at": None
            })

    return slots

async def login_user(
    db: AsyncSession,
    username: str,
    password: str,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None
) -> Tuple[bool, Optional[Dict[str, Any]], Optional[str]]:
    """
    Attempts to authenticate user and establish a session.
    Strictly enforces maximum 5 concurrent active sessions.
    """
    username_clean = (username or "").strip().lower()
    user = await db.scalar(select(User).where(User.username == username_clean))

    if not user or not user.is_active:
        return False, None, "अमान्य यूज़रनेम या खाता निष्क्रिय है (Invalid username or inactive account)"

    if not verify_password(password, user.password_hash, user.password_salt):
        return False, None, "गलत पासवर्ड (Incorrect password)"

    # Clean stale sessions first
    await clean_stale_sessions(db)

    # Check concurrent active sessions count
    active_count = await get_active_sessions_count(db)

    # If already 5 active sessions and no existing session from this IP, reject early
    if active_count >= MAX_CONCURRENT_SESSIONS:
        existing_sess = await db.scalar(
            select(ActiveSession).where(
                and_(
                    ActiveSession.user_id == user.id,
                    ActiveSession.is_active == True,
                    ActiveSession.ip_address == (ip_address or "")
                )
            )
        )
        if not existing_sess:
            logger.warning(f"Login rejected for {username}: Maximum {MAX_CONCURRENT_SESSIONS} concurrent sessions already occupied.")
            return False, None, f"सत्र सीमा पूर्ण: एक समय में अधिकतम {MAX_CONCURRENT_SESSIONS} लॉगिन की अनुमति है। सभी {MAX_CONCURRENT_SESSIONS} स्लॉट उपयोग में हैं।"

    # Generate secure 64-char session token
    session_id = secrets.token_urlsafe(40)
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(hours=SESSION_TTL_HOURS)

    # Parse simple device info
    device_info = "Desktop"
    if user_agent:
        ua_lower = user_agent.lower()
        if "mobile" in ua_lower or "android" in ua_lower or "iphone" in ua_lower:
            device_info = "Mobile"
        elif "tablet" in ua_lower or "ipad" in ua_lower:
            device_info = "Tablet"

    new_session = ActiveSession(
        session_id=session_id,
        user_id=user.id,
        username=user.username,
        display_name=user.display_name,
        ip_address=ip_address,
        user_agent=user_agent[:250] if user_agent else None,
        device_info=device_info,
        is_active=True,
        created_at=now,
        last_active_at=now,
        expires_at=expires_at
    )
    db.add(new_session)
    await db.commit()

    logger.info(f"User {user.username} logged in successfully. Active slots: {active_count + 1}/{MAX_CONCURRENT_SESSIONS}.")

    return True, {
        "session_id": session_id,
        "username": user.username,
        "display_name": user.display_name,
        "phone_number": user.phone_number,
        "role": user.role,
        "active_sessions_count": active_count + 1,
        "max_allowed": MAX_CONCURRENT_SESSIONS
    }, None

async def logout_session(db: AsyncSession, session_id: str) -> bool:
    """Logs out a session and frees up its slot immediately."""
    session = await db.scalar(select(ActiveSession).where(ActiveSession.session_id == session_id))
    if session:
        session.is_active = False
        await db.commit()
        logger.info(f"Session {session_id} logged out. Slot freed.")
        return True
    return False

async def terminate_session_by_id(db: AsyncSession, session_id: str) -> bool:
    """Force terminates a session to free a slot for another user."""
    return await logout_session(db, session_id)

async def verify_session_token(db: AsyncSession, session_id: str) -> Optional[Dict[str, Any]]:
    """Verifies if session token is valid and active, updating heartbeat."""
    if not session_id:
        return None

    now = datetime.now(timezone.utc)
    session = await db.scalar(
        select(ActiveSession).where(
            and_(
                ActiveSession.session_id == session_id,
                ActiveSession.is_active == True,
                ActiveSession.expires_at > now
            )
        )
    )
    if not session:
        return None

    # Fetch user to ensure user is active and get role
    user = await db.scalar(select(User).where(User.id == session.user_id))
    if not user or not user.is_active:
        session.is_active = False
        await db.commit()
        return None

    # Update last_active_at keepalive
    session.last_active_at = now
    await db.commit()

    return {
        "session_id": session.session_id,
        "user_id": session.user_id,
        "username": user.username,
        "display_name": user.display_name,
        "phone_number": user.phone_number,
        "role": user.role
    }

async def get_all_users_list(db: AsyncSession) -> List[Dict[str, Any]]:
    """Lists all users with their roles, status, phone number, and active session count."""
    users_res = await db.execute(select(User).order_by(User.id))
    users = users_res.scalars().all()

    now = datetime.now(timezone.utc)
    sessions_res = await db.execute(
        select(ActiveSession.user_id, func.count(ActiveSession.id))
        .where(and_(ActiveSession.is_active == True, ActiveSession.expires_at > now))
        .group_by(ActiveSession.user_id)
    )
    active_map = dict(sessions_res.all())

    result = []
    for u in users:
        result.append({
            "id": u.id,
            "username": u.username,
            "display_name": u.display_name,
            "phone_number": u.phone_number,
            "role": u.role,
            "is_active": u.is_active,
            "created_at": u.created_at.isoformat() if u.created_at else None,
            "active_sessions": active_map.get(u.id, 0)
        })
    return result

async def admin_change_password(
    db: AsyncSession,
    user_id: int,
    new_password: str,
    terminate_sessions: bool = True
) -> Tuple[bool, Optional[str]]:
    """Changes password for any user with fresh salt and SHA-256 hash."""
    clean_pw = (new_password or "").strip()
    if len(clean_pw) < 4:
        return False, "पासवर्ड कम से कम 4 अक्षरों का होना चाहिए (Password must be at least 4 characters)"

    user = await db.scalar(select(User).where(User.id == user_id))
    if not user:
        return False, "यूज़र नहीं मिला (User not found)"

    p_hash, p_salt = hash_password(clean_pw)
    user.password_hash = p_hash
    user.password_salt = p_salt

    if terminate_sessions:
        await db.execute(
            ActiveSession.__table__.update()
            .where(ActiveSession.user_id == user_id)
            .values(is_active=False)
        )

    await db.commit()
    logger.info(f"Password changed successfully for user '{user.username}' (ID: {user_id}).")
    return True, None

async def admin_update_user(
    db: AsyncSession,
    user_id: int,
    username: Optional[str] = None,
    display_name: Optional[str] = None,
    phone_number: Optional[str] = None,
    role: Optional[str] = None,
    is_active: Optional[bool] = None
) -> Tuple[bool, Optional[str]]:
    """Updates user ID/username, display name, mobile phone number, role, or active status."""
    user = await db.scalar(select(User).where(User.id == user_id))
    if not user:
        return False, "यूज़र नहीं मिला (User not found)"

    if username is not None:
        clean_user = username.strip().lower()
        if len(clean_user) < 3:
            return False, "यूज़रनेम कम से कम 3 अक्षरों का होना चाहिए"
        if clean_user != user.username:
            existing = await db.scalar(select(User).where(User.username == clean_user))
            if existing:
                return False, f"यूज़रनेम '{clean_user}' पहले से उपयोग में है (Username already taken)"
            user.username = clean_user
            await db.execute(
                ActiveSession.__table__.update()
                .where(ActiveSession.user_id == user_id)
                .values(username=clean_user)
            )

    if display_name is not None and display_name.strip():
        clean_name = display_name.strip()
        user.display_name = clean_name
        await db.execute(
            ActiveSession.__table__.update()
            .where(ActiveSession.user_id == user_id)
            .values(display_name=clean_name)
        )

    if phone_number is not None:
        clean_phone = phone_number.strip()
        user.phone_number = clean_phone if clean_phone else None

    if role is not None and role in ["admin", "operator", "analyst", "viewer"]:
        user.role = role

    if is_active is not None:
        user.is_active = is_active
        if not is_active:
            await db.execute(
                ActiveSession.__table__.update()
                .where(ActiveSession.user_id == user_id)
                .values(is_active=False)
            )

    await db.commit()
    logger.info(f"User '{user.username}' (ID: {user_id}) updated successfully.")
    return True, None

async def admin_create_user(
    db: AsyncSession,
    username: str,
    password: str,
    display_name: str,
    phone_number: Optional[str] = None,
    role: str = "operator"
) -> Tuple[bool, Optional[Dict[str, Any]], Optional[str]]:
    """Creates a new operator/analyst user."""
    clean_user = (username or "").strip().lower()
    clean_pw = (password or "").strip()
    clean_name = (display_name or "").strip()
    clean_phone = (phone_number or "").strip()

    if len(clean_user) < 3:
        return False, None, "यूज़रनेम कम से कम 3 अक्षरों का होना चाहिए"
    if len(clean_pw) < 4:
        return False, None, "पासवर्ड कम से कम 4 अक्षरों का होना चाहिए"
    if not clean_name:
        clean_name = clean_user

    existing = await db.scalar(select(User).where(User.username == clean_user))
    if existing:
        return False, None, f"यूज़रनेम '{clean_user}' पहले से मौजूद है (Username already exists)"

    p_hash, p_salt = hash_password(clean_pw)
    new_user = User(
        username=clean_user,
        password_hash=p_hash,
        password_salt=p_salt,
        display_name=clean_name,
        phone_number=clean_phone if clean_phone else None,
        role=role if role in ["admin", "operator", "analyst", "viewer"] else "operator",
        is_active=True
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    return True, {
        "id": new_user.id,
        "username": new_user.username,
        "display_name": new_user.display_name,
        "phone_number": new_user.phone_number,
        "role": new_user.role,
        "is_active": new_user.is_active,
        "created_at": new_user.created_at.isoformat() if new_user.created_at else None
    }, None

async def link_user_phone(
    db: AsyncSession,
    user_id: int,
    phone_number: str
) -> Tuple[bool, Optional[str]]:
    """Links or updates mobile phone number for user."""
    user = await db.scalar(select(User).where(User.id == user_id))
    if not user:
        return False, "यूज़र नहीं मिला (User not found)"

    clean_phone = (phone_number or "").strip()
    if clean_phone and len(clean_phone) < 10:
        return False, "कृपया मान्य 10-अंकों का मोबाइल नंबर दर्ज करें (Invalid mobile number)"

    user.phone_number = clean_phone if clean_phone else None
    await db.commit()
    logger.info(f"Mobile number updated for user '{user.username}' (ID: {user_id}): {clean_phone}")
    return True, None

async def admin_delete_user(
    db: AsyncSession,
    user_id: int,
    requester_user_id: int
) -> Tuple[bool, Optional[str]]:
    """Deletes an operator account (cannot delete own account)."""
    if user_id == requester_user_id:
        return False, "एडमिन खुद का खाता हटा नहीं सकते (Cannot delete own account)"

    user = await db.scalar(select(User).where(User.id == user_id))
    if not user:
        return False, "यूज़र नहीं मिला (User not found)"

    await db.execute(
        ActiveSession.__table__.update()
        .where(ActiveSession.user_id == user_id)
        .values(is_active=False)
    )

    await db.delete(user)
    await db.commit()
    logger.info(f"User '{user.username}' (ID: {user_id}) deleted by admin ID {requester_user_id}.")
    return True, None

# ----------------------------------------------------
# MOBILE OTP LOGIN SYSTEM (ADMIN & USERS)
# ----------------------------------------------------

OTP_STORAGE: Dict[str, Dict[str, Any]] = {}
OTP_VALID_SECONDS = 300 # 5 minutes

def normalize_phone(phone: str) -> str:
    """Extracts 10-digit base phone number without formatting or +91 country code."""
    digits = re.sub(r'\D', '', phone or '')
    if len(digits) > 10 and digits.startswith('91'):
        digits = digits[2:]
    return digits

async def generate_and_send_otp(
    db: AsyncSession,
    identifier: str,
    phone_fallback: Optional[str] = None
) -> Tuple[bool, Optional[Dict[str, Any]], Optional[str]]:
    """
    Generates a secure 6-digit OTP for Admin or User.
    Dispatches to Telegram / SMS and returns masked phone & metadata.
    """
    clean_id = (identifier or "").strip().lower()
    if not clean_id:
        return False, None, "मोबाइल नंबर या यूज़र आईडी दर्ज करें (Enter phone or username)"

    user = None
    clean_digits = normalize_phone(clean_id)

    # 1. Check by phone number in database
    if clean_digits and len(clean_digits) >= 10:
        res = await db.execute(select(User).where(User.is_active == True))
        all_active = res.scalars().all()
        for u in all_active:
            if u.phone_number and normalize_phone(u.phone_number) == clean_digits:
                user = u
                break

    # 2. Check by username
    if not user:
        user = await db.scalar(select(User).where(User.username == clean_id, User.is_active == True))

    # 3. Special case for primary Admin
    if not user and clean_id == "admin":
        user = await db.scalar(select(User).where(User.username == "admin"))

    if not user:
        return False, None, "यह मोबाइल नंबर या यूज़र आईडी पंजीकृत नहीं है। कृपया सही नंबर या 'admin' दर्ज करें।"

    # Determine destination phone number
    target_phone = user.phone_number or phone_fallback or clean_id
    clean_target_digits = normalize_phone(target_phone)
    storage_key = user.username.lower()
    now = datetime.now(timezone.utc)

    # 4. Anti-Spam Rate Limiting: 45-second cooldown between OTP dispatches
    existing_otp = OTP_STORAGE.get(storage_key) or (OTP_STORAGE.get(clean_target_digits) if clean_target_digits else None)
    if existing_otp:
        elapsed = (now - existing_otp["created_at"]).total_seconds()
        if elapsed < 45:
            wait_sec = int(45 - elapsed)
            return False, None, f"कृपया नया OTP मांगने से पहले {wait_sec} सेकंड प्रतीक्षा करें (Please wait {wait_sec}s before requesting a new OTP)"

    # Generate 6-digit cryptographically secure OTP
    otp_code = f"{secrets.randbelow(900000) + 100000}"

    # Store OTP in memory
    otp_data = {
        "otp": otp_code,
        "created_at": now,
        "attempts": 0,
        "user_id": user.id,
        "phone": target_phone,
        "username": user.username
    }
    OTP_STORAGE[storage_key] = otp_data
    if clean_target_digits:
        OTP_STORAGE[clean_target_digits] = otp_data

    # Mask phone for privacy in UI: e.g. +91 94310 ****5
    masked_phone = target_phone
    if len(clean_target_digits) == 10:
        masked_phone = f"+91 {clean_target_digits[:4]}****{clean_target_digits[-2:]}"

    # Dispatch OTP strictly to recipient's mobile phone number via SMS
    from app.services.sms_service import sms_service
    sms_ok, sms_msg, provider, is_live_delivered, gateway_error = await sms_service.send_otp_sms(
        phone_number=target_phone,
        otp_code=otp_code,
        username=user.username
    )

    logger.info(f"📱 [SECURE MOBILE SMS OTP]: User '{user.username}' -> Mobile {target_phone} via {provider} (Delivered={is_live_delivered})")

    return True, {
        "username": user.username,
        "display_name": user.display_name,
        "role": user.role,
        "masked_phone": masked_phone,
        "expires_in_seconds": OTP_VALID_SECONDS,
        "sms_provider": provider,
        "is_live_delivered": is_live_delivered,
        "delivery_channel": "telegram",
        "gateway_notice": (gateway_error if not is_live_delivered else None),
        "message": f"6-अंकों का सुरक्षित OTP आपके Telegram ({masked_phone}) पर भेज दिया गया है।"
    }, None

async def verify_otp_and_login(
    db: AsyncSession,
    identifier: str,
    otp_code: str,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None
) -> Tuple[bool, Optional[Dict[str, Any]], Optional[str]]:
    """
    Verifies 6-digit OTP and authenticates user into 1 of the 5 concurrent session slots.
    """
    clean_id = (identifier or "").strip().lower()
    clean_otp = (otp_code or "").strip()
    clean_digits = normalize_phone(clean_id)

    # Check OTP in storage
    record = OTP_STORAGE.get(clean_id) or (OTP_STORAGE.get(clean_digits) if clean_digits else None)
    if not record:
        return False, None, "कोई सक्रिय OTP नहीं मिला या समय समाप्त हो चुका है। कृपया 'पुनः OTP भेजें' दबाएं।"

    # Check expiry
    now = datetime.now(timezone.utc)
    age = (now - record["created_at"]).total_seconds()
    if age > OTP_VALID_SECONDS:
        OTP_STORAGE.pop(clean_id, None)
        if clean_digits:
            OTP_STORAGE.pop(clean_digits, None)
        return False, None, "OTP समाप्त (Expired) हो गया है। कृपया नया OTP प्राप्त करें।"

    # Check attempts
    if record["attempts"] >= 3:
        OTP_STORAGE.pop(clean_id, None)
        if clean_digits:
            OTP_STORAGE.pop(clean_digits, None)
        return False, None, "अधिकतम 3 गलत प्रयास। सुरक्षा कारणों से यह OTP रद्द कर दिया गया है।"

    # Verify code
    if not secrets.compare_digest(record["otp"], clean_otp):
        record["attempts"] += 1
        remaining = 3 - record["attempts"]
        return False, None, f"गलत OTP दर्ज किया गया है। केवल {remaining} प्रयास शेष हैं।"

    # Fetch User
    user = await db.scalar(select(User).where(User.id == record["user_id"]))
    if not user or not user.is_active:
        return False, None, "यूज़र खाता निष्क्रिय है।"

    # If user doesn't have phone_number set and record had a phone, save it!
    if not user.phone_number and record.get("phone"):
        user.phone_number = record["phone"]
        await db.commit()

    # Clear OTP
    OTP_STORAGE.pop(clean_id, None)
    if clean_digits:
        OTP_STORAGE.pop(clean_digits, None)
    OTP_STORAGE.pop(user.username.lower(), None)

    # Enforce 5 concurrent sessions limit
    await clean_stale_sessions(db)
    active_count = await get_active_sessions_count(db)

    # Check existing session
    existing_session = await db.scalar(
        select(ActiveSession).where(
            and_(
                ActiveSession.user_id == user.id,
                ActiveSession.is_active == True,
                ActiveSession.ip_address == (ip_address or "")
            )
        )
    )

    if existing_session:
        existing_session.last_active_at = now
        existing_session.expires_at = now + timedelta(hours=SESSION_TTL_HOURS)
        existing_session.user_agent = user_agent
        await db.commit()
        return True, {
            "session_id": existing_session.session_id,
            "username": user.username,
            "display_name": user.display_name,
            "phone_number": user.phone_number,
            "role": user.role,
            "active_sessions_count": active_count,
            "max_allowed": MAX_CONCURRENT_SESSIONS
        }, None

    if active_count >= MAX_CONCURRENT_SESSIONS:
        logger.warning(f"OTP Login rejected for {user.username}: Maximum {MAX_CONCURRENT_SESSIONS} concurrent sessions occupied.")
        return False, None, f"सत्र सीमा पूर्ण: एक समय में अधिकतम {MAX_CONCURRENT_SESSIONS} लॉगिन की अनुमति है। सभी {MAX_CONCURRENT_SESSIONS} स्लॉट उपयोग में हैं।"

    session_id = secrets.token_urlsafe(40)
    expires_at = now + timedelta(hours=SESSION_TTL_HOURS)

    device_info = "Desktop"
    if user_agent:
        ua_lower = user_agent.lower()
        if "mobile" in ua_lower or "android" in ua_lower or "iphone" in ua_lower:
            device_info = "Mobile"
        elif "tablet" in ua_lower or "ipad" in ua_lower:
            device_info = "Tablet"

    new_session = ActiveSession(
        session_id=session_id,
        user_id=user.id,
        username=user.username,
        display_name=user.display_name,
        ip_address=ip_address,
        user_agent=user_agent[:250] if user_agent else None,
        device_info=device_info,
        is_active=True,
        created_at=now,
        last_active_at=now,
        expires_at=expires_at
    )
    db.add(new_session)
    await db.commit()

    logger.info(f"User '{user.username}' logged in via OTP successfully. Active slots: {active_count + 1}/{MAX_CONCURRENT_SESSIONS}.")

    return True, {
        "session_id": session_id,
        "username": user.username,
        "display_name": user.display_name,
        "phone_number": user.phone_number,
        "role": user.role,
        "active_sessions_count": active_count + 1,
        "max_allowed": MAX_CONCURRENT_SESSIONS
    }, None
