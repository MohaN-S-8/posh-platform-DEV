import json
from datetime import date, datetime, timedelta
from html import escape

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import require_permission
from app.db.session import get_db
from app.models.annual_return import AnnualReturn
from app.models.company import CompanyMaster
from app.models.concern import Concern
from app.models.training import TrainingHistory
from app.models.user import UserMaster
from app.models.video import VideoMaster
from app.schemas.annual_return import AnnualReturnPayload
from app.services.audit_service import write_audit_log

router = APIRouter(prefix="/annual-returns", tags=["Annual Returns"])


def _json_list(value) -> list[dict]:
    if not value:
        return []
    if isinstance(value, list):
        return value
    try:
        parsed = json.loads(value)
    except json.JSONDecodeError:
        return []
    return parsed if isinstance(parsed, list) else []


def _text_or_empty(value) -> str:
    return value or ""


def _html(value, fallback: str = "-") -> str:
    text_value = str(value if value is not None else "").strip()
    return escape(text_value or fallback).replace("\n", "<br />")


def _annual_extra_fields(saved: AnnualReturn | None, counts: dict | None = None) -> dict:
    if not saved:
        counts = counts or {}
        return {
            "sector_nature": "",
            "shift_breakdown": "",
            "employees_total": counts.get("completed_training_users", 0),
            "employees_male": 0,
            "employees_female": 0,
            "awareness_attendees": counts.get("completed_training_users", 0),
            "pending_90_reasons": "",
            "workshop_period_from": None,
            "workshop_period_to": None,
            "workshop_details": "",
            "ic_constituted_date": None,
            "ic_member_change": "NIL",
            "orientation_programme_date": None,
            "policy_disseminated": "At the time of appointment of employees",
            "notice_displayed_from": None,
            "wfh_awareness_session_date": None,
            "new_joiner_orientation_timing": "Within one month of joining",
            "posh_awareness_date": None,
            "posh_awareness_mode": "In person",
            "posh_awareness_resource_person": "",
            "ic_members_json": "[]",
            "complaint_rows_json": "[]",
            "annual_return_copy": "",
            "registered_post_tracking_number": "",
            "covering_from_address": "",
            "posh_office_name": "",
            "posh_office_address": "",
        }
    return {
        "sector_nature": _text_or_empty(saved.sector_nature),
        "shift_breakdown": _text_or_empty(saved.shift_breakdown),
        "employees_total": saved.employees_total or 0,
        "employees_male": saved.employees_male or 0,
        "employees_female": saved.employees_female or 0,
        "awareness_attendees": saved.awareness_attendees or 0,
        "pending_90_reasons": _text_or_empty(saved.pending_90_reasons),
        "workshop_period_from": saved.workshop_period_from,
        "workshop_period_to": saved.workshop_period_to,
        "workshop_details": _text_or_empty(saved.workshop_details),
        "ic_constituted_date": saved.ic_constituted_date,
        "ic_member_change": _text_or_empty(saved.ic_member_change),
        "orientation_programme_date": saved.orientation_programme_date,
        "policy_disseminated": _text_or_empty(saved.policy_disseminated),
        "notice_displayed_from": saved.notice_displayed_from,
        "wfh_awareness_session_date": saved.wfh_awareness_session_date,
        "new_joiner_orientation_timing": _text_or_empty(saved.new_joiner_orientation_timing),
        "posh_awareness_date": saved.posh_awareness_date,
        "posh_awareness_mode": _text_or_empty(saved.posh_awareness_mode),
        "posh_awareness_resource_person": _text_or_empty(saved.posh_awareness_resource_person),
        "ic_members_json": saved.ic_members_json or "[]",
        "complaint_rows_json": saved.complaint_rows_json or "[]",
        "annual_return_copy": _text_or_empty(saved.annual_return_copy),
        "registered_post_tracking_number": _text_or_empty(saved.registered_post_tracking_number),
        "covering_from_address": _text_or_empty(saved.covering_from_address),
        "posh_office_name": _text_or_empty(saved.posh_office_name),
        "posh_office_address": _text_or_empty(saved.posh_office_address),
    }


