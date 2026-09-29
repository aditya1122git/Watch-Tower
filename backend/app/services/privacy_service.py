import hashlib
import hmac
from datetime import datetime, timezone, timedelta
from typing import Tuple
from sqlalchemy import select, update, delete
from sqlalchemy.ext.asyncio import AsyncSession
from app.config import settings
from app.models.comment import Comment
from app.models.audit import AuditLog

def hash_commenter_id(raw_author_id: str, salt: str = settings.HASH_SALT) -> str:
    """
    One-way salted HMAC-SHA256 hash for commenter identities.
    Prevents cross-profiling and doxxing while allowing duplicate/burst detection.
    """
    if not raw_author_id:
        return hashlib.sha256(b"anonymous").hexdigest()
    
    key = salt.encode("utf-8")
    msg = raw_author_id.strip().encode("utf-8")
    return hmac.new(key, msg, hashlib.sha256).hexdigest()

async def purge_expired_comments(
    db: AsyncSession,
    retention_days: int = settings.COMMENT_RETENTION_DAYS,
    user: str = "automated_retention_job"
) -> int:
    """
    Purges raw comment texts older than retention_days (default 90 days) per DPDP Act 2023.
    Preserves post-level aggregate metrics, sentiment scores, and alert history.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=retention_days)
    
    # We anonymize/clear the text and hashed id or delete the expired comment rows
    # Deleting old granular comment rows past 90 days:
    result = await db.execute(
        delete(Comment).where(Comment.timestamp < cutoff)
    )
    purged_count = result.rowcount

    # Log audit entry
    audit = AuditLog(
        user=user,
        action="purge_expired_comments",
        details={
            "retention_days": retention_days,
            "cutoff": cutoff.isoformat(),
            "purged_count": purged_count
        }
    )
    db.add(audit)
    await db.commit()
    return purged_count
