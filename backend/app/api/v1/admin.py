from fastapi import APIRouter, Depends
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import require_permission
from app.db.session import get_db
from app.models.auth import LoginAttempts
from app.models.language import LanguageMaster

router = APIRouter(prefix="/admin", tags=["Admin Portal"])


@router.get("/audit-logins")
async def list_login_audit_logs(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("reports.view")),
):
    """List recent login audit events."""
    result = await db.execute(
        select(LoginAttempts).order_by(LoginAttempts.attempted_at.desc()).limit(100)
    )
    rows = result.scalars().all()
    return [
        {
            "id": row.id,
            "user_id": row.user_id,
            "email_attempted": row.email_attempted,
            "ip_address": row.ip_address,
            "success": row.success,
            "attempted_at": row.attempted_at,
        }
        for row in rows
    ]


@router.get("/audit-logs")
async def list_action_audit_logs(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("reports.view")),
):
    """List recent admin/HR action audit events."""
    result = await db.execute(
        text(
            """
            SELECT
                al.id,
                al.user_id,
                al.company_id,
                al.action,
                al.table_name,
                al.record_id,
                al.ip_address,
                al.created_date,
                u.email
            FROM audit_logs al
            LEFT JOIN user_master u ON u.user_id = al.user_id
            WHERE (:role_id = 1 OR al.company_id = :company_id)
            ORDER BY al.created_date DESC, al.id DESC
            LIMIT 200
            """
        ),
        {"role_id": current_user.role_id, "company_id": current_user.company_id},
    )
    return [
        {
            "id": row.id,
            "user_id": row.user_id,
            "company_id": row.company_id,
            "email": row.email,
            "action": row.action,
            "table_name": row.table_name,
            "record_id": row.record_id,
            "ip_address": row.ip_address,
            "created_at": row.created_date,
        }
        for row in result
    ]


@router.get("/languages")
async def list_languages(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("videos.manage")),
):
    """List platform languages configured in language_master."""
    result = await db.execute(select(LanguageMaster).order_by(LanguageMaster.language_name))
    return [
        {"language_id": row.language_id, "language_name": row.language_name}
        for row in result.scalars().all()
    ]