def _branches_for_company(company: CompanyMaster) -> list[dict]:
    branches = []
    for index, branch in enumerate(_json_list(company.branches_json), start=1):
        name = (branch.get("branch_name") or "").strip()
        branch_id = (branch.get("branch_id") or "").strip()
        if not name and not branch_id:
            continue
        branches.append(
            {
                "branch_id": branch_id or f"BR-{index}",
                "branch_name": name or branch_id or f"Branch {index}",
            }
        )
    if not branches:
        branches.append(
            {
                "branch_id": "HEAD-OFFICE",
                "branch_name": f"{company.company_name} Head Office",
            }
        )
    return branches


async def _visible_companies(db: AsyncSession, current_user) -> list[CompanyMaster]:
    if current_user.role_id in [1, 2]:
        result = await db.execute(
            select(CompanyMaster)
            .where(
                CompanyMaster.is_deleted == "N",
            )
            .order_by(CompanyMaster.company_name.asc())
        )
        return result.scalars().all()
    if current_user.role_id == 5:
        result = await db.execute(
            select(CompanyMaster).where(
                CompanyMaster.company_id == current_user.company_id,
                CompanyMaster.is_deleted == "N",
            )
        )
        company = result.scalar_one_or_none()
        return [company] if company else []
    raise HTTPException(403, "You do not have permission to access annual returns.")


async def _ensure_company_access(
    db: AsyncSession,
    company_id: int,
    current_user,
) -> CompanyMaster:
    companies = await _visible_companies(db, current_user)
    company = next((item for item in companies if item.company_id == company_id), None)
    if not company:
        raise HTTPException(403, "You do not have permission to access this annual return.")
    return company


async def _branch_counts(
    db: AsyncSession,
    company_id: int,
    branch_id: str,
    branch_name: str,
    year: int,
) -> dict:
    year_start = datetime(year, 1, 1)
    next_year = datetime(year + 1, 1, 1)
    pending_cutoff = datetime.utcnow() - timedelta(days=90)
    branch_filters = []
    if branch_id != "HEAD-OFFICE":
        branch_filters.append(
            or_(UserMaster.branch_id == branch_id, UserMaster.branch_name == branch_name)
        )

    complaint_result = await db.execute(
        select(Concern.status, func.count())
        .join(UserMaster, UserMaster.user_id == Concern.user_id)
        .where(
            Concern.company_id == company_id,
            Concern.created_date >= year_start,
            Concern.created_date < next_year,
            *branch_filters,
        )
        .group_by(Concern.status)
    )
    complaints = {str(status or "Open"): count for status, count in complaint_result.all()}
    pending_90_result = await db.execute(
        select(func.count())
        .select_from(Concern)
        .join(UserMaster, UserMaster.user_id == Concern.user_id)
        .where(
            Concern.company_id == company_id,
            Concern.created_date >= year_start,
            Concern.created_date < next_year,
            Concern.created_date <= pending_cutoff,
            Concern.status != "Closed",
            *branch_filters,
        )
    )
    workshops_result = await db.execute(
        select(func.count(VideoMaster.video_id.distinct())).where(
            VideoMaster.company_id == company_id,
            VideoMaster.status == "Published",
        )
    )
    completed_users_result = await db.execute(
        select(func.count(TrainingHistory.user_id.distinct()))
        .join(UserMaster, UserMaster.user_id == TrainingHistory.user_id)
        .where(
            TrainingHistory.company_id == company_id,
            TrainingHistory.status == "Completed",
            TrainingHistory.updated_date >= year_start,
            TrainingHistory.updated_date < next_year,
            *branch_filters,
        )
    )
    return {
        "complaints_received": sum(complaints.values()),
        "complaints_disposed": complaints.get("Closed", 0),
        "complaints_pending_90": pending_90_result.scalar() or 0,
        "workshops_count": workshops_result.scalar() or 0,
        "completed_training_users": completed_users_result.scalar() or 0,
    }


