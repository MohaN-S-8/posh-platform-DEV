import os
import uuid
from typing import Optional

import magic  # python-magic for real MIME type detection
from fastapi import HTTPException, UploadFile, status
from sqlalchemy import and_, delete, func, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.storage import generate_presigned_url, upload_file
from app.models.training import (
    AssessmentOption,
    AssessmentQuestion,
    AssessmentResult,
    CourseAssignment,
    TrainingHistory,
)
from app.models.user import UserMaster
from app.models.video import VideoMaster
from app.schemas.video import VideoCreate, VideoUpdate

ALLOWED_MIME_TYPES = {"video/mp4", "video/x-msvideo", "video/quicktime"}
ALLOWED_EXTENSIONS = {".mp4", ".avi", ".mov"}
ALLOWED_AUDIO_MIME_TYPES = {"audio/mpeg", "audio/mp4", "audio/wav", "audio/x-wav", "audio/aac"}
ALLOWED_SUBTITLE_MIME_TYPES = {"text/vtt", "text/plain", "application/octet-stream"}
MAX_FILE_SIZE_BYTES = 500 * 1024 * 1024  # 500 MB

VIDEO_BUCKET = os.environ.get("MINIO_BUCKET_VIDEOS", "posh-videos")


class VideoService:
    async def _get_company_video(self, db: AsyncSession, video_id: int, company_id: int):
        result = await db.execute(
            select(VideoMaster).where(
                VideoMaster.video_id == video_id,
                VideoMaster.company_id == company_id,
            )
        )
        video = result.scalar_one_or_none()
        if not video:
            raise HTTPException(404, "Video not found.")
        return video

    async def upload_video(
        self,
        db: AsyncSession,
        file: UploadFile,
        metadata: VideoCreate,
        uploaded_by: int,
        company_id: int,
        quality_label: str = "720p",
        transcript_text: Optional[str] = None,
    ) -> VideoMaster:
        """Upload a video file and save metadata."""

        # 1. Read file bytes
        file_bytes = await file.read()

        # 2. Check file size
        if len(file_bytes) > MAX_FILE_SIZE_BYTES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File size exceeds maximum limit of 500MB.",
            )

        # 3. Check MIME type using magic bytes (NOT just file extension)
        # This prevents attackers from renaming malware.exe to video.mp4
        mime_type = magic.from_buffer(file_bytes[:2048], mime=True)
        if mime_type not in ALLOWED_MIME_TYPES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported file format. Allowed: MP4, AVI, MOV. Got: {mime_type}",
            )

        # 4. Generate unique storage path
        file_ext = os.path.splitext(file.filename or "video.mp4")[1].lower()
        object_key = f"videos/{company_id}/{uuid.uuid4()}{file_ext}"

        # 5. Upload to MinIO
        upload_file(file_bytes, VIDEO_BUCKET, object_key, mime_type)

        # 6. Save metadata to DB (store path, not URL)
        video = VideoMaster(
            title=metadata.title,
            description=metadata.description,
            category_id=metadata.category_id,
            duration_minutes=metadata.duration_minutes,
            video_url=object_key,  # path only — never a public URL
            storage_type="MinIO",
            status="Draft",
            created_by=uploaded_by,
            company_id=company_id,
        )
        db.add(video)
        await db.commit()
        await db.refresh(video)
        await db.execute(
            text(
                """
                INSERT INTO video_quality (video_id, company_id, quality_label, video_path, mime_type)
                VALUES (:video_id, :company_id, :quality_label, :video_path, :mime_type)
                """
            ),
            {
                "video_id": video.video_id,
                "company_id": company_id,
                "quality_label": quality_label,
                "video_path": object_key,
                "mime_type": mime_type,
            },
        )
        if transcript_text:
            transcript_key = f"videos/{company_id}/transcripts/{video.video_id}-english.vtt"
            transcript_body = transcript_text.strip()
            if not transcript_body.startswith("WEBVTT"):
                transcript_body = f"WEBVTT\n\n00:00:00.000 --> 99:59:59.000\n{transcript_body}"
            upload_file(transcript_body.encode("utf-8"), VIDEO_BUCKET, transcript_key, "text/vtt")
            await db.execute(
                text(
                    """
                    INSERT INTO video_language (video_id, language_id, subtitle_path)
                    VALUES (:video_id, 1, :subtitle_path)
                    """
                ),
                {"video_id": video.video_id, "subtitle_path": transcript_key},
            )
        await db.commit()
        return video

    async def upload_quality_variant(
        self,
        db: AsyncSession,
        video_id: int,
        company_id: int,
        file: UploadFile,
        quality_label: str,
    ) -> dict:
        await self._get_company_video(db, video_id, company_id)
        if quality_label not in {"360p", "480p", "720p", "1080p"}:
            raise HTTPException(400, "Quality must be 360p, 480p, 720p, or 1080p.")

        file_bytes = await file.read()
        if len(file_bytes) > MAX_FILE_SIZE_BYTES:
            raise HTTPException(400, "File size exceeds maximum limit of 500MB.")

        mime_type = magic.from_buffer(file_bytes[:2048], mime=True)
        if mime_type not in ALLOWED_MIME_TYPES:
            raise HTTPException(400, f"Unsupported video format. Got: {mime_type}")

        file_ext = os.path.splitext(file.filename or "variant.mp4")[1].lower()
        object_key = (
            f"videos/{company_id}/qualities/{video_id}-{quality_label}-{uuid.uuid4()}{file_ext}"
        )
        upload_file(file_bytes, VIDEO_BUCKET, object_key, mime_type)
        await db.execute(
            text(
                """
                INSERT INTO video_quality (video_id, company_id, quality_label, video_path, mime_type)
                VALUES (:video_id, :company_id, :quality_label, :video_path, :mime_type)
                ON DUPLICATE KEY UPDATE
                    video_path = VALUES(video_path),
                    mime_type = VALUES(mime_type)
                """
            ),
            {
                "video_id": video_id,
                "company_id": company_id,
                "quality_label": quality_label,
                "video_path": object_key,
                "mime_type": mime_type,
            },
        )
        await db.commit()
        return {"message": f"{quality_label} quality uploaded.", "quality_label": quality_label}

    async def upload_language_track(
        self,
        db: AsyncSession,
        video_id: int,
        company_id: int,
        language_id: int,
        subtitle_file: Optional[UploadFile] = None,
        audio_file: Optional[UploadFile] = None,
    ) -> dict:
        await self._get_company_video(db, video_id, company_id)
        if not subtitle_file and not audio_file:
            raise HTTPException(400, "Upload a subtitle file, audio file, or both.")

        subtitle_key = None
        audio_key = None
        if subtitle_file:
            subtitle_bytes = await subtitle_file.read()
            subtitle_mime = magic.from_buffer(subtitle_bytes[:2048], mime=True)
            if subtitle_mime not in ALLOWED_SUBTITLE_MIME_TYPES:
                raise HTTPException(400, f"Unsupported subtitle format. Got: {subtitle_mime}")
            subtitle_key = (
                f"videos/{company_id}/subtitles/{video_id}-{language_id}-{uuid.uuid4()}.vtt"
            )
            body = subtitle_bytes
            if not subtitle_bytes.lstrip().startswith(b"WEBVTT"):
                text_body = subtitle_bytes.decode("utf-8", errors="ignore").strip()
                body = f"WEBVTT\n\n00:00:00.000 --> 99:59:59.000\n{text_body}".encode("utf-8")
            upload_file(body, VIDEO_BUCKET, subtitle_key, "text/vtt")

        if audio_file:
            audio_bytes = await audio_file.read()
            audio_mime = magic.from_buffer(audio_bytes[:2048], mime=True)
            if audio_mime not in ALLOWED_AUDIO_MIME_TYPES:
                raise HTTPException(400, f"Unsupported audio format. Got: {audio_mime}")
            audio_ext = os.path.splitext(audio_file.filename or "audio.mp3")[1].lower()
            audio_key = (
                f"videos/{company_id}/audio/{video_id}-{language_id}-{uuid.uuid4()}{audio_ext}"
            )
            upload_file(audio_bytes, VIDEO_BUCKET, audio_key, audio_mime)

        existing = await db.execute(
            text(
                """
                SELECT id, subtitle_path, audio_url
                FROM video_language
                WHERE video_id = :video_id AND language_id = :language_id
                LIMIT 1
                """
            ),
            {"video_id": video_id, "language_id": language_id},
        )
        row = existing.first()
        if row:
            await db.execute(
                text(
                    """
                    UPDATE video_language
                    SET subtitle_path = COALESCE(:subtitle_path, subtitle_path),
                        audio_url = COALESCE(:audio_url, audio_url)
                    WHERE id = :id
                    """
                ),
                {"id": row.id, "subtitle_path": subtitle_key, "audio_url": audio_key},
            )
        else:
            await db.execute(
                text(
                    """
                    INSERT INTO video_language (video_id, language_id, subtitle_path, audio_url)
                    VALUES (:video_id, :language_id, :subtitle_path, :audio_url)
                    """
                ),
                {
                    "video_id": video_id,
                    "language_id": language_id,
                    "subtitle_path": subtitle_key,
                    "audio_url": audio_key,
                },
            )
        await db.commit()
        return {"message": "Language track uploaded.", "language_id": language_id}

    async def get_stream_url(
        self, db: AsyncSession, video_id: int, user_id: int, company_id: int
    ) -> dict:
        """
        Generate a short-lived signed URL for video streaming.
        Verifies the user is assigned this course first.
        """
        # Verify video exists and belongs to this company
        result = await db.execute(
            select(VideoMaster).where(
                VideoMaster.video_id == video_id,
                VideoMaster.company_id == company_id,
                VideoMaster.status == "Published",
            )
        )
        video = result.scalar_one_or_none()
        if not video:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Video not found or not yet published.",
            )

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
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

        assignment_matches = [
            and_(
                CourseAssignment.assign_type == "Individual",
                CourseAssignment.assigned_to_user_id == user_id,
            ),
            CourseAssignment.assign_type == "Company-Wide",
        ]
        if user.department:
            assignment_matches.append(
                and_(
                    CourseAssignment.assign_type == "Department",
                    CourseAssignment.assigned_to_department == user.department,
                )
            )

        # Verify this specific user is assigned this course.
        assigned = await db.execute(
            select(CourseAssignment.id)
            .where(
                CourseAssignment.video_id == video_id,
                CourseAssignment.company_id == company_id,
                or_(*assignment_matches),
            )
            .limit(1)
        )
        if assigned.scalar_one_or_none() is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not assigned to this course.",
            )

        # Generate signed URL (expires in 5 minutes)
        quality_result = await db.execute(
            text(
                """
                SELECT quality_label, video_path
                FROM video_quality
                WHERE video_id = :video_id AND company_id = :company_id
                ORDER BY FIELD(quality_label, '360p', '480p', '720p', '1080p'), quality_label
                """
            ),
            {"video_id": video_id, "company_id": company_id},
        )
        qualities = [
            {
                "label": row.quality_label,
                "stream_url": generate_presigned_url(VIDEO_BUCKET, row.video_path, 300),
            }
            for row in quality_result
        ]
        if not qualities:
            qualities = [
                {
                    "label": "source",
                    "stream_url": generate_presigned_url(VIDEO_BUCKET, video.video_url, 300),
                }
            ]

        subtitle_result = await db.execute(
            text(
                """
                SELECT vl.language_id, lm.language_name, vl.subtitle_path, vl.audio_url
                FROM video_language vl
                JOIN language_master lm ON lm.language_id = vl.language_id
                WHERE vl.video_id = :video_id AND vl.subtitle_path IS NOT NULL
                """
            ),
            {"video_id": video_id},
        )
        subtitles = [
            {
                "language_id": row.language_id,
                "language_name": row.language_name,
                "subtitle_url": (
                    generate_presigned_url(VIDEO_BUCKET, row.subtitle_path, 300)
                    if row.subtitle_path
                    else None
                ),
                "audio_url": (
                    generate_presigned_url(VIDEO_BUCKET, row.audio_url, 300)
                    if row.audio_url
                    else None
                ),
            }
            for row in subtitle_result
        ]

        # Initialize training history if not exists
        history_result = await db.execute(
            select(TrainingHistory).where(
                TrainingHistory.user_id == user_id,
                TrainingHistory.video_id == video_id,
            )
        )
        history = history_result.scalar_one_or_none()

        if not history:
            from datetime import datetime, timezone

            history = TrainingHistory(
                user_id=user_id,
                video_id=video_id,
                company_id=company_id,
                total_seconds=(video.duration_minutes or 0) * 60,
                status="In Progress",
                started_at=datetime.now(timezone.utc),
            )
            db.add(history)
            await db.commit()

        return {
            "stream_url": qualities[0]["stream_url"],
            "qualities": qualities,
            "subtitles": subtitles,
            "resume_position": (
                max(
                    int(history.last_watched_position or 0),
                    int(history.furthest_position or 0),
                )
                if history
                else 0
            ),
            "furthest_position": int(history.furthest_position or 0) if history else 0,
            "watched_seconds": int(history.watched_seconds or 0) if history else 0,
            "completion_percent": float(history.completion_percent) if history else 0,
        }

    async def update_progress(
        self,
        db: AsyncSession,
        video_id: int,
        user_id: int,
        current_position: int,
        total_duration: int,
    ) -> dict:
        """
        Update video watch progress.
        Enforces mandatory viewing. Resume position follows the player's current
        timestamp, but completion is based on accumulated watched time.
        """
        result = await db.execute(
            select(TrainingHistory).where(
                TrainingHistory.user_id == user_id,
                TrainingHistory.video_id == video_id,
            )
        )
        history = result.scalar_one_or_none()

        if not history:
            raise HTTPException(404, "No training history found. Start the video first.")

        current_position = max(0, int(current_position or 0))
        total_duration = max(0, int(total_duration or history.total_seconds or 0))
        previous_last = int(history.last_watched_position or 0)
        previous_furthest = int(history.furthest_position or 0)
        previous_watched = int(history.watched_seconds or 0)

        from datetime import datetime, timezone

        now = datetime.now(timezone.utc)
        last_progress_at = history.updated_date or history.started_at
        if last_progress_at and last_progress_at.tzinfo is None:
            last_progress_at = last_progress_at.replace(tzinfo=timezone.utc)
        elapsed_since_save = (
            max(0, int((now - last_progress_at).total_seconds())) if last_progress_at else 0
        )

        # Player saves every 10s. A small tolerance avoids false positives from
        # timer drift/buffering while still blocking jump-to-end completion.
        allowed_forward_jump = 15
        jumped_beyond_watched_range = current_position > previous_furthest + allowed_forward_jump
        jumped_beyond_last_tick = current_position > previous_last + allowed_forward_jump
        if jumped_beyond_watched_range and jumped_beyond_last_tick:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Skipping required portions is not allowed. Please watch the video in sequence.",
            )

        forward_delta = max(0, current_position - previous_last)
        if current_position <= previous_furthest:
            forward_delta = 0
        elif forward_delta > allowed_forward_jump:
            forward_delta = allowed_forward_jump

        if forward_delta > 0 and last_progress_at:
            forward_delta = min(forward_delta, elapsed_since_save + 2)

        watched_seconds = previous_watched + forward_delta
        if current_position >= previous_furthest:
            watched_seconds = max(watched_seconds, current_position)
        if total_duration > 0:
            watched_seconds = min(watched_seconds, total_duration)
            history.total_seconds = total_duration

        if current_position >= previous_last or current_position >= previous_furthest - 5:
            history.last_watched_position = current_position
        history.watched_seconds = watched_seconds

        if current_position > previous_furthest:
            history.furthest_position = current_position

        if total_duration > 0:
            percent = (watched_seconds / total_duration) * 100
            history.completion_percent = round(min(percent, 100), 2)

        reached_end = total_duration > 0 and current_position >= max(0, total_duration - 1)
        if reached_end:
            history.watched_seconds = total_duration
            history.furthest_position = max(previous_furthest, total_duration)
            history.last_watched_position = total_duration
            history.completion_percent = 100

        # Mark as completed when >= 95% watched or player reaches the end.
        if (history.completion_percent >= 95 or reached_end) and history.status != "Completed":
            history.status = "Completed"
            from datetime import datetime, timezone

            history.completed_at = datetime.now(timezone.utc)

        await db.commit()

        return {
            "completion_percent": float(history.completion_percent),
            "watched_seconds": int(history.watched_seconds or 0),
            "furthest_position": int(history.furthest_position or 0),
            "last_watched_position": int(history.last_watched_position or 0),
            "status": history.status,
            "assessment_unlocked": history.status == "Completed",
        }

    async def publish_video(self, db: AsyncSession, video_id: int, company_id: int) -> VideoMaster:
        result = await db.execute(
            select(VideoMaster).where(
                VideoMaster.video_id == video_id,
                VideoMaster.company_id == company_id,
            )
        )
        video = result.scalar_one_or_none()
        if not video:
            raise HTTPException(404, "Video not found.")
        video.status = "Published"
        await db.commit()
        return video

    async def update_video(
        self, db: AsyncSession, video_id: int, company_id: int, data: VideoUpdate
    ) -> VideoMaster:
        video = await self._get_company_video(db, video_id, company_id)
        update_data = data.model_dump(exclude_unset=True)
        if "status" in update_data and update_data["status"] not in {
            "Draft",
            "Published",
            "Archived",
        }:
            raise HTTPException(400, "Status must be Draft, Published, or Archived.")

        for field, value in update_data.items():
            setattr(video, field, value)
        await db.commit()
        await db.refresh(video)
        return video

    async def archive_video(self, db: AsyncSession, video_id: int, company_id: int) -> VideoMaster:
        video = await self._get_company_video(db, video_id, company_id)
        video.status = "Archived"
        await db.commit()
        return video

    async def delete_video(self, db: AsyncSession, video_id: int, company_id: int) -> dict:
        video = await self._get_company_video(db, video_id, company_id)
        usage_result = await db.execute(
            select(func.count())
            .select_from(CourseAssignment)
            .where(
                CourseAssignment.video_id == video_id,
                CourseAssignment.company_id == company_id,
            )
        )
        history_result = await db.execute(
            select(func.count())
            .select_from(TrainingHistory)
            .where(
                TrainingHistory.video_id == video_id,
                TrainingHistory.company_id == company_id,
            )
        )
        result_result = await db.execute(
            select(func.count())
            .select_from(AssessmentResult)
            .where(AssessmentResult.video_id == video_id)
        )
        if usage_result.scalar_one() or history_result.scalar_one() or result_result.scalar_one():
            raise HTTPException(
                409,
                "This video has assignments or training history. Archive it instead.",
            )

        question_ids_result = await db.execute(
            select(AssessmentQuestion.question_id).where(AssessmentQuestion.video_id == video_id)
        )
        question_ids = list(question_ids_result.scalars().all())
        if question_ids:
            await db.execute(
                delete(AssessmentOption).where(AssessmentOption.question_id.in_(question_ids))
            )
        await db.execute(delete(AssessmentQuestion).where(AssessmentQuestion.video_id == video_id))
        await db.execute(
            text("DELETE FROM video_language WHERE video_id = :video_id"),
            {"video_id": video_id},
        )
        await db.execute(
            text(
                """
                DELETE FROM video_quality
                WHERE video_id = :video_id AND company_id = :company_id
                """
            ),
            {"video_id": video_id, "company_id": company_id},
        )
        await db.delete(video)
        await db.commit()
        return {"message": "Video deleted successfully."}

    async def list_videos(self, db: AsyncSession, company_id: int):
        result = await db.execute(
            select(VideoMaster)
            .where(VideoMaster.company_id == company_id)
            .order_by(VideoMaster.created_date.desc())
        )
        return result.scalars().all()

    async def list_published_videos(self, db: AsyncSession, company_id: int) -> list:
        """List only published videos — used by HR assignment dropdown."""
        result = await db.execute(
            select(VideoMaster)
            .where(
                VideoMaster.company_id == company_id,
                VideoMaster.status == "Published",
            )
            .order_by(VideoMaster.title)
        )
        return result.scalars().all()
