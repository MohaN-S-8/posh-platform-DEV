import hashlib
import random
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import _matrix_access_decision
from app.models.company import CompanyMaster
from app.models.training import (
    AssessmentOption,
    AssessmentQuestion,
    AssessmentResult,
    CourseAssignment,
    TrainingHistory,
)
from app.models.user import UserMaster
from app.models.video import VideoMaster
from app.schemas.assessment import AssessmentQuestionCreate, AssessmentSubmit
from app.services.notification_service import notification_service

REQUIRED_TRAINING_VIDEO_COUNT = 5


class AssessmentService:
    async def _certificate_auto_issue_enabled(self, db: AsyncSession, company_id: int) -> bool:
        result = await db.execute(
            select(CompanyMaster.certificate_issue_mode).where(
                CompanyMaster.company_id == company_id,
                CompanyMaster.is_deleted == "N",
            )
        )
        issue_mode = result.scalar_one_or_none() or "Automatic"
        return issue_mode == "Automatic"

    async def _ensure_video_available_for_user(
        self, db: AsyncSession, video_id: int, user_id: int, company_id: int
    ) -> VideoMaster:
        video_result = await db.execute(
            select(VideoMaster).where(
                VideoMaster.video_id == video_id,
                VideoMaster.company_id == company_id,
                VideoMaster.status == "Published",
            )
        )
        video = video_result.scalar_one_or_none()
        if not video:
            raise HTTPException(404, "Video not found.")

        user_result = await db.execute(
            select(UserMaster).where(
                UserMaster.user_id == user_id,
                UserMaster.company_id == company_id,
                UserMaster.status == "Active",
                UserMaster.is_deleted == "N",
            )
        )
        user = user_result.scalar_one_or_none()
        audience_role_ids = {
            "IC Member": [3],
            "IC PoSH": [3],
            "Employee": [4],
            "All": [3, 4],
        }.get(
            video.target_audience or "Employee",
            [4],
        )
        if not user or user.role_id not in audience_role_ids:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This assessment is not available to your user type.",
            )
        access_item = (
            "IC Member Training" if video.target_audience == "IC Member" else "PoSH Training"
        )
        decision = await _matrix_access_decision(db, user.role_id, [access_item])
        if decision is False:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to access this resource.",
            )
        return video

    def _attempt_blocks_assessment(self, history, latest_attempt) -> bool:
        if not latest_attempt:
            return False
        if latest_attempt.result == "Pass":
            return True
        return not (
            history
            and history.status == "Completed"
            and float(history.completion_percent or 0) >= 95
        )

    async def _required_training_status(
        self,
        db: AsyncSession,
        user_id: int,
        company_id: int,
        target_audience: str | None = None,
    ) -> dict:
        user_result = await db.execute(
            select(UserMaster).where(
                UserMaster.user_id == user_id,
                UserMaster.company_id == company_id,
                UserMaster.status == "Active",
                UserMaster.is_deleted == "N",
            )
        )
        user = user_result.scalar_one_or_none()
        if not user:
            raise HTTPException(404, "User not found.")

        if user.role_id == 3 and target_audience == "IC Member":
            audience_matches = [
                VideoMaster.target_audience == "IC Member",
                VideoMaster.target_audience == "All",
            ]
        elif user.role_id == 3:
            audience_matches = [
                VideoMaster.target_audience == "IC PoSH",
                VideoMaster.target_audience == "All",
            ]
        else:
            audience_matches = [
                VideoMaster.target_audience == "Employee",
                VideoMaster.target_audience == "All",
                VideoMaster.target_audience.is_(None),
            ]

        result = await db.execute(
            select(VideoMaster.video_id, TrainingHistory.status)
            .outerjoin(
                TrainingHistory,
                (TrainingHistory.user_id == user_id)
                & (TrainingHistory.video_id == VideoMaster.video_id)
                & (TrainingHistory.company_id == company_id),
            )
            .where(
                VideoMaster.company_id == company_id,
                VideoMaster.status == "Published",
                or_(*audience_matches),
            )
            .order_by(VideoMaster.training_level.asc(), VideoMaster.title.asc())
            .limit(REQUIRED_TRAINING_VIDEO_COUNT)
        )
        rows = result.all()
        completed = sum(1 for row in rows if row.status == "Completed")
        return {
            "required": REQUIRED_TRAINING_VIDEO_COUNT,
            "total": len(rows),
            "completed": completed,
            "complete": len(rows) >= REQUIRED_TRAINING_VIDEO_COUNT
            and completed >= REQUIRED_TRAINING_VIDEO_COUNT,
        }

    async def availability(
        self, db: AsyncSession, video_id: int, user_id: int, company_id: int
    ) -> dict:
        video = await self._ensure_video_available_for_user(db, video_id, user_id, company_id)
        history_result = await db.execute(
            select(TrainingHistory).where(
                TrainingHistory.user_id == user_id,
                TrainingHistory.video_id == video_id,
                TrainingHistory.company_id == company_id,
            )
        )
        history = history_result.scalar_one_or_none()
        question_count_result = await db.execute(
            select(func.count()).where(AssessmentQuestion.video_id == video_id)
        )
        question_count = question_count_result.scalar() or 0
        required_status = await self._required_training_status(
            db,
            user_id,
            company_id,
            video.target_audience,
        )
        attempt_result = await db.execute(
            select(AssessmentResult)
            .where(
                AssessmentResult.user_id == user_id,
                AssessmentResult.video_id == video_id,
            )
            .order_by(AssessmentResult.attempted_at.desc(), AssessmentResult.id.desc())
            .limit(1)
        )
        latest_attempt = attempt_result.scalar_one_or_none()
        completed = bool(history and history.status == "Completed")
        attempted = latest_attempt is not None
        attempt_blocks = self._attempt_blocks_assessment(history, latest_attempt)
        available = (
            completed and required_status["complete"] and question_count > 0 and not attempt_blocks
        )
        if available:
            message = "Assessment is available."
        elif latest_attempt and latest_attempt.result == "Pass":
            message = "Assessment has already been passed for this course."
        elif latest_attempt and latest_attempt.result == "Fail":
            message = "You can retake the assessment because your training videos are complete."
        elif not required_status["complete"]:
            message = (
                f"Complete all {required_status['required']} required training videos before "
                f"taking the assessment. Completed: {required_status['completed']}/{required_status['required']}."
            )
        elif question_count == 0:
            message = "No assessment questions have been configured for this video yet."
        else:
            message = "Please complete the training video before taking the assessment."
        return {
            "available": available,
            "video_completed": completed,
            "question_count": question_count,
            "attempted": attempted,
            "attempt_number": latest_attempt.attempt_number if latest_attempt else 0,
            "result": latest_attempt.result if latest_attempt else None,
            "score": float(latest_attempt.score) if latest_attempt else None,
            "required_video_count": required_status["required"],
            "required_completed_count": required_status["completed"],
            "message": message,
        }

    async def questions(
        self, db: AsyncSession, video_id: int, company_id: int, user_id: int
    ) -> list[dict]:
        await self._ensure_video_available_for_user(db, video_id, user_id, company_id)

        attempt_result = await db.execute(
            select(AssessmentResult)
            .where(
                AssessmentResult.user_id == user_id,
                AssessmentResult.video_id == video_id,
            )
            .order_by(AssessmentResult.attempted_at.desc(), AssessmentResult.id.desc())
            .limit(1)
        )
        latest_attempt = attempt_result.scalar_one_or_none()
        history_result = await db.execute(
            select(TrainingHistory).where(
                TrainingHistory.user_id == user_id,
                TrainingHistory.video_id == video_id,
                TrainingHistory.company_id == company_id,
            )
        )
        history = history_result.scalar_one_or_none()
        video_result = await db.execute(
            select(VideoMaster.target_audience).where(
                VideoMaster.video_id == video_id,
                VideoMaster.company_id == company_id,
            )
        )
        required_status = await self._required_training_status(
            db,
            user_id,
            company_id,
            video_result.scalar_one_or_none(),
        )
        if not required_status["complete"]:
            raise HTTPException(
                400,
                (
                    f"Complete all {required_status['required']} required training videos before "
                    f"taking the assessment. Completed: {required_status['completed']}/{required_status['required']}."
                ),
            )
        if self._attempt_blocks_assessment(history, latest_attempt):
            if latest_attempt and latest_attempt.result == "Fail":
                raise HTTPException(
                    409,
                    "Complete the required training videos before another assessment attempt.",
                )
            raise HTTPException(409, "Assessment has already been passed for this course.")

        question_result = await db.execute(
            select(AssessmentQuestion)
            .where(AssessmentQuestion.video_id == video_id)
            .order_by(AssessmentQuestion.question_id)
        )
        questions = question_result.scalars().all()
        response = []
        for question in questions:
            option_result = await db.execute(
                select(AssessmentOption)
                .where(AssessmentOption.question_id == question.question_id)
                .order_by(AssessmentOption.option_label)
            )
            response.append(
                {
                    "question_id": question.question_id,
                    "video_id": question.video_id,
                    "question_text": question.question_text,
                    "question_type": question.question_type,
                    "options": option_result.scalars().all(),
                }
            )
        next_attempt_number = (latest_attempt.attempt_number if latest_attempt else 0) + 1
        seed = hashlib.sha256(
            f"{user_id}:{video_id}:{next_attempt_number}".encode("utf-8")
        ).hexdigest()
        random.Random(seed).shuffle(response)
        return response

    async def submit(
        self, db: AsyncSession, user_id: int, data: AssessmentSubmit, company_id: int
    ) -> dict:
        """Submit assessment answers. Video must be completed first."""
        await self._ensure_video_available_for_user(db, data.video_id, user_id, company_id)

        # 1. Verify video is completed
        history_result = await db.execute(
            select(TrainingHistory).where(
                TrainingHistory.user_id == user_id,
                TrainingHistory.video_id == data.video_id,
                TrainingHistory.status == "Completed",
            )
        )
        history = history_result.scalar_one_or_none()
        if not history:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Please complete the training video before taking the assessment.",
            )
        video_result = await db.execute(
            select(VideoMaster.target_audience).where(
                VideoMaster.video_id == data.video_id,
                VideoMaster.company_id == company_id,
            )
        )
        required_status = await self._required_training_status(
            db,
            user_id,
            company_id,
            video_result.scalar_one_or_none(),
        )
        if not required_status["complete"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Complete all {required_status['required']} required training videos before "
                    f"taking the assessment. Completed: {required_status['completed']}/{required_status['required']}."
                ),
            )

        existing_attempt = await db.execute(
            select(AssessmentResult)
            .where(
                AssessmentResult.user_id == user_id,
                AssessmentResult.video_id == data.video_id,
            )
            .order_by(AssessmentResult.attempted_at.desc(), AssessmentResult.id.desc())
            .limit(1)
        )
        latest_attempt = existing_attempt.scalar_one_or_none()
        if self._attempt_blocks_assessment(history, latest_attempt):
            detail = (
                "Complete the required training videos before another assessment attempt."
                if latest_attempt and latest_attempt.result == "Fail"
                else "Assessment has already been passed for this course."
            )
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=detail,
            )

        # 2. Count attempt number
        attempt_count_result = await db.execute(
            select(func.count()).where(
                AssessmentResult.user_id == user_id,
                AssessmentResult.video_id == data.video_id,
            )
        )
        attempt_number = int(attempt_count_result.scalar() or 0) + 1

        # 3. Score the answers
        correct = 0
        total = len(data.answers)

        for answer in data.answers:
            q_result = await db.execute(
                select(AssessmentQuestion).where(
                    AssessmentQuestion.question_id == answer.question_id,
                    AssessmentQuestion.video_id == data.video_id,
                )
            )
            question = q_result.scalar_one_or_none()
            if question and question.correct_option == answer.selected_option.upper():
                correct += 1

        score = (correct / total * 100) if total > 0 else 0
        passing_score_result = await db.execute(
            select(CourseAssignment.passing_score).where(
                CourseAssignment.video_id == data.video_id,
                CourseAssignment.company_id == company_id,
            )
        )
        passing_score = float(passing_score_result.scalar() or 70.0)
        result = "Pass" if score >= passing_score else "Fail"

        # 4. Save result
        assessment_result = AssessmentResult(
            user_id=user_id,
            video_id=data.video_id,
            total_questions=total,
            correct_answers=correct,
            score=score,
            passing_score=passing_score,
            result=result,
            attempt_number=attempt_number,
        )
        db.add(assessment_result)

        user_result = await db.execute(
            select(UserMaster).where(
                UserMaster.user_id == user_id,
                UserMaster.company_id == company_id,
            )
        )
        user = user_result.scalar_one_or_none()
        video_result = await db.execute(
            select(VideoMaster).where(
                VideoMaster.video_id == data.video_id,
                VideoMaster.company_id == company_id,
            )
        )
        video = video_result.scalar_one_or_none()
        watcher_ids = await notification_service.course_watcher_ids(
            db,
            company_id=company_id,
            video_id=data.video_id,
            employee_department=user.department if user else None,
        )
        await notification_service.create_for_user_ids(
            db,
            user_ids=watcher_ids,
            company_id=company_id,
            title=f"Assessment {result.lower()}",
            message=(
                f"{user.first_name if user else 'An employee'} scored {score:.1f}%"
                f" on {video.title if video else 'available training'}."
            ),
        )
        await db.commit()

        response = {
            "score": round(score, 2),
            "correct": correct,
            "total": total,
            "result": result,
            "attempt_number": attempt_number,
            "certificate_triggered": False,
        }

        # 5. Trigger certificate generation on Pass
        # 5. Trigger certificate generation on Pass (via Celery — non-blocking)
        if result == "Pass":
            if await self._certificate_auto_issue_enabled(db, company_id):
                from app.workers.celery_app import generate_certificate_task

                generate_certificate_task.delay(user_id, data.video_id, company_id)
                response["certificate_triggered"] = True
                response["certificate_issue_mode"] = "Automatic"
                response["message"] = (
                    "Congratulations! You passed. "
                    "Your certificate is being generated and will be emailed to you."
                )
            else:
                response["certificate_issue_mode"] = "Manual"
                response["message"] = (
                    "Congratulations! You passed. "
                    "Your certificate will be issued by your administrator."
                )
        else:
            response["message"] = (
                f"Score: {score:.1f}%. "
                f"You need {passing_score}% to pass. You can retake the assessment without watching the videos again."
            )

        return response

    async def create_question(
        self, db: AsyncSession, data: AssessmentQuestionCreate, company_id: int
    ) -> dict:
        video_result = await db.execute(
            select(VideoMaster.video_id).where(
                VideoMaster.video_id == data.video_id,
                VideoMaster.company_id == company_id,
            )
        )
        if not video_result.scalar_one_or_none():
            raise HTTPException(404, "Video not found for this company.")

        if not data.options:
            raise HTTPException(400, "At least one option is required.")

        correct = data.correct_option.strip().upper()
        option_labels = {option.option_label.strip().upper() for option in data.options}
        if correct not in option_labels:
            raise HTTPException(400, "Correct option must match one of the option labels.")

        question = AssessmentQuestion(
            video_id=data.video_id,
            question_text=data.question_text.strip(),
            question_type=data.question_type,
            correct_option=correct,
        )
        db.add(question)
        await db.flush()

        for option in data.options:
            db.add(
                AssessmentOption(
                    question_id=question.question_id,
                    option_label=option.option_label.strip().upper(),
                    option_text=option.option_text.strip(),
                )
            )
        await db.commit()
        return {
            "message": "Assessment question created.",
            "question_id": question.question_id,
        }

    async def delete_question(self, db: AsyncSession, question_id: int, company_id: int) -> dict:
        question_result = await db.execute(
            select(AssessmentQuestion)
            .join(VideoMaster, VideoMaster.video_id == AssessmentQuestion.video_id)
            .where(
                AssessmentQuestion.question_id == question_id,
                VideoMaster.company_id == company_id,
            )
        )
        question = question_result.scalar_one_or_none()
        if not question:
            raise HTTPException(404, "Assessment question not found.")

        await db.execute(
            delete(AssessmentOption).where(AssessmentOption.question_id == question_id)
        )
        await db.delete(question)
        await db.commit()
        return {"message": "Assessment question deleted."}