async def _serialize_return(
    db: AsyncSession,
    company: CompanyMaster,
    branch: dict,
    year: int,
    saved: AnnualReturn | None,
) -> dict:
    counts = await _branch_counts(
        db,
        company.company_id,
        branch["branch_id"],
        branch["branch_name"],
        year,
    )
    if saved:
        return {
            "annual_return_id": saved.annual_return_id,
            "company_id": company.company_id,
            "company_name": company.company_name,
            "company_code": company.company_code,
            "branch_id": saved.branch_id,
            "branch_name": saved.branch_name,
            "year": saved.year,
            "return_date": saved.return_date,
            "status": saved.status or "Pending",
            "presiding_officer": saved.presiding_officer,
            "complaints_received": saved.complaints_received,
            "complaints_disposed": saved.complaints_disposed,
            "complaints_pending_90": saved.complaints_pending_90,
            "workshops_count": saved.workshops_count,
            "action_taken": saved.action_taken,
            "posh_office_recipient": saved.posh_office_recipient,
            "acknowledgement_proof": saved.acknowledgement_proof,
            "training_proof": saved.training_proof,
            "postal_proof": saved.postal_proof,
            "completed_training_users": counts["completed_training_users"],
            **_annual_extra_fields(saved, counts),
        }
    return {
        "annual_return_id": None,
        "company_id": company.company_id,
        "company_name": company.company_name,
        "company_code": company.company_code,
        "branch_id": branch["branch_id"],
        "branch_name": branch["branch_name"],
        "year": year,
        "return_date": None,
        "status": "Pending",
        "presiding_officer": None,
        "complaints_received": counts["complaints_received"],
        "complaints_disposed": counts["complaints_disposed"],
        "complaints_pending_90": counts["complaints_pending_90"],
        "workshops_count": counts["workshops_count"],
        "action_taken": "",
        "posh_office_recipient": "",
        "acknowledgement_proof": "",
        "training_proof": "",
        "postal_proof": "",
        "completed_training_users": counts["completed_training_users"],
        **_annual_extra_fields(None, counts),
    }


@router.get("/")
async def list_annual_returns(
    year: int | None = None,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("reports.view")),
):
    """List annual returns visible to the current role."""
    target_year = year or date.today().year
    companies = await _visible_companies(db, current_user)
    rows = []
    for company in companies:
        saved_result = await db.execute(
            select(AnnualReturn).where(
                AnnualReturn.company_id == company.company_id,
                AnnualReturn.year == target_year,
            )
        )
        saved_by_key = {(item.branch_id, item.year): item for item in saved_result.scalars().all()}
        for branch in _branches_for_company(company):
            rows.append(
                await _serialize_return(
                    db,
                    company,
                    branch,
                    target_year,
                    saved_by_key.get((branch["branch_id"], target_year)),
                )
            )
    return {
        "scope": "platform" if current_user.role_id in [1, 2] else "company",
        "year": target_year,
        "rows": rows,
        "summary": {
            "submitted": sum(1 for row in rows if row["status"] == "Submitted"),
            "pending": sum(1 for row in rows if row["status"] != "Submitted"),
            "companies": len({row["company_id"] for row in rows}),
            "branches": len(rows),
        },
    }


