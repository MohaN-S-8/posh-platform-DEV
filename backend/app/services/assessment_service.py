from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

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


class AssessmentService:
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

    async def availability(
        self, db: AsyncSession, video_id: int, user_id: int, company_id: int
    ) -> dict:
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
        available = completed and question_count > 0 and not attempt_blocks
        if available:
            message = "Assessment is available."
        elif latest_attempt and latest_attempt.result == "Pass":
            message = "Assessment has already been passed for this course."
        elif latest_attempt and latest_attempt.result == "Fail":
            message = "Please rewatch the training video to unlock another assessment attempt."
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
            "message": message,
        }

    async def questions(
        self, db: AsyncSession, video_id: int, company_id: int, user_id: int
    ) -> list[dict]:
        video_result = await db.execute(
            select(VideoMaster).where(
                VideoMaster.video_id == video_id,
                VideoMaster.company_id == company_id,
                VideoMaster.status == "Published",
            )
        )
        if not video_result.scalar_one_or_none():
            raise HTTPException(404, "Video not found.")

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
        if self._attempt_blocks_assessment(history, latest_attempt):
            if latest_attempt and latest_attempt.result == "Fail":
                raise HTTPException(
                    409,
                    "Please rewatch the training video to unlock another assessment attempt.",
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
        return response

    async def submit(
        self, db: AsyncSession, user_id: int, data: AssessmentSubmit, company_id: int
    ) -> dict:
        """Submit assessment answers. Video must be completed first."""

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
                "Please rewatch the training video to unlock another assessment attempt."
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
                f" on {video.title if video else 'assigned training'}."
            ),
        )
        await db.commit()

        response = {
            "score": round(score, 2),
            "correct": correct,
            "total": total,
            "result": result,
            "attempt_number": attempt_number,
            "certificate_triggered": result == "Pass",
        }

        # 5. Trigger certificate generation on Pass
        # 5. Trigger certificate generation on Pass (via Celery — non-blocking)
        if result == "Pass":
            from app.workers.celery_app import generate_certificate_task

            generate_certificate_task.delay(user_id, data.video_id, company_id)
            response["message"] = (
                "Congratulations! You passed. "
                "Your certificate is being generated and will be emailed to you."
            )
        else:
            history.watched_seconds = 0
            history.completion_percent = 0
            history.furthest_position = 0
            history.last_watched_position = 0
            history.status = "In Progress"
            history.completed_at = None
            await db.commit()
            response["message"] = (
                f"Score: {score:.1f}%. "
                f"You need {passing_score}% to pass. Please rewatch the training video to unlock another attempt."
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
        return {"message": "Assessment question created.", "question_id": question.question_id}

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
