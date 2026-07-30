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
        result = await db.execute(
            select(CompanyMaster).where(
                CompanyMaster.is_deleted == "N",
                CompanyMaster.company_id != 1,
            )
        )
        return result.scalars().all()

    async def get_visible_for_user(self, db: AsyncSession, current_user) -> list:
        companies = await self.get_all(db)
        if current_user.role_id == 1:
            return companies
        return [
            company
            for company in companies
            if self._has_assigned_service(company, current_user.user_id)
        ]

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

    async def create(
        self, db: AsyncSession, data: CompanyCreate, current_user=None
    ) -> CompanyMaster:
        data_dict = data.model_dump()

        # Normalize company_code
        if "company_code" in data_dict and data_dict["company_code"]:
            data_dict["company_code"] = data_dict["company_code"].upper()
        data_dict = await self._normalize_service_details(db, data_dict)
        if current_user and current_user.role_id != 1:
            data_dict = self._mark_service_owner(data_dict, current_user.user_id)

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

    async def update(
        self,
        db: AsyncSession,
        company_id: int,
        data: CompanyUpdate,
        current_user=None,
    ) -> CompanyMaster:
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
            if current_user and current_user.role_id != 1:
                normalized = self._mark_service_owner(normalized, current_user.user_id)
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
        rows = self._json_list(company.service_details_json)
        if not rows or any(not row.get("assigned_to") for row in rows):
            raise HTTPException(
                400,
                "Assign every work-order service before approval.",
            )
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
        if company_id == 1:
            raise HTTPException(400, "The default platform company cannot be deleted.")
        company = await self.get_by_id(db, company_id)

        user_result = await db.execute(
            text("SELECT user_id FROM user_master WHERE company_id = :company_id"),
            {"company_id": company_id},
        )
        user_ids = [row.user_id for row in user_result]

        # Delete child records first so foreign-key constraints do not block company removal.
        await db.execute(
            text(
                """
                DELETE FROM assessment_option
                WHERE question_id IN (
                    SELECT question_id
                    FROM assessment_question
                    WHERE video_id IN (
                        SELECT video_id FROM video_master WHERE company_id = :company_id
                    )
                )
                """
            ),
            {"company_id": company_id},
        )
        for query in [
            """
            DELETE FROM assessment_question
            WHERE video_id IN (
                SELECT video_id FROM video_master WHERE company_id = :company_id
            )
            """,
            """
            DELETE FROM assessment_result
            WHERE video_id IN (
                SELECT video_id FROM video_master WHERE company_id = :company_id
            )
               OR user_id IN (
                SELECT user_id FROM user_master WHERE company_id = :company_id
            )
            """,
            "DELETE FROM certificates WHERE company_id = :company_id",
            "DELETE FROM certificate_template WHERE company_id = :company_id",
            "DELETE FROM training_history WHERE company_id = :company_id",
            "DELETE FROM course_assignment WHERE company_id = :company_id",
            "DELETE FROM video_language WHERE video_id IN (SELECT video_id FROM video_master WHERE company_id = :company_id)",
            "DELETE FROM video_quality WHERE company_id = :company_id",
            "DELETE FROM video_master WHERE company_id = :company_id",
            "DELETE FROM employee_upload_batch WHERE company_id = :company_id",
            "DELETE FROM concerns WHERE company_id = :company_id",
            "DELETE FROM notification WHERE company_id = :company_id",
            "DELETE FROM analytics_summary WHERE company_id = :company_id",
            "DELETE FROM posh_policy WHERE company_id = :company_id",
            "DELETE FROM posh_employee_master WHERE company_id = :company_id",
            "DELETE FROM company_languages WHERE company_id = :company_id",
            "DELETE FROM audit_logs WHERE company_id = :company_id",
        ]:
            await db.execute(text(query), {"company_id": company_id})

        if user_ids:
            await db.execute(
                text(
                    """
                    UPDATE user_master
                    SET manager_id = NULL
                    WHERE manager_id IN :user_ids
                    """
                ).bindparams(bindparam("user_ids", expanding=True)),
                {"user_ids": user_ids},
            )
            for query in [
                "DELETE FROM account_lockout WHERE user_id IN :user_ids",
                "DELETE FROM refresh_tokens WHERE user_id IN :user_ids",
                "DELETE FROM password_reset_tokens WHERE user_id IN :user_ids",
                "DELETE FROM login_attempts WHERE user_id IN :user_ids",
                "DELETE FROM audit_logs WHERE user_id IN :user_ids",
            ]:
                await db.execute(
                    text(query).bindparams(bindparam("user_ids", expanding=True)),
                    {"user_ids": user_ids},
                )

        await db.execute(
            text("DELETE FROM user_master WHERE company_id = :company_id"),
            {"company_id": company_id},
        )
        await db.execute(
            text("DELETE FROM company_master WHERE company_id = :company_id"),
            {"company_id": company_id},
        )
        await db.commit()
        return {
            "message": "Company and all related records deleted successfully.",
            "company_id": company.company_id,
            "company_name": company.company_name,
        }

    async def get_assignable_users(self, db: AsyncSession, current_user) -> list[dict]:
        from app.models.user import UserMaster

        role_labels = {
            1: "Super Admin",
            2: "Company Admin",
            5: "Client Admin (Mgmt)",
            3: "HR",
            4: "Employee",
        }
        assignable_roles = {
            1: [1, 2, 5, 3, 4],
            2: [5, 3, 4],
            5: [3, 4],
            3: [4],
        }.get(current_user.role_id, [])
        if not assignable_roles:
            return []

        filters = [
            UserMaster.is_deleted == "N",
            UserMaster.status == "Active",
            UserMaster.role_id.in_(assignable_roles),
        ]
        if current_user.role_id != 1:
            filters.append(UserMaster.company_id == current_user.company_id)

        result = await db.execute(
            select(UserMaster).where(*filters).order_by(UserMaster.first_name, UserMaster.last_name)
        )
        return [
            {
                "user_id": user.user_id,
                "name": f"{user.first_name} {user.last_name or ''}".strip(),
                "email": user.email,
                "mobile": user.mobile,
                "designation": user.designation,
                "employee_id": user.employee_id,
                "manager_id": user.manager_id,
                "role_id": user.role_id,
                "role_label": role_labels.get(user.role_id, "User"),
            }
            for user in result.scalars().all()
        ]

    async def get_employee_master_records(
        self,
        db: AsyncSession,
        current_user,
        company_id: int | None = None,
    ) -> list[dict]:
        if company_id is not None:
            await self.ensure_registration_access(db, company_id, current_user)
            company_ids = [company_id]
        else:
            companies = await self.get_registration_candidates(db, current_user)
            company_ids = [company.company_id for company in companies]
        if not company_ids:
            return []
        result = await db.execute(
            text(
                """
                SELECT *
                FROM posh_employee_master
                WHERE company_id IN :company_ids
                ORDER BY company_id, first_name, last_name
                """
            ).bindparams(bindparam("company_ids", expanding=True)),
            {"company_ids": company_ids},
        )
        return [dict(row._mapping) for row in result]

    async def create_employee_master_record(
        self,
        db: AsyncSession,
        data,
        current_user,
    ) -> dict:
        await self.ensure_registration_access(db, data.company_id, current_user)
        payload = data.model_dump()
        existing = await db.execute(
            text(
                """
                SELECT id
                FROM posh_employee_master
                WHERE company_id = :company_id
                  AND (employee_id = :employee_id OR email = :email)
                LIMIT 1
                """
            ),
            {
                "company_id": payload["company_id"],
                "employee_id": payload["employee_id"],
                "email": payload["email"],
            },
        )
        if existing.first():
            raise HTTPException(400, "Employee ID or email already exists for this company.")
        insert_result = await db.execute(
            text(
                """
                INSERT INTO posh_employee_master (
                    company_id, employee_id, first_name, last_name, email, mobile,
                    date_of_birth, father_name, emergency_contact, gender, blood_group,
                    physically_challenged, marital_status, pan_number, foreign_national,
                    joining_date, designation, department, location_city, employment_status,
                    employee_status, resignation_date, resignation_reason, reporting_to,
                    branch_name, branch_id, transfer_date, transfer_location,
                    transfer_branch_name, transfer_branch_id, ic_role, status
                )
                VALUES (
                    :company_id, :employee_id, :first_name, :last_name, :email, :mobile,
                    :date_of_birth, :father_name, :emergency_contact, :gender, :blood_group,
                    :physically_challenged, :marital_status, :pan_number, :foreign_national,
                    :joining_date, :designation, :department, :location_city, :employment_status,
                    :employee_status, :resignation_date, :resignation_reason, :reporting_to,
                    :branch_name, :branch_id, :transfer_date, :transfer_location,
                    :transfer_branch_name, :transfer_branch_id, :ic_role, 'Active'
                )
                """
            ),
            payload,
        )
        await db.commit()
        result = await db.execute(
            text("SELECT * FROM posh_employee_master WHERE id = :id"),
            {"id": insert_result.lastrowid},
        )
        return dict(result.first()._mapping)

    async def update_employee_master_record(
        self,
        db: AsyncSession,
        employee_master_id: int,
        data,
        current_user,
    ) -> dict:
        current_result = await db.execute(
            text("SELECT * FROM posh_employee_master WHERE id = :id"),
            {"id": employee_master_id},
        )
        current_record = current_result.first()
        if not current_record:
            raise HTTPException(404, "Employee master record not found.")

        await self.ensure_registration_access(db, current_record.company_id, current_user)
        payload = data.model_dump()
        await self.ensure_registration_access(db, payload["company_id"], current_user)
        duplicate = await db.execute(
            text(
                """
                SELECT id
                FROM posh_employee_master
                WHERE company_id = :company_id
                  AND id <> :id
                  AND (employee_id = :employee_id OR email = :email)
                LIMIT 1
                """
            ),
            {
                "id": employee_master_id,
                "company_id": payload["company_id"],
                "employee_id": payload["employee_id"],
                "email": payload["email"],
            },
        )
        if duplicate.first():
            raise HTTPException(400, "Employee ID or email already exists for this company.")

        payload["id"] = employee_master_id
        await db.execute(
            text(
                """
                UPDATE posh_employee_master
                SET
                    company_id = :company_id,
                    employee_id = :employee_id,
                    first_name = :first_name,
                    last_name = :last_name,
                    email = :email,
                    mobile = :mobile,
                    date_of_birth = :date_of_birth,
                    father_name = :father_name,
                    emergency_contact = :emergency_contact,
                    gender = :gender,
                    blood_group = :blood_group,
                    physically_challenged = :physically_challenged,
                    marital_status = :marital_status,
                    pan_number = :pan_number,
                    foreign_national = :foreign_national,
                    joining_date = :joining_date,
                    designation = :designation,
                    department = :department,
                    location_city = :location_city,
                    employment_status = :employment_status,
                    employee_status = :employee_status,
                    resignation_date = :resignation_date,
                    resignation_reason = :resignation_reason,
                    reporting_to = :reporting_to,
                    branch_name = :branch_name,
                    branch_id = :branch_id,
                    transfer_date = :transfer_date,
                    transfer_location = :transfer_location,
                    transfer_branch_name = :transfer_branch_name,
                    transfer_branch_id = :transfer_branch_id,
                    ic_role = :ic_role
                WHERE id = :id
                """
            ),
            payload,
        )
        await db.commit()
        result = await db.execute(
            text("SELECT * FROM posh_employee_master WHERE id = :id"),
            {"id": employee_master_id},
        )
        return dict(result.first()._mapping)

    async def delete_employee_master_record(
        self,
        db: AsyncSession,
        employee_master_id: int,
        current_user,
    ) -> dict:
        result = await db.execute(
            text(
                """
                SELECT id, company_id, employee_id, first_name, last_name
                FROM posh_employee_master
                WHERE id = :id
                """
            ),
            {"id": employee_master_id},
        )
        employee = result.first()
        if not employee:
            raise HTTPException(404, "Employee master record not found.")

        await self.ensure_registration_access(db, employee.company_id, current_user)
        await db.execute(
            text("DELETE FROM posh_employee_master WHERE id = :id"),
            {"id": employee_master_id},
        )
        await db.commit()
        employee_name = f"{employee.first_name} {employee.last_name or ''}".strip()
        return {
            "message": "Employee master record deleted successfully.",
            "employee_master_id": employee_master_id,
            "employee_id": employee.employee_id,
            "employee_name": employee_name,
        }

    async def set_employee_master_status(
        self,
        db: AsyncSession,
        employee_master_id: int,
        new_status: str,
        current_user,
    ) -> dict:
        if new_status not in ["Active", "Inactive"]:
            raise HTTPException(400, "Status must be 'Active' or 'Inactive'.")
        result = await db.execute(
            text(
                """
                SELECT id, company_id, employee_id, first_name, last_name
                FROM posh_employee_master
                WHERE id = :id
                """
            ),
            {"id": employee_master_id},
        )
        employee = result.first()
        if not employee:
            raise HTTPException(404, "Employee master record not found.")

        await self.ensure_registration_access(db, employee.company_id, current_user)
        await db.execute(
            text("UPDATE posh_employee_master SET status = :status WHERE id = :id"),
            {"status": new_status, "id": employee_master_id},
        )
        await db.commit()
        employee_name = f"{employee.first_name} {employee.last_name or ''}".strip()
        return {
            "message": "Employee master status updated successfully.",
            "employee_master_id": employee_master_id,
            "employee_id": employee.employee_id,
            "employee_name": employee_name,
            "status": new_status,
        }

    async def get_company_master_codes(self, db: AsyncSession) -> list[dict]:
        result = await db.execute(
            text(
                """
                SELECT id, category, name, code, description, is_active
                FROM posh_master_codes
                WHERE category IN ('Country Code', 'State Code', 'City Code', 'Scope of Work ID', 'Deliverables')
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

    async def get_registration_candidates(
        self,
        db: AsyncSession,
        current_user,
    ) -> list[CompanyMaster]:
        result = await db.execute(
            select(CompanyMaster)
            .where(
                CompanyMaster.is_deleted == "N",
                CompanyMaster.company_id != 1,
                CompanyMaster.status == "Active",
                CompanyMaster.approval_status == "Approved",
            )
            .order_by(CompanyMaster.updated_date.desc())
        )
        companies = result.scalars().all()
        if current_user.role_id == 1:
            return companies
        return [
            company
            for company in companies
            if self._has_assigned_service(company, current_user.user_id)
        ]

    async def update_registration(
        self,
        db: AsyncSession,
        company_id: int,
        data: CompanyUpdate,
        current_user,
    ) -> CompanyMaster:
        await self.ensure_registration_access(db, company_id, current_user)
        return await self.update(db, company_id, data)

    async def ensure_registration_access(
        self,
        db: AsyncSession,
        company_id: int,
        current_user,
    ) -> CompanyMaster:
        company = await self.get_by_id(db, company_id)
        if company.approval_status != "Approved":
            raise HTTPException(400, "Only approved work-order companies can be registered.")
        if current_user.role_id != 1 and not self._has_assigned_service(
            company, current_user.user_id
        ):
            raise HTTPException(403, "You do not have permission to register this company.")
        return company

    async def can_access_work_order(self, db: AsyncSession, company_id: int, current_user) -> bool:
        company = await self.get_by_id(db, company_id)
        return self._has_assigned_service(company, current_user.user_id)

    def _has_assigned_service(self, company: CompanyMaster, user_id: int) -> bool:
        return any(
            str(row.get("assigned_to") or "") == str(user_id)
            or str(row.get("created_by") or "") == str(user_id)
            for row in self._json_list(company.service_details_json)
        )

    def _mark_service_owner(self, data_dict: dict, user_id: int) -> dict:
        rows = self._json_list(data_dict.get("service_details_json"))
        for row in rows:
            row.setdefault("created_by", str(user_id))
        data_dict["service_details_json"] = json.dumps(rows)
        return data_dict

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
