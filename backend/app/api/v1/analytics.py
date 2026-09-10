import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import case, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import require_permission, require_roles
from app.db.session import get_db
from app.models.annual_return import AnnualReturn
from app.models.certificate import Certificate, CertificateTemplate
from app.models.company import CompanyMaster
from app.models.concern import Concern
from app.models.training import AssessmentResult, CourseAssignment, TrainingHistory
from app.models.user import UserMaster
from app.models.video import VideoMaster

router = APIRouter(prefix="/analytics", tags=["Analytics"])


ROLE_NAMES = {
    1: "Super Admin",
    2: "Admin",
    5: "Client / Management",
    3: "IC Member",
    4: "Employee",
}


def _service_codes(scope_codes_json: str | None) -> list[str]:
    try:
        scopes = json.loads(scope_codes_json or "[]")
    except json.JSONDecodeError:
        scopes = []
    if not isinstance(scopes, list):
        scopes = []
    return [
        str(scope or "Unassigned").strip().upper() or "Unassigned"
        for scope in scopes
        if str(scope or "").strip().upper() == "POSH"
    ]


def _service_summary(service_details_json: str | None) -> dict:
    try:
        rows = json.loads(service_details_json or "[]")
    except json.JSONDecodeError:
        rows = []
    if not isinstance(rows, list):
        rows = []
    posh_rows = [
        row
        for row in rows
        if isinstance(row, dict) and str(row.get("scope") or "").strip().upper() == "POSH"
    ]
    row = posh_rows[0] if posh_rows else (rows[0] if rows and isinstance(rows[0], dict) else {})
    return {
        "client_id": row.get("client_id") or "",
        "frequency": row.get("frequency") or "",
        "billing": row.get("billing_amount") or "",
        "start_date": row.get("start_date") or "",
        "stop_date": row.get("stop_date") or "",
        "assigned_to_name": row.get("assigned_to_name") or "",
        "deliverables": [
            item.get("deliverables") or item.get("scope") or "PoSH Compliance" for item in posh_rows
        ]
        or [row.get("deliverables") or "PoSH Compliance"],
    }


async def _annual_status_by_company(
    db: AsyncSession, company_ids: list[int] | None = None
) -> dict[int, str]:
    query = select(AnnualReturn.company_id, AnnualReturn.status, func.count()).group_by(
        AnnualReturn.company_id,
        AnnualReturn.status,
    )
    if company_ids is not None:
        query = query.where(AnnualReturn.company_id.in_(company_ids))
    result = await db.execute(query)
    statuses: dict[int, set[str]] = {}
    for company_id, status, _count in result.all():
        statuses.setdefault(company_id, set()).add(status or "Pending")
    return {
        company_id: (
            "Filed"
            if "Submitted" in status_set
            else "Overdue" if "Overdue" in status_set else "Pending"
        )
        for company_id, status_set in statuses.items()
    }


async def _open_complaints_by_company(
    db: AsyncSession, company_ids: list[int] | None = None
) -> dict[int, int]:
    query = (
        select(Concern.company_id, func.count())
        .where(Concern.status != "Closed")
        .group_by(Concern.company_id)
    )
    if company_ids is not None:
        query = query.where(Concern.company_id.in_(company_ids))
    result = await db.execute(query)
    return {company_id: count for company_id, count in result.all()}


async def _training_completed_users_by_company(
    db: AsyncSession,
    company_ids: list[int] | None = None,
) -> dict[int, int]:
    query = (
        select(TrainingHistory.company_id, func.count(TrainingHistory.user_id.distinct()))
        .where(TrainingHistory.status == "Completed")
        .group_by(TrainingHistory.company_id)
    )
    if company_ids is not None:
        query = query.where(TrainingHistory.company_id.in_(company_ids))
    result = await db.execute(query)
    return {company_id: count for company_id, count in result.all()}


