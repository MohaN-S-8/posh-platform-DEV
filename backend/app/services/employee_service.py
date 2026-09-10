from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.certificate import Certificate
from app.models.training import AssessmentResult, TrainingHistory
from app.models.user import UserMaster
from app.models.video import VideoMaster

REQUIRED_TRAINING_VIDEO_COUNT = 5


class EmployeeService:
    def _audience_matches_for_training(self, role_id: int, training_type: str | None) -> list:
        if role_id == 3 and training_type == "posh":
            return [
                VideoMaster.target_audience == "IC PoSH",
                VideoMaster.target_audience == "All",
            ]
        if role_id == 3:
            return [
                VideoMaster.target_audience == "IC Member",
                VideoMaster.target_audience == "All",
            ]
        return [
            VideoMaster.target_audience == "Employee",
            VideoMaster.target_audience == "All",
            VideoMaster.target_audience.is_(None),
        ]

    def _assessment_unlocked(
        self,
        status: str,
        history,
        assessment,
        required_completed: bool,
    ) -> bool:
        if not required_completed:
            return False
        if status != "Completed":
            return False
        if not assessment:
            return True
        if assessment.result == "Pass":
            return False
        return bool(history and float(history.completion_percent or 0) >= 95)

    async def list_courses(
        self,
        db: AsyncSession,
        user_id: int,
        company_id: int,
        training_type: str | None = None,
    ) -> list[dict]:
        user_result = await db.execute(
            select(UserMaster).where(
                UserMaster.user_id == user_id,
                UserMaster.company_id == company_id,
                UserMaster.status == "Active",
                UserMaster.is_deleted == "N",
            )
        )
        user = user_result.scalar_one()

        audience_matches = self._audience_matches_for_training(user.role_id, training_type)

        result = await db.execute(
            select(VideoMaster, TrainingHistory)
            .outerjoin(
                TrainingHistory,
                and_(
                    TrainingHistory.user_id == user_id,
                    TrainingHistory.video_id == VideoMaster.video_id,
                    TrainingHistory.company_id == company_id,
                ),
            )
            .where(
                VideoMaster.company_id.in_([company_id, 1]),
                VideoMaster.status == "Published",
                or_(*audience_matches),
            )
            .order_by(VideoMaster.training_level.asc(), VideoMaster.title.asc())
        )

        rows = result.all()
        courses = []
        seen_video_ids = set()
        for video, history in rows:
            if video.video_id in seen_video_ids:
                continue
            if len(courses) >= REQUIRED_TRAINING_VIDEO_COUNT:
                break
            seen_video_ids.add(video.video_id)
            status = history.status if history else "Not Started"
            completion_percent = float(history.completion_percent or 0) if history else 0.0
            assessment_result = await db.execute(
                select(AssessmentResult)
                .where(
                    AssessmentResult.user_id == user_id,
                    AssessmentResult.video_id == video.video_id,
                )
                .order_by(AssessmentResult.attempted_at.desc(), AssessmentResult.id.desc())
                .limit(1)
            )
            assessment = assessment_result.scalar_one_or_none()
            courses.append(
                {
                    "assignment_id": video.video_id,
                    "video_id": video.video_id,
                    "title": video.title,
                    "description": video.description,
                    "duration_minutes": video.duration_minutes,
                    "assign_type": "Auto",
                    "due_date": None,
                    "passing_score": 70.0,
                    "status": status,
                    "completion_percent": completion_percent,
                    "resume_position": history.last_watched_position if history else 0,
                    "assessment_unlocked": False,
                    "assessment_attempted": assessment is not None,
                    "assessment_result": assessment.result if assessment else None,
                    "assessment_score": float(assessment.score) if assessment else None,
                    "completed_at": history.completed_at if history else None,
                    "_history": history,
                    "_assessment": assessment,
                }
            )
        completed_required_count = sum(1 for item in courses if item["status"] == "Completed")
        required_completed = (
            len(courses) >= REQUIRED_TRAINING_VIDEO_COUNT
            and completed_required_count >= REQUIRED_TRAINING_VIDEO_COUNT
        )
        for course in courses:
            course["required_video_count"] = REQUIRED_TRAINING_VIDEO_COUNT
            course["required_completed_count"] = completed_required_count
            course["assessment_unlocked"] = self._assessment_unlocked(
                course["status"],
                course.pop("_history", None),
                course.pop("_assessment", None),
                required_completed,
            )
        return courses

    async def summary(
        self,
        db: AsyncSession,
        user_id: int,
        company_id: int,
        training_type: str | None = None,
    ) -> dict:
        courses = await self.list_courses(db, user_id, company_id, training_type)
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

    async def training_history(
        self,
        db: AsyncSession,
        user_id: int,
        company_id: int,
        training_type: str | None = None,
    ) -> list[dict]:
        courses = await self.list_courses(db, user_id, company_id, training_type)
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