@router.put("/")
async def save_annual_return(
    data: AnnualReturnPayload,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("reports.view")),
):
    """Create or update one annual return for a company branch/year."""
    company = await _ensure_company_access(db, data.company_id, current_user)
    branch_ids = {branch["branch_id"] for branch in _branches_for_company(company)}
    if data.branch_id not in branch_ids:
        raise HTTPException(400, "Branch is not registered for this company.")
    if data.status not in {"Pending", "Draft", "Submitted"}:
        raise HTTPException(400, "Status must be Pending, Draft, or Submitted.")

    result = await db.execute(
        select(AnnualReturn).where(
            AnnualReturn.company_id == data.company_id,
            AnnualReturn.branch_id == data.branch_id,
            AnnualReturn.year == data.year,
        )
    )
    annual_return = result.scalar_one_or_none()
    if not annual_return:
        annual_return = AnnualReturn(
            company_id=data.company_id,
            branch_id=data.branch_id,
            year=data.year,
            created_by=current_user.user_id,
        )
        db.add(annual_return)

    for field, value in data.model_dump(exclude={"company_id"}).items():
        setattr(annual_return, field, value)
    annual_return.updated_by = current_user.user_id
    await db.flush()
    await write_audit_log(
        db,
        user_id=current_user.user_id,
        company_id=data.company_id,
        action="ANNUAL_RETURN_SAVED",
        table_name="annual_returns",
        record_id=annual_return.annual_return_id,
        ip_address=request.client.host if request.client else None,
    )
    await db.commit()
    await db.refresh(annual_return)
    return await _serialize_return(
        db,
        company,
        {"branch_id": annual_return.branch_id, "branch_name": annual_return.branch_name},
        annual_return.year,
        annual_return,
    )