async def _user_training_rows(db: AsyncSession, company_ids: list[int] | None = None) -> list[dict]:
    filters = [
        UserMaster.is_deleted == "N",
        UserMaster.status == "Active",
        UserMaster.role_id == 4,
    ]
    if company_ids is not None:
        filters.append(UserMaster.company_id.in_(company_ids))
    users = (
        await db.execute(
            select(
                UserMaster.user_id,
                UserMaster.company_id,
                CompanyMaster.company_name,
                UserMaster.employee_id,
                UserMaster.first_name,
                UserMaster.last_name,
                UserMaster.department,
                UserMaster.designation,
                UserMaster.role_id,
                UserMaster.ic_role,
            )
            .join(CompanyMaster, CompanyMaster.company_id == UserMaster.company_id)
            .where(*filters)
            .order_by(CompanyMaster.company_name, UserMaster.first_name)
        )
    ).all()
    user_ids = [row.user_id for row in users]
    if not user_ids:
        return []
    user_company_ids = sorted({row.company_id for row in users if row.company_id})

    history_result = await db.execute(
        select(
            TrainingHistory.user_id,
            func.max(TrainingHistory.updated_date),
            func.max(VideoMaster.title),
            func.sum(case((TrainingHistory.status == "Completed", 1), else_=0)),
            func.count(TrainingHistory.id),
        )
        .join(VideoMaster, VideoMaster.video_id == TrainingHistory.video_id)
        .where(TrainingHistory.user_id.in_(user_ids))
        .group_by(TrainingHistory.user_id)
    )
    history = {
        user_id: {
            "last_access": last_access,
            "training_name": training_name,
            "completed": int(completed or 0),
            "total": int(total or 0),
        }
        for user_id, last_access, training_name, completed, total in history_result.all()
    }

    cert_result = await db.execute(
        select(Certificate.user_id, func.count())
        .where(Certificate.user_id.in_(user_ids), Certificate.status == "Valid")
        .group_by(Certificate.user_id)
    )
    certificates = {user_id: count for user_id, count in cert_result.all()}

    assignment_result = await db.execute(
        select(
            CourseAssignment.id,
            CourseAssignment.video_id,
            CourseAssignment.company_id,
            CourseAssignment.assigned_to_user_id,
            CourseAssignment.assigned_to_department,
            CourseAssignment.assign_type,
            CourseAssignment.due_date,
            VideoMaster.title,
        )
        .join(VideoMaster, VideoMaster.video_id == CourseAssignment.video_id)
        .where(CourseAssignment.company_id.in_(user_company_ids))
    )
    assignment_rows = assignment_result.all()
    assigned_by_user: dict[int, dict] = {
        row.user_id: {"video_ids": set(), "titles": [], "due_date": None} for row in users
    }
    for assignment in assignment_rows:
        for user_row in users:
            if user_row.company_id != assignment.company_id:
                continue
            if (
                assignment.assign_type == "Individual"
                and assignment.assigned_to_user_id != user_row.user_id
            ):
                continue
            if (
                assignment.assign_type == "Department"
                and assignment.assigned_to_department != user_row.department
            ):
                continue
            user_assignment = assigned_by_user[user_row.user_id]
            if assignment.video_id not in user_assignment["video_ids"]:
                user_assignment["video_ids"].add(assignment.video_id)
                user_assignment["titles"].append(assignment.title)
            if assignment.due_date and (
                not user_assignment["due_date"] or assignment.due_date < user_assignment["due_date"]
            ):
                user_assignment["due_date"] = assignment.due_date

    published_company_ids = sorted(set(user_company_ids + [1]))
    published_result = await db.execute(
        select(
            VideoMaster.video_id,
            VideoMaster.company_id,
            VideoMaster.title,
        )
        .where(
            VideoMaster.company_id.in_(published_company_ids),
            VideoMaster.status == "Published",
            or_(
                VideoMaster.target_audience == "Employee",
                VideoMaster.target_audience == "All",
                VideoMaster.target_audience.is_(None),
            ),
        )
        .order_by(VideoMaster.training_level.asc(), VideoMaster.title.asc())
    )
    published_by_company: dict[int, list[dict]] = {}
    global_published: list[dict] = []
    for video_id, video_company_id, title in published_result.all():
        video_row = {"video_id": video_id, "title": title}
        if video_company_id == 1:
            global_published.append(video_row)
        published_by_company.setdefault(video_company_id, []).append(video_row)

    rows = []
    for row in users:
        item_history = history.get(row.user_id, {})
        item_assignment = assigned_by_user.get(row.user_id, {})
        total_history = item_history.get("total", 0)
        published_videos = [
            *global_published,
            *published_by_company.get(row.company_id, []),
        ]
        published_video_ids = {video["video_id"] for video in published_videos}
        total_assigned = len(set(item_assignment.get("video_ids", set())) | published_video_ids)
        required_total = max(total_history, total_assigned)
        if not required_total:
            continue
        completed_history = item_history.get("completed", 0)
        completion_status = (
            "Completed"
            if required_total and completed_history >= required_total
            else "Started" if total_history else "Pending"
        )
        certificate_count = certificates.get(row.user_id, 0)
        role_name = ROLE_NAMES.get(row.role_id, "User")
        last_access = item_history.get("last_access")
        assignment_titles = [
            *item_assignment.get("titles", []),
            *[video["title"] for video in published_videos],
        ]
        rows.append(
            {
                "user_id": row.user_id,
                "company_id": row.company_id,
                "company_name": row.company_name,
                "name": " ".join([row.first_name or "", row.last_name or ""]).strip(),
                "employee_id": row.employee_id,
                "department": row.department or "Unassigned",
                "role_id": row.role_id,
                "role": role_name,
                "training_name": item_history.get("training_name")
                or (
                    ", ".join(assignment_titles[:2])
                    if assignment_titles
                    else "POSH Awareness Training"
                ),
                "completion_status": completion_status,
                "last_access": last_access.isoformat() if last_access else "",
                "certificate_status": "Valid" if certificate_count else "Not Issued",
            }
        )
    return rows


