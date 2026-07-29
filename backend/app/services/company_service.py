import json
import logging
import re
from datetime import datetime

from fastapi import HTTPException, status
from sqlalchemy import bindparam, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.company import CompanyMaster
from app.schemas.company import CompanyCreate, CompanyUpdate

logger = logging.getLogger(__name__)


class CompanyService:
    async def get_all(self, db: AsyncSession) -> list:
        result = await db.execute(select(CompanyMaster).where(CompanyMaster.is_deleted == "N"))
        return result.scalars().all()

    async def get_by_id(self, db: AsyncSession, company_id: int) -> CompanyMaster:
        result = await db.execute(
            select(CompanyMaster).where(
                CompanyMaster.company_id == company_id,
                CompanyMaster.is_deleted == "N",
            )
        )
        company = result.scalar_one_or_none()
        if not company:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Company not found.",
            )
        return company

    async def create(self, db: AsyncSession, data: CompanyCreate) -> CompanyMaster:
        data_dict = data.model_dump()

        # Normalize company_code
        if "company_code" in data_dict and data_dict["company_code"]:
            data_dict["company_code"] = data_dict["company_code"].upper()
        data_dict = await self._normalize_service_details(db, data_dict)

        # Check duplicate code
        existing = await db.execute(
            select(CompanyMaster).where(CompanyMaster.company_code == data_dict["company_code"])
        )
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Company code already exists.",
            )

        company = CompanyMaster(
            **data_dict,
            status="Active",
        )

        db.add(company)
        await db.commit()
        await db.refresh(company)
        await db.execute(
            text(
                """
                INSERT IGNORE INTO company_languages (company_id, language_id, is_default)
                VALUES (:company_id, 1, TRUE)
                """
            ),
            {"company_id": company.company_id},
        )
        await db.commit()
        return company

    async def update(self, db: AsyncSession, company_id: int, data: CompanyUpdate) -> CompanyMaster:
        company = await self.get_by_id(db, company_id)

        # Only update fields that were actually sent
        update_data = data.model_dump(exclude_unset=True)
        if "service_details_json" in update_data or "company_code" in update_data:
            merged_data = {
                "company_code": update_data.get("company_code", company.company_code),
                "service_details_json": update_data.get(
                    "service_details_json",
                    company.service_details_json,
                ),
                "scope_codes_json": update_data.get("scope_codes_json", company.scope_codes_json),
            }
            normalized = await self._normalize_service_details(db, merged_data)
            update_data["service_details_json"] = normalized["service_details_json"]
            update_data["scope_codes_json"] = normalized["scope_codes_json"]
            update_data["client_id"] = normalized["client_id"]
        for field, value in update_data.items():
            setattr(company, field, value)

        await db.commit()
        await db.refresh(company)
        return company

    async def approve(self, db: AsyncSession, company_id: int) -> dict:
        company = await self.get_by_id(db, company_id)
        company.approval_status = "Approved"
        await db.commit()
        await db.refresh(company)
        email_summary = await self._send_assignment_emails(db, company)
        return {
            "message": "Company work order approved.",
            "company_id": company.company_id,
            "approval_status": company.approval_status,
            "email_summary": email_summary,
        }

    async def set_status(self, db: AsyncSession, company_id: int, new_status: str) -> CompanyMaster:
        company = await self.get_by_id(db, company_id)
        company.status = new_status
        await db.commit()
        await db.refresh(company)
        return company

    async def delete(self, db: AsyncSession, company_id: int) -> dict:
        company = await self.get_by_id(db, company_id)
        company.is_deleted = "Y"  # soft delete
        await db.commit()
        return {"message": "Company deleted successfully."}

    async def get_assignable_users(self, db: AsyncSession) -> list[dict]:
        from app.models.user import UserMaster

        result = await db.execute(
            select(UserMaster)
            .where(
                UserMaster.is_deleted == "N",
                UserMaster.status == "Active",
                UserMaster.role_id.in_([1, 2, 3]),
            )
            .order_by(UserMaster.first_name, UserMaster.last_name)
        )
        return [
            {
                "user_id": user.user_id,
                "name": f"{user.first_name} {user.last_name or ''}".strip(),
                "email": user.email,
                "manager_id": user.manager_id,
            }
            for user in result.scalars().all()
        ]

    async def get_company_master_codes(self, db: AsyncSession) -> list[dict]:
        result = await db.execute(
            text(
                """
                SELECT id, category, name, code, description, is_active
                FROM posh_master_codes
                WHERE category IN ('State Code', 'City Code', 'Scope of Work ID', 'Deliverables')
                ORDER BY category, name
                """
            )
        )
        return [dict(row._mapping) for row in result]

    async def get_assigned_work_orders(self, db: AsyncSession, user_id: int) -> list[dict]:
        result = await db.execute(
            select(CompanyMaster)
            .where(
                CompanyMaster.is_deleted == "N",
                CompanyMaster.status == "Active",
            )
            .order_by(CompanyMaster.updated_date.desc())
        )
        assigned_rows = []
        for company in result.scalars().all():
            for row in self._json_list(company.service_details_json):
                if str(row.get("assigned_to") or "") != str(user_id):
                    continue
                assigned_rows.append(
                    {
                        "company_id": company.company_id,
                        "company_code": company.company_code,
                        "company_name": company.company_name,
                        "reference_no": company.reference_no,
                        "approval_status": company.approval_status or "Pending",
                        "client_id": row.get("client_id"),
                        "scope": row.get("scope"),
                        "deliverables": row.get("deliverables"),
                        "notes": row.get("notes"),
                        "start_date": row.get("start_date"),
                        "stop_date": row.get("stop_date"),
                        "frequency": row.get("frequency"),
                        "contact_name": company.contact_person,
                        "contact_email": company.contact_email,
                        "contact_number": company.contact_mobile,
                    }
                )
        return assigned_rows

    async def _normalize_service_details(self, db: AsyncSession, data_dict: dict) -> dict:
        rows = self._json_list(data_dict.get("service_details_json"))
        company_code = (data_dict.get("company_code") or "").strip().upper()
        year = datetime.now().strftime("%y")
        next_number = await self._next_client_sequence(db)
        normalized_rows = []
        scope_codes = []

        for row in rows:
            scope = (row.get("scope") or "").strip().upper()
            if not scope:
                continue
            if scope not in scope_codes:
                scope_codes.append(scope)
            if not row.get("client_id"):
                row["client_id"] = f"{company_code}/{scope}/{year}-{next_number}"
                next_number += 1
            normalized_rows.append(row)

        data_dict["service_details_json"] = json.dumps(normalized_rows)
        data_dict["scope_codes_json"] = json.dumps(scope_codes)
        data_dict["client_id"] = ", ".join(
            row["client_id"] for row in normalized_rows if row.get("client_id")
        )
        data_dict.setdefault("approval_status", "Pending")
        return data_dict

    def _json_list(self, value) -> list[dict]:
        if not value:
            return []
        if isinstance(value, list):
            return value
        try:
            parsed = json.loads(value)
        except (TypeError, json.JSONDecodeError):
            return []
        return parsed if isinstance(parsed, list) else []

    async def _next_client_sequence(self, db: AsyncSession) -> int:
        result = await db.execute(
            select(CompanyMaster.service_details_json).where(CompanyMaster.is_deleted == "N")
        )
        max_number = 0
        for value in result.scalars().all():
            for row in self._json_list(value):
                client_id = str(row.get("client_id") or "")
                match = re.search(r"-(\d+)$", client_id)
                if match:
                    max_number = max(max_number, int(match.group(1)))
        return max_number + 1

    async def _send_assignment_emails(self, db: AsyncSession, company: CompanyMaster) -> dict:
        from app.core.email import send_email
        from app.models.user import UserMaster
        from app.services.notification_service import notification_service

        rows = self._json_list(company.service_details_json)
        if not rows:
            return {"sent": 0, "failed": 0, "notifications": 0, "message": "No service rows found."}
        assigned_ids = {
            int(row["assigned_to"]) for row in rows if str(row.get("assigned_to") or "").isdigit()
        }
        if not assigned_ids:
            return {
                "sent": 0,
                "failed": 0,
                "notifications": 0,
                "message": "No assigned employees selected.",
            }
        result = await db.execute(
            select(UserMaster).where(
                UserMaster.user_id.in_(assigned_ids),
                UserMaster.is_deleted == "N",
                UserMaster.status == "Active",
            )
        )
        users = {user.user_id: user for user in result.scalars().all()}
        if not users:
            return {
                "sent": 0,
                "failed": 0,
                "notifications": 0,
                "message": "Assigned employees were not found or inactive.",
            }
        manager_ids = {user.manager_id for user in users.values() if user.manager_id}
        manager_result = (
            await db.execute(select(UserMaster).where(UserMaster.user_id.in_(manager_ids)))
            if manager_ids
            else None
        )
        managers = {
            user.user_id: user
            for user in (manager_result.scalars().all() if manager_result else [])
        }
        notifications_created = await notification_service.create_for_user_ids(
            db,
            user_ids=[*users.keys(), *managers.keys()],
            company_id=company.company_id,
            title="Work order approved",
            message=f"{company.company_name} work order has been approved and assigned.",
        )
        await db.commit()
        contact = {}
        try:
            contact = json.loads(company.coordinator_contact_json or "{}")
        except json.JSONDecodeError:
            contact = {}

        sent = 0
        failed = 0
        for user_id, user in users.items():
            assigned_rows = [row for row in rows if str(row.get("assigned_to")) == str(user_id)]
            manager = managers.get(user.manager_id)
            details = "".join(
                f"""
                <tr>
                    <td>{row.get('client_id', '')}</td>
                    <td>{row.get('deliverables') or row.get('scope', '')}</td>
                    <td>{row.get('notes', '')}</td>
                    <td>{row.get('start_date', '')}</td>
                    <td>{row.get('stop_date', '')}</td>
                    <td>{row.get('frequency', '')}</td>
                </tr>
                """
                for row in assigned_rows
            )
            html = f"""
            <div style="font-family: Arial, sans-serif;">
                <h2>Approved POSH Work Order Assignment</h2>
                <p><strong>Reference No:</strong> {company.reference_no or ''}</p>
                <p><strong>Company Name:</strong> {company.company_name}</p>
                <table border="1" cellspacing="0" cellpadding="6">
                    <thead>
                        <tr>
                            <th>Client ID</th>
                            <th>Deliverables</th>
                            <th>Notes</th>
                            <th>Start Date</th>
                            <th>Stop Date</th>
                            <th>Frequency</th>
                        </tr>
                    </thead>
                    <tbody>{details}</tbody>
                </table>
                <p><strong>Contact Name:</strong> {contact.get('name') or company.contact_person or ''}</p>
                <p><strong>Contact Email:</strong> {contact.get('email') or company.contact_email or ''}</p>
                <p><strong>Contact Number:</strong> {contact.get('contact_no') or company.contact_mobile or ''}</p>
            </div>
            """
            try:
                await send_email(
                    user.email,
                    f"Approved Work Order - {company.company_name}",
                    html,
                    cc=[manager.email] if manager and manager.email else None,
                )
                sent += 1
            except Exception:
                failed += 1
                logger.exception(
                    "Failed to send approved work-order email for company_id=%s user_id=%s email=%s",
                    company.company_id,
                    user.user_id,
                    user.email,
                )
        return {
            "sent": sent,
            "failed": failed,
            "notifications": notifications_created,
            "message": (
                "Emails sent."
                if sent and not failed
                else (
                    "Approval saved, but some emails failed. Check backend SMTP logs."
                    if failed
                    else "Approval saved, but no emails were sent."
                )
            ),
        }

    async def get_language_preferences(self, db: AsyncSession, company_id: int) -> list[dict]:
        await self.get_by_id(db, company_id)
        result = await db.execute(
            text(
                """
                SELECT
                    lm.language_id,
                    lm.language_name,
                    CASE WHEN cl.language_id IS NULL THEN 0 ELSE 1 END AS enabled,
                    COALESCE(cl.is_default, 0) AS is_default
                FROM language_master lm
                LEFT JOIN company_languages cl
                    ON cl.language_id = lm.language_id
                    AND cl.company_id = :company_id
                ORDER BY lm.language_id
                """
            ),
            {"company_id": company_id},
        )
        return [
            {
                "language_id": row.language_id,
                "language_name": row.language_name,
                "enabled": bool(row.enabled),
                "is_default": bool(row.is_default),
            }
            for row in result
        ]

    async def update_language_preferences(
        self,
        db: AsyncSession,
        company_id: int,
        language_ids: list[int],
        default_language_id: int | None = None,
    ) -> list[dict]:
        await self.get_by_id(db, company_id)
        unique_language_ids = sorted({int(language_id) for language_id in language_ids})
        if not unique_language_ids:
            raise HTTPException(400, "Select at least one language.")

        if default_language_id is None:
            default_language_id = unique_language_ids[0]
        if default_language_id not in unique_language_ids:
            raise HTTPException(400, "Default language must be selected.")

        valid_result = await db.execute(
            text(
                """
                SELECT language_id
                FROM language_master
                WHERE language_id IN :language_ids
                """
            ).bindparams(bindparam("language_ids", expanding=True)),
            {"language_ids": unique_language_ids},
        )
        valid_ids = {row.language_id for row in valid_result}
        if valid_ids != set(unique_language_ids):
            raise HTTPException(400, "One or more selected languages are invalid.")

        await db.execute(
            text("DELETE FROM company_languages WHERE company_id = :company_id"),
            {"company_id": company_id},
        )
        for language_id in unique_language_ids:
            await db.execute(
                text(
                    """
                    INSERT INTO company_languages (company_id, language_id, is_default)
                    VALUES (:company_id, :language_id, :is_default)
                    """
                ),
                {
                    "company_id": company_id,
                    "language_id": language_id,
                    "is_default": language_id == default_language_id,
                },
            )
        await db.commit()
        return await self.get_language_preferences(db, company_id)
