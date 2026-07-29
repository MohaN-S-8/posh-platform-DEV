from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Notification
from app.models.training import CourseAssignment
from app.models.user import UserMaster


class NotificationService:
    async def create_for_user_ids(
        self,
        db: AsyncSession,
        *,
        user_ids: list[int],
        company_id: int,
        title: str,
        message: str,
    ) -> int:
        created = 0
        for user_id in sorted(set(int(value) for value in user_ids if value)):
            existing = await db.execute(
                select(Notification.id)
                .where(
                    Notification.user_id == user_id,
                    Notification.company_id == company_id,
                    Notification.title == title,
                    Notification.message == message,
                )
                .limit(1)
            )
            if existing.scalar_one_or_none():
                continue
            db.add(
                Notification(
                    user_id=user_id,
                    company_id=company_id,
                    title=title,
                    message=message,
                )
            )
            created += 1
        return created

    async def active_user_ids_by_roles(
        self,
        db: AsyncSession,
        *,
        company_id: int,
        role_ids: list[int],
        exclude_user_id: int | None = None,
    ) -> list[int]:
        filters = [
            UserMaster.company_id == company_id,
            UserMaster.role_id.in_(role_ids),
            UserMaster.status == "Active",
            UserMaster.is_deleted == "N",
        ]
        if exclude_user_id:
            filters.append(UserMaster.user_id != exclude_user_id)
        result = await db.execute(select(UserMaster.user_id).where(*filters))
        return [int(user_id) for user_id in result.scalars().all()]

    async def assignment_recipient_ids(
        self,
        db: AsyncSession,
        *,
        company_id: int,
        assign_type: str,
        assigned_to_user_id: int | None = None,
        assigned_to_department: str | None = None,
    ) -> list[int]:
        filters = [
            UserMaster.company_id == company_id,
            UserMaster.role_id == 4,
            UserMaster.status == "Active",
            UserMaster.is_deleted == "N",
        ]
        if assign_type == "Individual":
            filters.append(UserMaster.user_id == assigned_to_user_id)
        elif assign_type == "Department":
            filters.append(UserMaster.department == assigned_to_department)
        result = await db.execute(select(UserMaster.user_id).where(*filters))
        return [int(user_id) for user_id in result.scalars().all()]

    async def course_watcher_ids(
        self,
        db: AsyncSession,
        *,
        company_id: int,
        video_id: int,
        employee_department: str | None = None,
    ) -> list[int]:
        assignment_result = await db.execute(
            select(CourseAssignment.assigned_by)
            .where(
                CourseAssignment.company_id == company_id,
                CourseAssignment.video_id == video_id,
                or_(
                    CourseAssignment.assign_type == "Company-Wide",
                    and_(
                        CourseAssignment.assign_type == "Department",
                        CourseAssignment.assigned_to_department == employee_department,
                    ),
                ),
            )
            .distinct()
        )
        assigned_by_ids = [int(user_id) for user_id in assignment_result.scalars().all() if user_id]
        role_watchers = await self.active_user_ids_by_roles(
            db,
            company_id=company_id,
            role_ids=[5, 3],
        )
        return sorted(set(assigned_by_ids + role_watchers))


notification_service = NotificationService()