async def _platform_overview(db: AsyncSession) -> dict:
    async def scalar_count(*conditions) -> int:
        result = await db.execute(select(func.count()).where(*conditions))
        return result.scalar() or 0

    async def grouped_counts(column, *conditions) -> dict:
        result = await db.execute(select(column, func.count()).where(*conditions).group_by(column))
        return {str(key or "Unassigned"): value for key, value in result.all()}

    companies_result = await db.execute(
        select(func.count()).where(
            CompanyMaster.is_deleted == "N",
            CompanyMaster.company_id != 1,
            CompanyMaster.status == "Active",
        )
    )
    total_companies = companies_result.scalar() or 0

    users_result = await db.execute(
        select(func.count()).where(UserMaster.is_deleted == "N", UserMaster.status == "Active")
    )
    total_users = users_result.scalar() or 0

    certs_result = await db.execute(select(func.count()).where(Certificate.status == "Valid"))
    total_certificates = certs_result.scalar() or 0

    completions_result = await db.execute(
        select(func.count()).where(TrainingHistory.status == "Completed")
    )
    total_completions = completions_result.scalar() or 0

    avg_score_result = await db.execute(
        select(func.avg(AssessmentResult.score)).where(AssessmentResult.result == "Pass")
    )
    avg_score = round(float(avg_score_result.scalar() or 0), 2)
    role_counts = await grouped_counts(
        UserMaster.role_id,
        UserMaster.is_deleted == "N",
        UserMaster.status == "Active",
    )
    company_approval = await grouped_counts(
        CompanyMaster.approval_status,
        CompanyMaster.is_deleted == "N",
        CompanyMaster.company_id != 1,
    )
    company_status = await grouped_counts(
        CompanyMaster.status,
        CompanyMaster.is_deleted == "N",
        CompanyMaster.company_id != 1,
    )
    video_status = await grouped_counts(VideoMaster.status)
    service_training_result = await db.execute(
        select(
            VideoMaster.service_code,
            VideoMaster.training_level,
            VideoMaster.target_audience,
            VideoMaster.status,
            func.count(),
        ).group_by(
            VideoMaster.service_code,
            VideoMaster.training_level,
            VideoMaster.target_audience,
            VideoMaster.status,
        )
    )
    service_training = {}
    for (
        service_code,
        training_level,
        target_audience,
        status,
        count,
    ) in service_training_result.all():
        normalized_service_code = str(service_code or "POSH").strip().upper() or "POSH"
        if normalized_service_code != "POSH":
            continue
        service = service_training.setdefault(normalized_service_code, {})
        level = service.setdefault(str(training_level or "Basic"), {})
        audience = level.setdefault(
            str(target_audience or "Employee"),
            {"total": 0, "draft": 0, "published": 0, "archived": 0},
        )
        audience["total"] += count
        audience[str(status or "Draft").lower()] = count
    template_status = await grouped_counts(CertificateTemplate.status)
    concern_status = await grouped_counts(Concern.status)
    assessment_results = await grouped_counts(AssessmentResult.result)
    annual_return_status = await grouped_counts(AnnualReturn.status)
    total_employees = role_counts.get("4", 0)
    completed_users_result = await db.execute(
        select(func.count(TrainingHistory.user_id.distinct())).where(
            TrainingHistory.status == "Completed"
        )
    )
    completed_users = completed_users_result.scalar() or 0
    assignments_result = await db.execute(select(func.count()).select_from(CourseAssignment))
    total_assignments = assignments_result.scalar() or 0
    compliance_rate = round((completed_users / total_employees * 100), 2) if total_employees else 0
    company_rows = (
        await db.execute(
            select(
                CompanyMaster.company_id,
                CompanyMaster.company_name,
                CompanyMaster.approval_status,
                CompanyMaster.status,
                CompanyMaster.scope_codes_json,
                CompanyMaster.service_details_json,
            ).where(CompanyMaster.is_deleted == "N", CompanyMaster.company_id != 1)
        )
    ).all()
    company_ids = [row.company_id for row in company_rows]
    employees_by_company = {
        company_id: count
        for company_id, count in (
            await db.execute(
                select(UserMaster.company_id, func.count())
                .where(UserMaster.is_deleted == "N", UserMaster.role_id == 4)
                .group_by(UserMaster.company_id)
            )
        ).all()
    }
    certificates_by_company = {
        company_id: count
        for company_id, count in (
            await db.execute(
                select(Certificate.company_id, func.count())
                .where(Certificate.status == "Valid")
                .group_by(Certificate.company_id)
            )
        ).all()
    }
    ic_by_company = {
        company_id: count
        for company_id, count in (
            await db.execute(
                select(UserMaster.company_id, func.count())
                .where(UserMaster.is_deleted == "N", UserMaster.role_id == 3)
                .group_by(UserMaster.company_id)
            )
        ).all()
    }
    annual_status_map = await _annual_status_by_company(db, company_ids)
    open_complaints_map = await _open_complaints_by_company(db, company_ids)
    completed_by_company = await _training_completed_users_by_company(db, company_ids)
    services = {}
    organizations = []
    for (
        company_id,
        company_name,
        approval_status,
        status,
        scope_codes_json,
        service_details_json,
    ) in company_rows:
        service_summary = _service_summary(service_details_json)
        try:
            scopes = json.loads(scope_codes_json or "[]")
        except json.JSONDecodeError:
            scopes = []
        if not isinstance(scopes, list):
            scopes = []
        service_codes = [
            str(scope or "Unassigned").strip().upper() or "Unassigned" for scope in scopes
        ]
        service_codes = [service_code for service_code in service_codes if service_code == "POSH"]
        employee_count = employees_by_company.get(company_id, 0)
        certificate_count = certificates_by_company.get(company_id, 0)
        completed_count = completed_by_company.get(company_id, 0)
        training_rate = round((completed_count / employee_count * 100), 2) if employee_count else 0
        org_annual_status = annual_status_map.get(company_id, "Pending")
        open_complaints = open_complaints_map.get(company_id, 0)
        health = "Green"
        if open_complaints or org_annual_status == "Overdue":
            health = "Red"
        elif org_annual_status == "Pending" or training_rate < 80:
            health = "Amber"
        for service_code in service_codes:
            service = services.setdefault(
                service_code,
                {
                    "companies": 0,
                    "active_companies": 0,
                    "approved_companies": 0,
                    "pending_companies": 0,
                    "employees": 0,
                    "certificates": 0,
                },
            )
            service["companies"] += 1
            if status == "Active":
                service["active_companies"] += 1
            if approval_status == "Approved":
                service["approved_companies"] += 1
            elif (approval_status or "Pending") == "Pending":
                service["pending_companies"] += 1
            service["employees"] += employee_count
            service["certificates"] += certificate_count
        organizations.append(
            {
                "company_id": company_id,
                "company_name": company_name,
                "status": status,
                "approval_status": approval_status or "Pending",
                "services": service_codes,
                "client_id": service_summary["client_id"],
                "frequency": service_summary["frequency"],
                "billing": service_summary["billing"],
                "start_date": service_summary["start_date"],
                "stop_date": service_summary["stop_date"],
                "assigned_to_name": service_summary["assigned_to_name"],
                "deliverables": service_summary["deliverables"],
                "annual_return_status": org_annual_status,
                "training_rate": training_rate,
                "completed_training": completed_count,
                "open_complaints": open_complaints,
                "ic_users": ic_by_company.get(company_id, 0),
                "contract": (
                    "Active" if status == "Active" and approval_status == "Approved" else "Pending"
                ),
                "health": health,
                "employees": employee_count,
                "certificates": certificate_count,
            }
        )

    user_training_rows = await _user_training_rows(db)
    return {
        "scope": "platform",
        "total_companies": total_companies,
        "total_users": total_users,
        "total_certificates_issued": total_certificates,
        "total_course_completions": total_completions,
        "average_pass_score": avg_score,
        "compliance_rate": compliance_rate,
        "hierarchy": {
            "super_admins": role_counts.get("1", 0),
            "company_admins": role_counts.get("2", 0),
            "client_management": role_counts.get("5", 0),
            "hr_users": role_counts.get("3", 0),
            "employees": total_employees,
        },
        "companies": {
            "active": company_status.get("Active", 0),
            "inactive": company_status.get("Inactive", 0),
            "approved": company_approval.get("Approved", 0),
            "pending": company_approval.get("Pending", 0),
            "rejected": company_approval.get("Rejected", 0),
        },
        "videos": {
            "total": sum(video_status.values()),
            "draft": video_status.get("Draft", 0),
            "published": video_status.get("Published", 0),
            "archived": video_status.get("Archived", 0),
        },
        "training": {
            "assignments": max(total_assignments, len(user_training_rows)),
            "completed_users": completed_users,
            "completed_history": total_completions,
            "in_progress": await scalar_count(TrainingHistory.status == "In Progress"),
            "compliance_rate": compliance_rate,
        },
        "assessments": {
            "passed": assessment_results.get("Pass", 0),
            "failed": assessment_results.get("Fail", 0),
            "average_pass_score": avg_score,
        },
        "certificates": {
            "issued": total_certificates,
            "revoked": await scalar_count(Certificate.status == "Revoked"),
            "templates_pending": template_status.get("Pending", 0),
            "templates_active": template_status.get("Active", 0),
            "templates_rejected": template_status.get("Rejected", 0),
        },
        "concerns": {
            "open": concern_status.get("Open", 0),
            "reviewed": concern_status.get("Reviewed", 0),
            "closed": concern_status.get("Closed", 0),
            "total": sum(concern_status.values()),
        },
        "approvals": {
            "companies_pending": company_approval.get("Pending", 0),
            "videos_pending": video_status.get("Draft", 0),
            "certificate_templates_pending": template_status.get("Pending", 0),
            "open_concerns": concern_status.get("Open", 0),
        },
        "annual_returns": {
            "completed": annual_return_status.get("Submitted", 0),
            "pending": annual_return_status.get("Pending", 0)
            + annual_return_status.get("Draft", 0),
        },
        "services": services,
        "service_training": service_training,
        "organizations": organizations,
        "user_training_rows": user_training_rows,
    }


