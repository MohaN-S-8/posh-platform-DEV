from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.certificate import Certificate
from app.models.training import AssessmentResult, CourseAssignment, TrainingHistory
from app.models.user import UserMaster
from app.models.video import VideoMaster


class EmployeeService:
    async def list_courses(self, db: AsyncSession, user_id: int, company_id: int) -> list[dict]:
        user_result = await db.execute(
            select(UserMaster).where(
                UserMaster.user_id == user_id,
                UserMaster.company_id == company_id,
                UserMaster.status == "Active",
                UserMaster.is_deleted == "N",
            )
        )
        user = user_result.scalar_one()

        assignment_match = self.assignment_match_for_user(user)

        result = await db.execute(
            select(CourseAssignment, VideoMaster, TrainingHistory)
            .join(
                VideoMaster,
                and_(
                    VideoMaster.video_id == CourseAssignment.video_id,
                    VideoMaster.company_id == company_id,
                    VideoMaster.status == "Published",
                ),
            )
            .outerjoin(
                TrainingHistory,
                and_(
                    TrainingHistory.user_id == user_id,
                    TrainingHistory.video_id == CourseAssignment.video_id,
                ),
            )
            .where(
                CourseAssignment.company_id == company_id,
                assignment_match,
            )
            .order_by(CourseAssignment.due_date.asc(), VideoMaster.title.asc())
        )

        courses = []
        seen_video_ids = set()
        for assignment, video, history in result.all():
            if video.video_id in seen_video_ids:
                continue
            seen_video_ids.add(video.video_id)
            status = history.status if history else "Not Started"
            completion_percent = float(history.completion_percent or 0) if history else 0.0
            courses.append(
                {
                    "assignment_id": assignment.id,
                    "video_id": video.video_id,
                    "title": video.title,
                    "description": video.description,
                    "duration_minutes": video.duration_minutes,
                    "assign_type": assignment.assign_type,
                    "due_date": assignment.due_date,
                    "passing_score": float(assignment.passing_score or 70),
                    "status": status,
                    "completion_percent": completion_percent,
                    "resume_position": history.last_watched_position if history else 0,
                    "assessment_unlocked": status == "Completed",
                    "completed_at": history.completed_at if history else None,
                }
            )
        return courses

    async def summary(self, db: AsyncSession, user_id: int, company_id: int) -> dict:
        courses = await self.list_courses(db, user_id, company_id)
        cert_result = await db.execute(
            select(func.count()).where(
                Certificate.user_id == user_id,
                Certificate.company_id == company_id,
                Certificate.status == "Valid",
            )
        )
        total = len(courses)
        completed = sum(1 for course in courses if course["status"] == "Completed")
        in_progress = sum(1 for course in courses if course["status"] == "In Progress")
        return {
            "total_courses": total,
            "completed": completed,
            "in_progress": in_progress,
            "not_started": max(0, total - completed - in_progress),
            "certificates": cert_result.scalar() or 0,
            "completion_rate": round((completed / total * 100), 2) if total else 0.0,
        }

    async def training_history(self, db: AsyncSession, user_id: int, company_id: int) -> list[dict]:
        courses = await self.list_courses(db, user_id, company_id)
        history_rows = []

        for course in courses:
            assessment_result = await db.execute(
                select(AssessmentResult)
                .where(
                    AssessmentResult.user_id == user_id,
                    AssessmentResult.video_id == course["video_id"],
                )
                .order_by(AssessmentResult.attempted_at.desc(), AssessmentResult.id.desc())
                .limit(1)
            )
            assessment = assessment_result.scalar_one_or_none()

            certificate_result = await db.execute(
                select(Certificate)
                .where(
                    Certificate.user_id == user_id,
                    Certificate.video_id == course["video_id"],
                    Certificate.company_id == company_id,
                    Certificate.status == "Valid",
                )
                .order_by(Certificate.issue_date.desc(), Certificate.certificate_id.desc())
                .limit(1)
            )
            certificate = certificate_result.scalar_one_or_none()

            history_rows.append(
                {
                    "video_id": course["video_id"],
                    "course_name": course["title"],
                    "status": course["status"],
                    "completion_percent": course["completion_percent"],
                    "completion_date": course["completed_at"],
                    "assessment_score": float(assessment.score) if assessment else None,
                    "assessment_result": assessment.result if assessment else None,
                    "certificate_number": (certificate.certificate_number if certificate else None),
                    "due_date": course["due_date"],
                }
            )

        return history_rows

    def assignment_match_for_user(self, user: UserMaster):
        matches = [
            and_(
                CourseAssignment.assign_type == "Individual",
                CourseAssignment.assigned_to_user_id == user.user_id,
            ),
            CourseAssignment.assign_type == "Company-Wide",
        ]
        if user.department:
            matches.append(
                and_(
                    CourseAssignment.assign_type == "Department",
                    CourseAssignment.assigned_to_department == user.department,
                )
            )
        return or_(*matches)
