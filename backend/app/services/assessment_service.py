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
from app.models.video import VideoMaster
from app.schemas.assessment import AssessmentQuestionCreate, AssessmentSubmit


class AssessmentService:
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
        completed = bool(history and history.status == "Completed")
        return {
            "available": completed and question_count > 0,
            "video_completed": completed,
            "question_count": question_count,
            "message": (
                "Assessment is available."
                if completed and question_count > 0
                else "Please complete the training video before taking the assessment."
            ),
        }

    async def questions(self, db: AsyncSession, video_id: int, company_id: int) -> list[dict]:
        video_result = await db.execute(
            select(VideoMaster).where(
                VideoMaster.video_id == video_id,
                VideoMaster.company_id == company_id,
                VideoMaster.status == "Published",
            )
        )
        if not video_result.scalar_one_or_none():
            raise HTTPException(404, "Video not found.")

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
        if not history_result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Please complete the training video before taking the assessment.",
            )

        # 2. Count attempt number
        attempt_result = await db.execute(
            select(func.count()).where(
                AssessmentResult.user_id == user_id,
                AssessmentResult.video_id == data.video_id,
            )
        )
        attempt_number = (attempt_result.scalar() or 0) + 1

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
            response["message"] = (
                f"Score: {score:.1f}%. " f"You need {passing_score}% to pass. Please retry."
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
