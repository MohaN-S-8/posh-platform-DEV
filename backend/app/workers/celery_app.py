import os

from celery import Celery

celery_app = Celery(
    "posh_worker",
    broker=os.environ.get("REDIS_URL", "redis://redis:6379/0"),
    backend=os.environ.get("REDIS_URL", "redis://redis:6379/0"),
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Kolkata",
    enable_utc=True,
)


@celery_app.task(bind=True, max_retries=3)
def generate_certificate_task(self, user_id: int, video_id: int, company_id: int):
    """
    Background task: generate certificate after assessment pass.
    Retries up to 3 times if it fails (network issues, DB timeouts etc.)
    """
    import asyncio

    from app.db.session import AsyncSessionLocal, engine
    from app.services.certificate_service import CertificateService

    async def _run():
        await engine.dispose()
        try:
            async with AsyncSessionLocal() as db:
                service = CertificateService()
                await service.generate_certificate(db, user_id, video_id, company_id)
        finally:
            await engine.dispose()

    try:
        asyncio.run(_run())
    except Exception as exc:
        raise self.retry(exc=exc, countdown=60)