async def _company_overview(db: AsyncSession, company_id: int) -> dict:
    company_result = await db.execute(
        select(
            CompanyMaster.company_id,
            CompanyMaster.company_name,
            CompanyMaster.status,
            CompanyMaster.approval_status,
            CompanyMaster.service_details_json,
        ).where(CompanyMaster.company_id == company_id, CompanyMaster.is_deleted == "N")
    )
    company = company_result.first()
    company_service_summary = _service_summary(company.service_details_json if company else None)
    role_counts_result = await db.execute(
        select(UserMaster.role_id, func.count())
        .where(
            UserMaster.company_id == company_id,
            UserMaster.status == "Active",
            UserMaster.is_deleted == "N",
        )
        .group_by(UserMaster.role_id)
    )
    role_counts = {str(role_id): count for role_id, count in role_counts_result.all()}
    total_users = sum(role_counts.values())

    total_result = await db.execute(
        select(func.count()).where(
            UserMaster.company_id == company_id,
            UserMaster.is_deleted == "N",
            UserMaster.role_id == 4,
        )
    )
    total = total_result.scalar() or 0

    completed_result = await db.execute(
        select(func.count(TrainingHistory.user_id.distinct()))
        .join(UserMaster, UserMaster.user_id == TrainingHistory.user_id)
        .where(
            TrainingHistory.company_id == company_id,
            TrainingHistory.status == "Completed",
            UserMaster.role_id == 4,
            UserMaster.status == "Active",
            UserMaster.is_deleted == "N",
        )
    )
    completed = completed_result.scalar() or 0

    in_progress_result = await db.execute(
        select(func.count(TrainingHistory.user_id.distinct()))
        .join(UserMaster, UserMaster.user_id == TrainingHistory.user_id)
        .where(
            TrainingHistory.company_id == company_id,
            TrainingHistory.status == "In Progress",
            UserMaster.role_id == 4,
            UserMaster.status == "Active",
            UserMaster.is_deleted == "N",
        )
    )
    in_progress = in_progress_result.scalar() or 0

    cert_result = await db.execute(
        select(func.count()).where(
            Certificate.company_id == company_id,
            Certificate.status == "Valid",
        )
    )
    total_certs = cert_result.scalar() or 0

    avg_score_result = await db.execute(
        select(func.avg(AssessmentResult.score)).where(
            AssessmentResult.video_id.in_(
                select(TrainingHistory.video_id).where(TrainingHistory.company_id == company_id)
            ),
            AssessmentResult.result == "Pass",
        )
    )
    avg_score = round(float(avg_score_result.scalar() or 0), 2)
    compliance_rate = round((completed / total * 100), 2) if total > 0 else 0.0
    assignments_result = await db.execute(
        select(func.count()).where(CourseAssignment.company_id == company_id)
    )
    assignment_count = assignments_result.scalar() or 0
    concern_result = await db.execute(
        select(Concern.status, func.count())
        .where(Concern.company_id == company_id)
        .group_by(Concern.status)
    )
    concerns = {str(status or "Open"): count for status, count in concern_result.all()}
    annual_return_status_result = await db.execute(
        select(AnnualReturn.status, func.count())
        .where(AnnualReturn.company_id == company_id)
        .group_by(AnnualReturn.status)
    )
    annual_return_status = {
        str(status or "Pending"): count for status, count in annual_return_status_result.all()
    }
    company_annual_status = await _annual_status_by_company(db, [company_id])
    company_open_complaints = await _open_complaints_by_company(db, [company_id])
    company_completed = await _training_completed_users_by_company(db, [company_id])
    department_result = await db.execute(
        select(UserMaster.department, func.count())
        .where(
            UserMaster.company_id == company_id,
            UserMaster.status == "Active",
            UserMaster.is_deleted == "N",
            UserMaster.role_id == 4,
        )
        .group_by(UserMaster.department)
        .order_by(UserMaster.department)
    )
    departments = []
    for department, department_total in department_result.all():
        department_name = department or "Unassigned"
        completed_dept_result = await db.execute(
            select(func.count(TrainingHistory.user_id.distinct()))
            .join(UserMaster, UserMaster.user_id == TrainingHistory.user_id)
            .where(
                TrainingHistory.company_id == company_id,
                TrainingHistory.status == "Completed",
                UserMaster.role_id == 4,
                UserMaster.status == "Active",
                UserMaster.is_deleted == "N",
                UserMaster.department == department,
            )
        )
        department_completed = completed_dept_result.scalar() or 0
        departments.append(
            {
                "department": department_name,
                "total": department_total,
                "completed": department_completed,
                "pending": max(department_total - department_completed, 0),
                "compliance_rate": (
                    round((department_completed / department_total * 100), 2)
                    if department_total
                    else 0
                ),
            }
        )

    user_training_rows = await _user_training_rows(db, [company_id])
    return {
        "scope": "company",
        "company_id": company_id,
        "total_users": total_users,
        "company_admins": role_counts.get("2", 0),
        "client_management_users": role_counts.get("5", 0),
        "ic_users": role_counts.get("3", 0),
        "total_employees": total,
        "completed_training": completed,
        "in_progress_training": in_progress,
        "not_started_training": max(total - completed - in_progress, 0),
        "compliance_rate": compliance_rate,
        "certificates_issued": total_certs,
        "average_pass_score": avg_score,
        "assignments": max(assignment_count, len(user_training_rows)),
        "department_breakdown": departments,
        "concerns": {
            "open": concerns.get("Open", 0),
            "reviewed": concerns.get("Reviewed", 0),
            "closed": concerns.get("Closed", 0),
            "total": sum(concerns.values()),
        },
        "annual_returns": {
            "completed": annual_return_status.get("Submitted", 0),
            "pending": annual_return_status.get("Pending", 0)
            + annual_return_status.get("Draft", 0),
        },
        "organizations": (
            [
                {
                    "company_id": company.company_id,
                    "company_name": company.company_name,
                    "status": company.status,
                    "approval_status": company.approval_status or "Pending",
                    "annual_return_status": company_annual_status.get(
                        company.company_id, "Pending"
                    ),
                    "services": ["POSH"],
                    "client_id": company_service_summary["client_id"],
                    "frequency": company_service_summary["frequency"],
                    "billing": company_service_summary["billing"],
                    "start_date": company_service_summary["start_date"],
                    "stop_date": company_service_summary["stop_date"],
                    "assigned_to_name": company_service_summary["assigned_to_name"],
                    "deliverables": company_service_summary["deliverables"],
                    "training_rate": compliance_rate,
                    "completed_training": company_completed.get(company.company_id, 0),
                    "open_complaints": company_open_complaints.get(company.company_id, 0),
                    "ic_users": role_counts.get("3", 0),
                    "contract": (
                        "Active"
                        if company.status == "Active" and company.approval_status == "Approved"
                        else "Pending"
                    ),
                    "health": (
                        "Red"
                        if company_open_complaints.get(company.company_id, 0)
                        else (
                            "Amber"
                            if company_annual_status.get(company.company_id, "Pending") == "Pending"
                            or compliance_rate < 80
                            else "Green"
                        )
                    ),
                    "employees": total,
                    "certificates": total_certs,
                }
            ]
            if company
            else []
        ),
        "user_training_rows": user_training_rows,
    }


