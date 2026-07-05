from typing import Optional

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


async def write_audit_log(
    db: AsyncSession,
    *,
    user_id: Optional[int],
    company_id: Optional[int],
    action: str,
    table_name: Optional[str] = None,
    record_id: Optional[int] = None,
    ip_address: Optional[str] = None,
) -> None:
    """Persist an admin/HR action audit row."""
    await db.execute(
        text(
            """
            INSERT INTO audit_logs
                (user_id, company_id, action, table_name, record_id, ip_address)
            VALUES
                (:user_id, :company_id, :action, :table_name, :record_id, :ip_address)
            """
        ),
        {
            "user_id": user_id,
            "company_id": company_id,
            "action": action,
            "table_name": table_name,
            "record_id": record_id,
            "ip_address": ip_address,
        },
    )
