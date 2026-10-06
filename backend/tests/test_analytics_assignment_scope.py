import json
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.api.v1.analytics import (
    _assigned_company_ids,
    analytics_overview,
    company_analytics,
    current_analytics,
)
from app.api.v1.hr import (
    download_certificate_report_csv,
    download_department_report_csv,
    download_employee_report_csv,
)
from app.db.base import Base
from app.models.certificate import Certificate
from app.models.company import CompanyMaster
from app.models.training import AssessmentResult, TrainingHistory
from app.models.user import UserMaster
from app.models.video import VideoMaster


class AsyncSessionAdapter:
    def __init__(self, session):
        self.session = session

    async def execute(self, statement):
        return self.session.execute(statement)


@pytest.fixture
def db():
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        for company_id, owner in [(2, 10), (3, 20)]:
            session.add(
                CompanyMaster(
                    company_id=company_id,
                    company_code=f"C{company_id}",
                    company_name=f"Company {company_id}",
                    status="Active",
                    approval_status="Approved",
                    scope_codes_json='["POSH"]',
                    service_details_json=json.dumps(
                        [{"scope": "POSH", "assigned_to": owner, "created_by": 10}]
                    ),
                )
            )
            session.add(
                UserMaster(
                    user_id=company_id,
                    company_id=company_id,
                    employee_id=f"E{company_id}",
                    first_name=f"Employee {company_id}",
                    email=f"e{company_id}@test.invalid",
                    username=f"employee{company_id}",
                    role_id=4,
                )
            )
            session.add(
                VideoMaster(
                    video_id=company_id,
                    company_id=company_id,
                    title=f"Video {company_id}",
                    status="Published",
                )
            )
            session.add(
                TrainingHistory(
                    id=company_id,
                    user_id=company_id,
                    company_id=company_id,
                    video_id=company_id,
                    status="Completed",
                )
            )
            session.add(
                Certificate(
                    certificate_id=company_id,
                    user_id=company_id,
                    company_id=company_id,
                    certificate_number=f"CERT{company_id}",
                    status="Valid",
                )
            )
            # Both companies' employees take the same video: results must be scoped by user.
            session.add(
                AssessmentResult(
                    id=company_id,
                    user_id=company_id,
                    video_id=2,
                    score=80 if company_id == 2 else 100,
                    result="Pass",
                )
            )
        session.commit()
        yield AsyncSessionAdapter(session)
    engine.dispose()


@pytest.mark.asyncio
@pytest.mark.parametrize("role", [1, 2])
async def test_only_current_assignment_counts_not_creator_or_own_company(db, role):
    user = SimpleNamespace(role_id=role, user_id=10, company_id=1)
    assert await _assigned_company_ids(db, user) == [2]
    result = await current_analytics(db, user)
    assert result["total_companies"] == 1
    assert result["total_users"] == 1
    assert result["total_certificates_issued"] == 1
    assert result["total_course_completions"] == 1
    assert result["average_pass_score"] == 80
    assert result["videos"]["published"] == 1
    assert [row["company_id"] for row in result["organizations"]] == [2]
    assert all(row["company_id"] == 2 for row in result["user_training_rows"])
    with pytest.raises(HTTPException) as error:
        await company_analytics(3, db, user)
    assert error.value.status_code == 403


@pytest.mark.asyncio
async def test_super_admin_overview_has_no_global_fallback(db):
    result = await analytics_overview(db, SimpleNamespace(role_id=1, user_id=99, company_id=1))
    assert result["total_companies"] == 0
    assert result["total_users"] == 0
    assert result["organizations"] == []
    assert result["user_training_rows"] == []
    assert result["videos"]["total"] == 0


@pytest.mark.asyncio
async def test_primary_super_admin_sees_all_companies(db):
    user = SimpleNamespace(role_id=1, user_id=1, company_id=1)
    assert await _assigned_company_ids(db, user) == [2, 3]
    result = await analytics_overview(db, user)
    assert result["total_companies"] == 2
    assert [row["company_id"] for row in result["organizations"]] == [2, 3]
    assert result["total_users"] == 2


@pytest.mark.asyncio
async def test_client_management_stays_with_own_org_and_scores(db):
    user = SimpleNamespace(role_id=5, user_id=10, company_id=3)
    assert await _assigned_company_ids(db, user) == [3]
    result = await company_analytics(3, db, user)
    assert result["average_pass_score"] == 100
    assert [row["company_id"] for row in result["organizations"]] == [3]
    with pytest.raises(HTTPException):
        await company_analytics(2, db, user)


@pytest.mark.asyncio
async def test_reassignment_revokes_previous_stats_access(db):
    company = db.session.get(CompanyMaster, 2)
    company.service_details_json = '[{"scope":"POSH","assigned_to":20,"created_by":10}]'
    db.session.commit()
    assert await _assigned_company_ids(db, SimpleNamespace(role_id=1, user_id=10)) == []
    assert await _assigned_company_ids(db, SimpleNamespace(role_id=1, user_id=20)) == [2, 3]


@pytest.mark.asyncio
@pytest.mark.parametrize("role", [1, 2, 5])
@pytest.mark.parametrize(
    "download",
    [download_certificate_report_csv, download_department_report_csv, download_employee_report_csv],
)
async def test_report_downloads_use_same_company_scope(db, role, download):
    response = await download(db, SimpleNamespace(role_id=role, user_id=10, company_id=2))
    content = response.body.decode("utf-8-sig")
    assert "Company 2" in content
    assert "Company 3" not in content