async def _admin_overview(db: AsyncSession, current_user) -> dict:
    all_company_rows = (
        await db.execute(
            select(
                CompanyMaster.company_id,
                CompanyMaster.company_name,
                CompanyMaster.approval_status,
                CompanyMaster.status,
                CompanyMaster.scope_codes_json,
                CompanyMaster.service_details_json,
            ).where(CompanyMaster.is_deleted == "N", CompanyMaster.company_id != 1)
        )
    ).all()
    visible_rows = []
    for row in all_company_rows:
        try:
            service_rows = json.loads(row.service_details_json or "[]")
        except json.JSONDecodeError:
            service_rows = []
        if not isinstance(service_rows, list):
            service_rows = []
        is_assigned = any(
            str(item.get("assigned_to") or "") == str(current_user.user_id)
            or str(item.get("created_by") or "") == str(current_user.user_id)
            for item in service_rows
            if isinstance(item, dict)
        )
        if is_assigned:
            visible_rows.append(row)

    company_ids = [row.company_id for row in visible_rows]
    own_company_id = current_user.company_id
    training_company_ids = sorted(set(company_ids + ([own_company_id] if own_company_id else [])))
    employees_by_company = {
        company_id: count
        for company_id, count in (
            await db.execute(
                select(UserMaster.company_id, func.count())
                .where(
                    UserMaster.company_id.in_(training_company_ids or [0]),
                    UserMaster.is_deleted == "N",
                    UserMaster.role_id == 4,
                )
                .group_by(UserMaster.company_id)
            )
        ).all()
    }
    certificates_by_company = {
        company_id: count
        for company_id, count in (
            await db.execute(
                select(Certificate.company_id, func.count())
                .where(
                    Certificate.company_id.in_(training_company_ids or [0]),
                    Certificate.status == "Valid",
                )
                .group_by(Certificate.company_id)
            )
        ).all()
    }
    ic_by_company = {
        company_id: count
        for company_id, count in (
            await db.execute(
                select(UserMaster.company_id, func.count())
                .where(
                    UserMaster.company_id.in_(training_company_ids or [0]),
                    UserMaster.is_deleted == "N",
                    UserMaster.role_id == 3,
                )
                .group_by(UserMaster.company_id)
            )
        ).all()
    }
    annual_status_map = await _annual_status_by_company(db, company_ids)
    open_complaints_map = await _open_complaints_by_company(db, company_ids)
    completed_by_company = await _training_completed_users_by_company(db, training_company_ids)
    organizations = []
    for row in visible_rows:
        service_codes = _service_codes(row.scope_codes_json)
        service_summary = _service_summary(row.service_details_json)
        employee_count = employees_by_company.get(row.company_id, 0)
        completed_count = completed_by_company.get(row.company_id, 0)
        training_rate = round((completed_count / employee_count * 100), 2) if employee_count else 0
        org_annual_status = annual_status_map.get(row.company_id, "Pending")
        open_complaints = open_complaints_map.get(row.company_id, 0)
        organizations.append(
            {
                "company_id": row.company_id,
                "company_name": row.company_name,
                "status": row.status,
                "approval_status": row.approval_status or "Pending",
                "services": service_codes,
                "client_id": service_summary["client_id"],
                "frequency": service_summary["frequency"],
                "billing": service_summary["billing"],
                "start_date": service_summary["start_date"],
                "stop_date": service_summary["stop_date"],
                "assigned_to_name": service_summary["assigned_to_name"],
                "deliverables": service_summary["deliverables"],
                "annual_return_status": org_annual_status,
                "training_rate": training_rate,
                "completed_training": completed_count,
                "open_complaints": open_complaints,
                "ic_users": ic_by_company.get(row.company_id, 0),
                "contract": (
                    "Active"
                    if row.status == "Active" and row.approval_status == "Approved"
                    else "Pending"
                ),
                "health": (
                    "Red"
                    if open_complaints or org_annual_status == "Overdue"
                    else (
                        "Amber" if org_annual_status == "Pending" or training_rate < 80 else "Green"
                    )
                ),
                "employees": employee_count,
                "certificates": certificates_by_company.get(row.company_id, 0),
            }
        )

    own_company = await _company_overview(db, own_company_id)
    admin_training_rows = await _user_training_rows(db, training_company_ids)
    own_company.update(
        {
            "scope": "admin",
            "managed_clients": len(organizations),
            "organizations": organizations,
            "assignments": max(own_company.get("assignments", 0), len(admin_training_rows)),
            "user_training_rows": admin_training_rows,
        }
    )
    return own_company


@router.get("/current")
async def current_analytics(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("reports.view")),
):
    """Analytics for the current admin scope."""
    if current_user.role_id == 1:
        return await _platform_overview(db)
    if current_user.role_id == 2:
        return await _admin_overview(db, current_user)
    return await _company_overview(db, current_user.company_id)


@router.get("/overview")
async def analytics_overview(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_roles([1])),  # Super Admin only
):
    """Platform-wide analytics for Super Admin."""
    return await _platform_overview(db)


@router.get("/company/{company_id}")
async def company_analytics(
    company_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("reports.view")),
):
    """Analytics for a specific company."""
    if current_user.role_id != 1 and current_user.company_id != company_id:
        raise HTTPException(403, "You do not have permission to access this company.")

    return await _company_overview(db, company_id)
