from fastapi import APIRouter, Depends, File, Form, Request, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, require_permission
from app.db.session import get_db
from app.schemas.video import ProgressUpdate, VideoCreate, VideoListResponse, VideoResponse
from app.services.audit_service import write_audit_log
from app.services.video_service import VideoService

router = APIRouter(prefix="/videos", tags=["Video Management"])
video_service = VideoService()


@router.get("/", response_model=list[VideoListResponse])
async def list_videos(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """List all videos for current user's company (all statuses)."""
    return await video_service.list_videos(db, current_user.company_id)


@router.get("/published", response_model=list[VideoListResponse])
async def list_published_videos(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("training.assign")),
):
    """List only published videos — used by HR training assignment dropdown."""
    return await video_service.list_published_videos(db, current_user.company_id)


@router.post("/upload", response_model=VideoResponse, status_code=201)
async def upload_video(
    file: UploadFile = File(...),
    title: str = Form(...),
    description: str = Form(None),
    category_id: int = Form(None),
    duration_minutes: int = Form(None),
    quality_label: str = Form("720p"),
    transcript_text: str = Form(None),
    request: Request = None,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("videos.manage")),
):
    """
    Upload a video file. Accepts MP4, AVI, MOV up to 500MB.
    File is stored securely in MinIO — never publicly accessible.
    Status starts as Draft. Publish separately.
    """
    metadata = VideoCreate(
        title=title,
        description=description,
        category_id=category_id,
        duration_minutes=duration_minutes,
    )
    video = await video_service.upload_video(
        db,
        file,
        metadata,
        current_user.user_id,
        current_user.company_id,
        quality_label,
        transcript_text,
    )
    await write_audit_log(
        db,
        user_id=current_user.user_id,
        company_id=current_user.company_id,
        action="VIDEO_UPLOADED",
        table_name="video_master",
        record_id=video.video_id,
        ip_address=request.client.host if request and request.client else None,
    )
    await db.commit()
    return video


@router.patch("/{video_id}/publish")
async def publish_video(
    video_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("videos.manage")),
):
    """Publish a draft video so employees can watch it."""
    result = await video_service.publish_video(db, video_id, current_user.company_id)
    await write_audit_log(
        db,
        user_id=current_user.user_id,
        company_id=current_user.company_id,
        action="VIDEO_PUBLISHED",
        table_name="video_master",
        record_id=video_id,
        ip_address=request.client.host if request.client else None,
    )
    await db.commit()
    return result


@router.post("/{video_id}/qualities")
async def upload_video_quality_variant(
    video_id: int,
    request: Request,
    file: UploadFile = File(...),
    quality_label: str = Form(...),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("videos.manage")),
):
    """Admin: upload/replace an actual quality variant for a video."""
    result = await video_service.upload_quality_variant(
        db, video_id, current_user.company_id, file, quality_label
    )
    await write_audit_log(
        db,
        user_id=current_user.user_id,
        company_id=current_user.company_id,
        action="VIDEO_QUALITY_UPLOADED",
        table_name="video_quality",
        record_id=video_id,
        ip_address=request.client.host if request.client else None,
    )
    await db.commit()
    return result


@router.post("/{video_id}/language-tracks")
async def upload_video_language_track(
    video_id: int,
    request: Request,
    language_id: int = Form(...),
    subtitle_file: UploadFile = File(None),
    audio_file: UploadFile = File(None),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("videos.manage")),
):
    """Admin: upload subtitles and/or dubbed audio for a video language."""
    result = await video_service.upload_language_track(
        db,
        video_id,
        current_user.company_id,
        language_id,
        subtitle_file,
        audio_file,
    )
    await write_audit_log(
        db,
        user_id=current_user.user_id,
        company_id=current_user.company_id,
        action="VIDEO_LANGUAGE_TRACK_UPLOADED",
        table_name="video_language",
        record_id=video_id,
        ip_address=request.client.host if request.client else None,
    )
    await db.commit()
    return result


@router.patch("/{video_id}/archive")
async def archive_video(
    video_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("videos.manage")),
):
    """Archive a published video — removes it from employee view."""
    from sqlalchemy import select

    from app.models.video import VideoMaster

    result = await db.execute(
        select(VideoMaster).where(
            VideoMaster.video_id == video_id,
            VideoMaster.company_id == current_user.company_id,
        )
    )
    video = result.scalar_one_or_none()
    if not video:
        from fastapi import HTTPException

        raise HTTPException(404, "Video not found.")
    video.status = "Archived"
    await write_audit_log(
        db,
        user_id=current_user.user_id,
        company_id=current_user.company_id,
        action="VIDEO_ARCHIVED",
        table_name="video_master",
        record_id=video_id,
        ip_address=request.client.host if request.client else None,
    )
    await db.commit()
    return {"message": f"Video '{video.title}' archived."}


@router.get("/{video_id}/stream-url")
async def get_stream_url(
    video_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Get a short-lived signed URL for video streaming.
    URL expires in 5 minutes. Employee must be assigned this course.
    """
    return await video_service.get_stream_url(
        db, video_id, current_user.user_id, current_user.company_id
    )


@router.post("/{video_id}/progress")
async def update_progress(
    video_id: int,
    data: ProgressUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Update video watch progress (called every 10 seconds by the player).
    Enforces no-fast-forward. Returns completion status and assessment unlock flag.
    """
    return await video_service.update_progress(
        db,
        video_id,
        current_user.user_id,
        data.current_position,
        data.total_duration,
    )
