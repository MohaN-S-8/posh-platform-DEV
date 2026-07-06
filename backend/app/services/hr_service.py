import io
from datetime import datetime, timedelta, timezone
from typing import Optional

import pandas as pd
from fastapi import HTTPException, UploadFile, status
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models.certificate import Certificate
from app.models.company import CompanyMaster
from app.models.hr import EmployeeUploadBatch
from app.models.notification import Notification
from app.models.training import CourseAssignment, TrainingHistory
from app.models.user import UserMaster
from app.models.video import VideoMaster
from app.schemas.hr import TrainingAssignRequest

REQUIRED_COLUMNS = {"employee_id", "first_name", "email", "mobile"}


class HRService:
    async def list_assignable_employees(self, db: AsyncSession, company_id: int) -> dict:
        result = await db.execute(
            select(UserMaster)
            .where(
                UserMaster.company_id == company_id,
                UserMaster.role_id == 4,
                UserMaster.status == "Active",
                UserMaster.is_deleted == "N",
            )
            .order_by(UserMaster.first_name, UserMaster.last_name)
        )
        employees = result.scalars().all()
        departments = sorted({employee.department for employee in employees if employee.department})
        return {
            "employees": [
                {
                    "user_id": employee.user_id,
                    "employee_id": employee.employee_id,
                    "first_name": employee.first_name,
                    "last_name": employee.last_name,
                    "email": employee.email,
                    "department": employee.department,
                    "designation": employee.designation,
                }
                for employee in employees
            ],
            "departments": departments,
        }

    async def bulk_upload_employees(
        self,
        db: AsyncSession,
        file: UploadFile,
        company_id: int,
        uploaded_by: int,
    ) -> dict:
        """
        Parse Excel/CSV, validate every row, create users for valid rows,
        return a detailed error report for invalid rows.
        """

        # 1. Read file into pandas DataFrame
        file_bytes = await file.read()
        filename = file.filename or "upload.xlsx"

        try:
            if filename.endswith(".csv"):
                df = pd.read_csv(io.BytesIO(file_bytes))
            elif filename.endswith((".xlsx", ".xls")):
                df = pd.read_excel(io.BytesIO(file_bytes))
            else:
                raise HTTPException(
                    status_code=400,
                    detail="Unsupported file type. Please upload .xlsx or .csv",
                )
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Could not read file: {str(e)}")

        # 2. Normalize column names (lowercase, strip spaces)
        df.columns = [str(c).lower().strip() for c in df.columns]

        # 3. Check required columns exist
        missing = REQUIRED_COLUMNS - set(df.columns)
        if missing:
            raise HTTPException(
                status_code=400,
                detail=f"Missing required columns: {', '.join(missing)}. "
                f"Required: employee_id, first_name, email, mobile",
            )

        # 4. Create batch record
        batch = EmployeeUploadBatch(
            company_id=company_id,
            uploaded_by=uploaded_by,
            file_name=filename,
            total_rows=len(df),
            status="Processing",
        )
        db.add(batch)
        await db.flush()

        # 5. Process each row
        success_rows = 0
        errors = []

        for index, row in df.iterrows():
            row_num = index + 2  # +2 because Excel rows start at 1, row 1 is header
            row_errors = []

            # Extract values (strip whitespace, convert to string safely)
            employee_id = str(row.get("employee_id", "")).strip()
            first_name = str(row.get("first_name", "")).strip()
            last_name = str(row.get("last_name", "")).strip()
            email = str(row.get("email", "")).strip().lower()
            mobile = str(row.get("mobile", "")).strip()
            department = str(row.get("department", "")).strip()
            designation = str(row.get("designation", "")).strip()

            try:
                role_id = int(row.get("role_id", 4))
            except (ValueError, TypeError):
                role_id = 4  # default to Employee

            # ── Validate each field ────────────────────────────────────────
            if not employee_id:
                row_errors.append("employee_id is required")

            if not first_name:
                row_errors.append("first_name is required")

            if not email or "@" not in email:
                row_errors.append("valid email is required")

            if not mobile.isdigit() or len(mobile) != 10:
                row_errors.append("mobile must be exactly 10 digits")

            if role_id != 4:
                row_errors.append("bulk employee upload can only create Employee users")

            # ── CSV injection defense ──────────────────────────────────────
            # Prefix cells starting with =, +, -, @ with apostrophe
            # These are formula injection characters in Excel/Google Sheets
            for dangerous_prefix in ["=", "+", "-", "@"]:
                if first_name.startswith(dangerous_prefix):
                    first_name = "'" + first_name
                if last_name.startswith(dangerous_prefix):
                    last_name = "'" + last_name

            if row_errors:
                errors.append({"row": row_num, "email": email, "errors": row_errors})
                continue

            # ── Check duplicate email ──────────────────────────────────────
            existing = await db.execute(select(UserMaster).where(UserMaster.email == email))
            if existing.scalar_one_or_none():
                errors.append(
                    {
                        "row": row_num,
                        "email": email,
                        "errors": ["Email already registered — skipped"],
                    }
                )
                continue

            # ── Create user ────────────────────────────────────────────────
            user = UserMaster(
                company_id=company_id,
                employee_id=employee_id,
                first_name=first_name,
                last_name=last_name or None,
                email=email,
                mobile=mobile,
                department=department or None,
                designation=designation or None,
                role_id=role_id,
                username=email,
                password_hash=hash_password("Temp@1234"),  # temporary password
                status="Active",
            )
            db.add(user)
            success_rows += 1

        # 6. Update batch record
        batch.success_rows = success_rows
        batch.failed_rows = len(errors)
        batch.status = "Completed"

        await db.commit()

        return {
            "batch_id": batch.batch_id,
            "total_rows": len(df),
            "success_rows": success_rows,
            "failed_rows": len(errors),
            "errors": errors,
            "message": f"Upload complete. {success_rows} employees created, {len(errors)} rows failed.",
        }

    async def assign_training(
        self,
        db: AsyncSession,
        data: TrainingAssignRequest,
        company_id: int,
        assigned_by: int,
    ) -> dict:
        """Assign a video course to individual / department / entire company."""

        due_date = datetime.now(timezone.utc) + timedelta(days=data.due_days)
        video_result = await db.execute(
            select(VideoMaster).where(
                VideoMaster.video_id == data.video_id,
                VideoMaster.company_id == company_id,
                VideoMaster.status == "Published",
            )
        )
        if not video_result.scalar_one_or_none():
            raise HTTPException(404, "Published video not found for this company.")

        if data.assign_type == "Individual":
            if not data.assigned_to_user_id:
                raise HTTPException(400, "assigned_to_user_id required for Individual assignment")

            target_result = await db.execute(
                select(UserMaster).where(
                    UserMaster.user_id == data.assigned_to_user_id,
                    UserMaster.company_id == company_id,
                    UserMaster.status == "Active",
                    UserMaster.is_deleted == "N",
                )
            )
            if not target_result.scalar_one_or_none():
                raise HTTPException(404, "Employee not found for this company.")

            # Check already assigned
            existing = await db.execute(
                select(CourseAssignment).where(
                    CourseAssignment.video_id == data.video_id,
                    CourseAssignment.company_id == company_id,
                    CourseAssignment.assigned_to_user_id == data.assigned_to_user_id,
                    CourseAssignment.assign_type == "Individual",
                )
            )
            if existing.scalar_one_or_none():
                raise HTTPException(400, "This course is already assigned to this employee.")

            assignment = CourseAssignment(
                video_id=data.video_id,
                assigned_by=assigned_by,
                company_id=company_id,
                assigned_to_user_id=data.assigned_to_user_id,
                assign_type="Individual",
                due_date=due_date,
                passing_score=data.passing_score,
            )
            db.add(assignment)
            await db.commit()
            return {
                "message": "Course assigned to employee successfully.",
                "assignments_created": 1,
            }

        elif data.assign_type == "Department":
            if not data.assigned_to_department:
                raise HTTPException(
                    400, "assigned_to_department required for Department assignment"
                )

            department_result = await db.execute(
                select(func.count()).where(
                    UserMaster.company_id == company_id,
                    UserMaster.department == data.assigned_to_department,
                    UserMaster.status == "Active",
                    UserMaster.is_deleted == "N",
                )
            )
            if (department_result.scalar() or 0) == 0:
                raise HTTPException(404, "Department not found for this company.")

            existing = await db.execute(
                select(CourseAssignment).where(
                    CourseAssignment.video_id == data.video_id,
                    CourseAssignment.company_id == company_id,
                    CourseAssignment.assigned_to_department == data.assigned_to_department,
                    CourseAssignment.assign_type == "Department",
                )
            )
            if existing.scalar_one_or_none():
                raise HTTPException(400, "This course is already assigned to this department.")

            assignment = CourseAssignment(
                video_id=data.video_id,
                assigned_by=assigned_by,
                company_id=company_id,
                assigned_to_department=data.assigned_to_department,
                assign_type="Department",
                due_date=due_date,
                passing_score=data.passing_score,
            )
            db.add(assignment)
            await db.commit()
            return {
                "message": f"Course assigned to {data.assigned_to_department} department.",
                "assignments_created": 1,
            }

        elif data.assign_type == "Company-Wide":
            existing = await db.execute(
                select(CourseAssignment).where(
                    CourseAssignment.video_id == data.video_id,
                    CourseAssignment.company_id == company_id,
                    CourseAssignment.assign_type == "Company-Wide",
                )
            )
            if existing.scalar_one_or_none():
                raise HTTPException(400, "This course is already assigned company-wide.")

            assignment = CourseAssignment(
                video_id=data.video_id,
                assigned_by=assigned_by,
                company_id=company_id,
                assign_type="Company-Wide",
                due_date=due_date,
                passing_score=data.passing_score,
            )
            db.add(assignment)
            await db.commit()
            return {
                "message": "Course assigned to all employees company-wide.",
                "assignments_created": 1,
            }

        else:
            raise HTTPException(400, "assign_type must be Individual, Department, or Company-Wide")

    async def get_compliance_dashboard(self, db: AsyncSession, company_id: int) -> dict:
        """Compliance overview: how many employees completed training."""

        # Total active employees
        total_result = await db.execute(
            select(func.count()).where(
                UserMaster.company_id == company_id,
                UserMaster.status == "Active",
                UserMaster.is_deleted == "N",
                UserMaster.role_id == 4,  # Employee role only
            )
        )
        total = total_result.scalar() or 0

        # Completed
        completed_result = await db.execute(
            select(func.count(TrainingHistory.user_id.distinct())).where(
                TrainingHistory.company_id == company_id,
                TrainingHistory.status == "Completed",
            )
        )
        completed = completed_result.scalar() or 0

        # In Progress
        in_progress_result = await db.execute(
            select(func.count(TrainingHistory.user_id.distinct())).where(
                TrainingHistory.company_id == company_id,
                TrainingHistory.status == "In Progress",
            )
        )
        in_progress = in_progress_result.scalar() or 0

        not_started = max(0, total - completed - in_progress)
        compliance_rate = round((completed / total * 100), 2) if total > 0 else 0.0

        # Department breakdown
        dept_result = await db.execute(
            select(
                UserMaster.department,
                func.count(UserMaster.user_id).label("total"),
            )
            .where(
                UserMaster.company_id == company_id,
                UserMaster.status == "Active",
                UserMaster.role_id == 4,
            )
            .group_by(UserMaster.department)
        )
        departments = []
        for row in dept_result:
            department_name = row.department or "Unassigned"
            completed_dept_result = await db.execute(
                select(func.count(UserMaster.user_id.distinct()))
                .join(
                    TrainingHistory,
                    and_(
                        TrainingHistory.user_id == UserMaster.user_id,
                        TrainingHistory.company_id == company_id,
                        TrainingHistory.status == "Completed",
                    ),
                )
                .where(
                    UserMaster.company_id == company_id,
                    UserMaster.status == "Active",
                    UserMaster.role_id == 4,
                    UserMaster.is_deleted == "N",
                    UserMaster.department == row.department,
                )
            )
            department_completed = completed_dept_result.scalar() or 0
            department_rate = (
                round((department_completed / row.total * 100), 2) if row.total else 0.0
            )
            departments.append(
                {
                    "department": department_name,
                    "total": row.total,
                    "completed": department_completed,
                    "pending": max(0, row.total - department_completed),
                    "compliance_rate": department_rate,
                }
            )

        # Overdue employees (assigned but not completed past due date)
        now = datetime.now(timezone.utc)
        overdue_result = await db.execute(
            select(UserMaster.first_name, UserMaster.email, CourseAssignment.due_date)
            .join(
                CourseAssignment,
                and_(
                    or_(
                        CourseAssignment.assigned_to_user_id == UserMaster.user_id,
                        and_(
                            CourseAssignment.assigned_to_department == UserMaster.department,
                            CourseAssignment.assign_type == "Department",
                        ),
                        CourseAssignment.assign_type == "Company-Wide",
                    ),
                    CourseAssignment.company_id == company_id,
                ),
            )
            .where(
                UserMaster.company_id == company_id,
                CourseAssignment.due_date < now,
            )
            .limit(50)
        )
        overdue = [
            {
                "name": f"{row.first_name}",
                "email": row.email,
                "due_date": str(row.due_date),
            }
            for row in overdue_result
        ]

        return {
            "total_employees": total,
            "completed": completed,
            "in_progress": in_progress,
            "not_started": not_started,
            "compliance_rate": compliance_rate,
            "department_breakdown": departments,
            "overdue_employees": overdue,
        }

    async def generate_employee_report(self, db: AsyncSession, company_id: int) -> bytes:
        """Generate an Excel report of employee training status."""

        result = await db.execute(
            select(
                UserMaster.employee_id,
                UserMaster.first_name,
                UserMaster.last_name,
                UserMaster.email,
                UserMaster.department,
                TrainingHistory.status,
                TrainingHistory.completion_percent,
                TrainingHistory.completed_at,
            )
            .outerjoin(TrainingHistory, TrainingHistory.user_id == UserMaster.user_id)
            .where(
                UserMaster.company_id == company_id,
                UserMaster.is_deleted == "N",
            )
        )
        rows = result.all()

        # Build DataFrame
        data = [
            {
                "Employee ID": row.employee_id,
                "First Name": row.first_name,
                "Last Name": row.last_name or "",
                "Email": row.email,
                "Department": row.department or "",
                "Training Status": row.status or "Not Started",
                "Completion %": float(row.completion_percent or 0),
                "Completed Date": str(row.completed_at or ""),
            }
            for row in rows
        ]

        df = pd.DataFrame(data)

        # Write to Excel in memory
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine="openpyxl") as writer:
            df.to_excel(writer, index=False, sheet_name="Employee Training Report")

            # Auto-fit column widths
            worksheet = writer.sheets["Employee Training Report"]
            for col in worksheet.columns:
                max_length = max(len(str(cell.value or "")) for cell in col)
                worksheet.column_dimensions[col[0].column_letter].width = min(max_length + 2, 50)

        output.seek(0)
        return output.read()

    async def generate_department_report(self, db: AsyncSession, company_id: int) -> bytes:
        """Generate an Excel report with department-level compliance."""

        dashboard = await self.get_compliance_dashboard(db, company_id)
        df = pd.DataFrame(
            [
                {
                    "Department": row["department"],
                    "Total Employees": row["total"],
                    "Completed": row["completed"],
                    "Pending": row["pending"],
                    "Compliance %": row["compliance_rate"],
                }
                for row in dashboard["department_breakdown"]
            ]
        )

        output = io.BytesIO()
        with pd.ExcelWriter(output, engine="openpyxl") as writer:
            df.to_excel(writer, index=False, sheet_name="Department Compliance")
            worksheet = writer.sheets["Department Compliance"]
            for col in worksheet.columns:
                max_length = max(len(str(cell.value or "")) for cell in col)
                worksheet.column_dimensions[col[0].column_letter].width = min(max_length + 2, 50)

        output.seek(0)
        return output.read()

    async def generate_certificate_report(self, db: AsyncSession, company_id: int) -> bytes:
        """Generate an Excel report of issued certificates."""

        result = await db.execute(
            select(
                Certificate.certificate_number,
                Certificate.course_name,
                Certificate.issue_date,
                Certificate.completion_date,
                Certificate.status,
                UserMaster.employee_id,
                UserMaster.first_name,
                UserMaster.last_name,
                UserMaster.email,
                UserMaster.department,
            )
            .join(UserMaster, UserMaster.user_id == Certificate.user_id)
            .where(Certificate.company_id == company_id)
            .order_by(Certificate.issue_date.desc(), Certificate.certificate_id.desc())
        )
        rows = result.all()
        data = [
            {
                "Certificate Number": row.certificate_number,
                "Employee ID": row.employee_id,
                "Employee Name": f"{row.first_name} {row.last_name or ''}".strip(),
                "Email": row.email,
                "Department": row.department or "",
                "Course": row.course_name,
                "Completion Date": str(row.completion_date or ""),
                "Issue Date": str(row.issue_date or ""),
                "Status": row.status,
            }
            for row in rows
        ]

        output = io.BytesIO()
        with pd.ExcelWriter(output, engine="openpyxl") as writer:
            pd.DataFrame(data).to_excel(writer, index=False, sheet_name="Certificates")
            worksheet = writer.sheets["Certificates"]
            for col in worksheet.columns:
                max_length = max(len(str(cell.value or "")) for cell in col)
                worksheet.column_dimensions[col[0].column_letter].width = min(max_length + 2, 50)

        output.seek(0)
        return output.read()

    def _dataframe_to_csv(self, df: pd.DataFrame) -> bytes:
        output = io.StringIO()
        df.to_csv(output, index=False)
        return output.getvalue().encode("utf-8")

    def _dataframe_to_pdf(self, df: pd.DataFrame, title: str) -> bytes:
        output = io.BytesIO()
        doc = SimpleDocTemplate(
            output,
            pagesize=landscape(A4),
            rightMargin=24,
            leftMargin=24,
            topMargin=24,
            bottomMargin=24,
        )
        styles = getSampleStyleSheet()
        story = [Paragraph(title, styles["Title"]), Spacer(1, 12)]

        rows = [list(df.columns)] + df.fillna("").astype(str).values.tolist()
        table = Table(rows, repeatRows=1)
        table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#17324d")),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                    ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#d8e1ea")),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, -1), 8),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    (
                        "ROWBACKGROUNDS",
                        (0, 1),
                        (-1, -1),
                        [colors.white, colors.HexColor("#f6f8fa")],
                    ),
                ]
            )
        )
        story.append(table)
        doc.build(story)
        output.seek(0)
        return output.read()

    async def _read_excel_report(self, report_bytes: bytes) -> pd.DataFrame:
        return pd.read_excel(io.BytesIO(report_bytes))

    async def generate_employee_report_csv(self, db: AsyncSession, company_id: int) -> bytes:
        df = await self._read_excel_report(await self.generate_employee_report(db, company_id))
        return self._dataframe_to_csv(df)

    async def generate_department_report_csv(self, db: AsyncSession, company_id: int) -> bytes:
        df = await self._read_excel_report(await self.generate_department_report(db, company_id))
        return self._dataframe_to_csv(df)

    async def generate_certificate_report_csv(self, db: AsyncSession, company_id: int) -> bytes:
        df = await self._read_excel_report(await self.generate_certificate_report(db, company_id))
        return self._dataframe_to_csv(df)

    async def generate_employee_report_pdf(self, db: AsyncSession, company_id: int) -> bytes:
        df = await self._read_excel_report(await self.generate_employee_report(db, company_id))
        return self._dataframe_to_pdf(df, "Employee Training Report")

    async def generate_department_report_pdf(self, db: AsyncSession, company_id: int) -> bytes:
        df = await self._read_excel_report(await self.generate_department_report(db, company_id))
        return self._dataframe_to_pdf(df, "Department Compliance Report")

    async def generate_certificate_report_pdf(self, db: AsyncSession, company_id: int) -> bytes:
        df = await self._read_excel_report(await self.generate_certificate_report(db, company_id))
        return self._dataframe_to_pdf(df, "Certificate Report")

    async def create_training_reminders(
        self,
        db: AsyncSession,
        company_id: int,
        created_by: int,
    ) -> dict:
        """Create notifications for due or overdue assigned courses."""
        now = datetime.now(timezone.utc)
        reminder_until = now + timedelta(days=7)
        result = await db.execute(
            select(
                UserMaster.user_id,
                UserMaster.first_name,
                UserMaster.email,
                VideoMaster.title,
                CourseAssignment.due_date,
            )
            .join(
                CourseAssignment,
                and_(
                    CourseAssignment.company_id == company_id,
                    or_(
                        CourseAssignment.assigned_to_user_id == UserMaster.user_id,
                        and_(
                            CourseAssignment.assign_type == "Department",
                            CourseAssignment.assigned_to_department == UserMaster.department,
                        ),
                        CourseAssignment.assign_type == "Company-Wide",
                    ),
                ),
            )
            .join(VideoMaster, VideoMaster.video_id == CourseAssignment.video_id)
            .outerjoin(
                TrainingHistory,
                and_(
                    TrainingHistory.user_id == UserMaster.user_id,
                    TrainingHistory.video_id == CourseAssignment.video_id,
                    TrainingHistory.company_id == company_id,
                    TrainingHistory.status == "Completed",
                ),
            )
            .where(
                UserMaster.company_id == company_id,
                UserMaster.status == "Active",
                UserMaster.is_deleted == "N",
                UserMaster.role_id == 4,
                CourseAssignment.due_date <= reminder_until,
                TrainingHistory.id.is_(None),
            )
            .distinct()
        )

        created = 0
        skipped = 0
        for row in result:
            due_text = row.due_date.strftime("%Y-%m-%d") if row.due_date else "soon"
            title = "Training reminder"
            message = f"{row.title} is due by {due_text}. Please complete your POSH training."
            existing = await db.execute(
                select(Notification.id).where(
                    Notification.user_id == row.user_id,
                    Notification.company_id == company_id,
                    Notification.title == title,
                    Notification.message == message,
                )
            )
            if existing.scalar_one_or_none():
                skipped += 1
                continue

            db.add(
                Notification(
                    user_id=row.user_id,
                    company_id=company_id,
                    title=title,
                    message=message,
                )
            )
            created += 1

        await db.commit()
        return {
            "message": f"{created} reminders created.",
            "created": created,
            "skipped_existing": skipped,
            "triggered_by": created_by,
        }