@router.get("/{annual_return_id}/cover-letter")
async def annual_return_cover_letter(
    annual_return_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("reports.view")),
):
    """Return printable covering-letter text for a saved annual return."""
    result = await db.execute(
        select(AnnualReturn, CompanyMaster)
        .join(CompanyMaster, CompanyMaster.company_id == AnnualReturn.company_id)
        .where(AnnualReturn.annual_return_id == annual_return_id)
    )
    row = result.first()
    if not row:
        raise HTTPException(404, "Annual return not found.")
    annual_return, company = row
    await _ensure_company_access(db, company.company_id, current_user)
    report_date = (
        annual_return.return_date.strftime("%d/%m/%Y") if annual_return.return_date else "-"
    )
    year_end = f"31 December {annual_return.year}"
    ic_members = _json_list(annual_return.ic_members_json)
    complaint_rows = _json_list(annual_return.complaint_rows_json)
    ic_rows = (
        "".join(
            f"""
        <tr>
          <td>{index}</td>
          <td>{_html(member.get('name'))}</td>
          <td>{_html(member.get('designation'))}</td>
          <td>{_html(member.get('contact_no'))}</td>
          <td>{_html(member.get('email'))}</td>
        </tr>
        """
            for index, member in enumerate(ic_members, start=1)
        )
        or "<tr><td colspan='5' class='center'>NIL</td></tr>"
    )
    complaint_rows_html = (
        "".join(
            f"""
        <tr>
          <td>{index}</td>
          <td>{_html(item.get('case_no'))}</td>
          <td>{_html(item.get('complainant_f'))}</td>
          <td>{_html(item.get('complainant_m'))}</td>
          <td>{_html(item.get('respondent'))}</td>
          <td>{_html(item.get('action'))}</td>
        </tr>
        """
            for index, item in enumerate(complaint_rows, start=1)
        )
        or "<tr><td colspan='6' class='center'>NIL</td></tr>"
    )
    to_address = (
        annual_return.posh_office_recipient
        or annual_return.posh_office_address
        or "Office of the District Collector\nCollectorate\nChennai\nTamil Nadu - 600001"
    )
    from_address = (
        annual_return.covering_from_address
        or f"{company.company_name}\n{annual_return.branch_name}"
    )
    content = f"""
    <html>
      <head>
        <title>Annual Return {annual_return.year}</title>
        <style>
          body {{ font-family: "Times New Roman", Times, serif; color: #111827; background: #f3f4f6; margin: 0; font-size: 12px; line-height: 1.45; }}
          .toolbar {{ position: sticky; top: 0; display: flex; justify-content: center; gap: 10px; padding: 16px; background: white; border-bottom: 1px solid #e5e7eb; }}
          button {{ background: #4a2e83; color: white; border: 0; border-radius: 6px; padding: 9px 18px; font-weight: 700; cursor: pointer; }}
          .note {{ max-width: 760px; margin: 10px auto 18px; text-align: center; color: #475569; font-size: 11px; }}
          .page {{ width: 760px; min-height: 1080px; margin: 0 auto 32px; background: white; padding: 28px 44px 48px; }}
          header {{ text-align: center; }}
          header h1 {{ margin: 0 0 8px; font-size: 24px; text-transform: uppercase; }}
          .rule {{ border-top: 2px solid #111827; margin: 20px 0; }}
          .date {{ text-align: right; font-weight: 700; margin-bottom: 18px; }}
          .address {{ margin-bottom: 18px; font-weight: 700; }}
          .title {{ text-align: center; margin: 12px 0 20px; }}
          .title h2 {{ margin: 0 0 6px; font-size: 18px; text-transform: uppercase; }}
          .title p {{ margin: 0 auto; max-width: 650px; font-style: italic; }}
          h3 {{ margin: 24px 0 8px; padding-bottom: 5px; border-bottom: 1px solid #111827; font-size: 13px; }}
          table {{ width: 100%; border-collapse: collapse; margin-bottom: 16px; }}
          th, td {{ border: 1px solid #9ca3af; padding: 7px 9px; vertical-align: top; text-align: left; }}
          th {{ background: #f8fafc; font-weight: 700; }}
          .meta th {{ width: 35%; }}
          .center {{ text-align: center; }}
          ol {{ margin: 0 0 18px; padding-left: 18px; }}
          li {{ margin-bottom: 8px; }}
          .declaration {{ margin-top: 24px; font-weight: 700; }}
          .signature {{ display: grid; grid-template-columns: 1fr 260px; gap: 24px; margin-top: 78px; text-align: center; }}
          .signature-line {{ border-top: 1px solid #111827; margin-bottom: 8px; }}
          .signature p {{ margin: 3px 0; }}
          .seal {{ margin-top: 60px; }}
          @media print {{ body {{ background: white; }} .toolbar, .note {{ display: none; }} .page {{ width: auto; min-height: auto; margin: 0; padding: 0; }} @page {{ size: A4; margin: 18mm; }} }}
        </style>
      </head>
      <body>
        <div class="toolbar">
          <button onclick="window.print()">Print</button>
          <button onclick="window.close()">Close</button>
        </div>
        <p class="note">Editable preview - correct any wording before printing. This Annual Return must go out on the employer's letterhead, signed by the Presiding Officer, under Section 21(1) of the POSH Act, 2013.</p>
        <main class="page">
          <header>
            <h1>{_html(company.company_name, 'Company Name')}</h1>
            <div>{_html(from_address)}</div>
          </header>
          <div class="rule"></div>
          <div class="date">Date: {report_date}</div>
          <section class="address"><strong>To</strong><br />{_html(to_address)}</section>
          <section class="title">
            <h2>Annual Return of the Internal Committee</h2>
            <p>Submitted under Section 21(1) of the Sexual Harassment of Women at Workplace (Prevention, Prohibition and Redressal) Act, 2013, read with Rule 14 of the Rules made thereunder, for the calendar year {annual_return.year}.</p>
          </section>
          <table class="meta">
            <tbody>
              <tr><th>Branch</th><td>{_html(annual_return.branch_name)}</td></tr>
              <tr><th>Year</th><td>{annual_return.year}</td></tr>
              <tr><th>Date of Report</th><td>{report_date}</td></tr>
              <tr><th>Presiding Officer</th><td>{_html(annual_return.presiding_officer)}</td></tr>
              <tr><th>Sector / Nature of Business</th><td>{_html(annual_return.sector_nature)}</td></tr>
              <tr><th>Shift Breakdown</th><td>{_html(annual_return.shift_breakdown)}</td></tr>
            </tbody>
          </table>
          <h3>Statement of Particulars</h3>
          <table>
            <thead><tr><th>Sr.</th><th>Particular</th><th>Details</th></tr></thead>
            <tbody>
              <tr><td>(a)</td><td>Number of complaints of sexual harassment received during the year</td><td>{annual_return.complaints_received or 0}</td></tr>
              <tr><td>(b)</td><td>Number of complaints disposed of during the year</td><td>{annual_return.complaints_disposed or 0}</td></tr>
              <tr><td>(c)</td><td>Number of cases pending for more than ninety days as on {year_end}</td><td>{annual_return.complaints_pending_90 or 0}</td></tr>
              <tr><td>-</td><td>Nature of action taken by the employer</td><td>{_html(annual_return.action_taken)}</td></tr>
              <tr><td>(d)</td><td>Number of workshops / awareness programmes conducted</td><td>{annual_return.workshops_count or 0}<br />{_html(annual_return.workshop_details)}</td></tr>
              <tr><td>-</td><td>Number of employees who attended such sessions</td><td>{annual_return.awareness_attendees or 0}</td></tr>
              <tr><td>-</td><td>Number of employees working</td><td>Women - {annual_return.employees_female or 0}<br />Men - {annual_return.employees_male or 0}<br />Total - {annual_return.employees_total or 0}</td></tr>
            </tbody>
          </table>
          <h3>Initiatives Taken During the Year</h3>
          <ol>
            <li>The Internal Committee was constituted on {_html(annual_return.ic_constituted_date)}.</li>
            <li>Change in Internal Committee members during the year: {_html(annual_return.ic_member_change, 'NIL')}.</li>
            <li>An orientation programme for IC members was conducted on {_html(annual_return.orientation_programme_date)}.</li>
            <li>The Anti-Sexual Harassment Policy is disseminated to all employees: {_html(annual_return.policy_disseminated)}.</li>
            <li>Notice of constitution of the Internal Committee has been displayed at the workplace from {_html(annual_return.notice_displayed_from)}.</li>
            <li>A Work-From-Home awareness session was conducted on {_html(annual_return.wfh_awareness_session_date)}.</li>
            <li>New joiners are given orientation on the POSH policy: {_html(annual_return.new_joiner_orientation_timing)}.</li>
            <li>POSH Awareness Programme - Date: {_html(annual_return.posh_awareness_date)}; Mode of Training: {_html(annual_return.posh_awareness_mode)}; Resource Person: {_html(annual_return.posh_awareness_resource_person)}.</li>
          </ol>
          <h3>Internal Committee Members (as on {year_end})</h3>
          <table><thead><tr><th>Sr.</th><th>Name</th><th>Designation</th><th>Contact No.</th><th>Email</th></tr></thead><tbody>{ic_rows}</tbody></table>
          <h3>Summary of Action Taken on Complaints</h3>
          <table><thead><tr><th>Sr.</th><th>Complaint No.</th><th>Complainant (F)</th><th>Complainant (M)</th><th>Respondent</th><th>Disciplinary Action</th></tr></thead><tbody>{complaint_rows_html}</tbody></table>
          <p class="declaration">This is to certify that the above particulars are true to the best of our knowledge and are submitted in compliance with Section 21(1) of the Sexual Harassment of Women at Workplace (Prevention, Prohibition and Redressal) Act, 2013.</p>
          <section class="signature"><div></div><div><div class="signature-line"></div><p>Signature of Presiding Officer</p><p>Name: {_html(annual_return.presiding_officer)}</p><p>Presiding Officer, Internal Committee</p><p>Date: {report_date}</p></div></section>
          <p class="seal">Company Seal:</p>
        </main>
      </body>
    </html>
    """
    return Response(content=content, media_type="text/html")
