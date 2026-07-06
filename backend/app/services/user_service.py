from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models.user import UserMaster
from app.schemas.user import UserCreate, UserUpdate


class UserService:
    async def get_all(
        self,
        db: AsyncSession,
        company_id: Optional[int] = None,
        role_ids: Optional[set[int]] = None,
    ) -> list:
        query = select(UserMaster).where(UserMaster.is_deleted == "N")
        if company_id:
            query = query.where(UserMaster.company_id == company_id)
        if role_ids:
            query = query.where(UserMaster.role_id.in_(role_ids))
        result = await db.execute(query)
        return result.scalars().all()

    async def get_by_id(
        self, db: AsyncSession, user_id: int, company_id: Optional[int] = None
    ) -> UserMaster:
        query = select(UserMaster).where(
            UserMaster.user_id == user_id,
            UserMaster.is_deleted == "N",
        )
        if company_id is not None:
            query = query.where(UserMaster.company_id == company_id)
        result = await db.execute(query)
        user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found.",
            )
        return user

    async def create(self, db: AsyncSession, data: UserCreate) -> UserMaster:
        # Check duplicate email
        existing = await db.execute(select(UserMaster).where(UserMaster.email == data.email))
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered.",
            )

        # Generate temporary password
        # temp_password = "Temp@1234"
        import secrets
        import string

        # Generate a secure random temporary password
        alphabet = string.ascii_letters + string.digits + "!@#$"
        temp_password = (
            secrets.choice(string.ascii_uppercase)
            + secrets.choice(string.digits)
            + secrets.choice("!@#$")
            + "".join(secrets.choice(alphabet) for _ in range(9))
        )
        user = UserMaster(
            **data.model_dump(),
            username=data.email,
            password_hash=hash_password(temp_password),
            status="Active",
        )
        db.add(user)
        await db.commit()
        from app.core.email import send_welcome_email

        try:
            await send_welcome_email(
                to=user.email,
                first_name=user.first_name,
                temp_password=temp_password,
            )
        except Exception:
            pass

        await db.refresh(user)
        return user

    async def update(
        self, db: AsyncSession, user_id: int, data: UserUpdate, company_id: Optional[int] = None
    ) -> UserMaster:
        user = await self.get_by_id(db, user_id, company_id)
        update_data = data.model_dump(exclude_unset=True)
        if "email" in update_data and update_data["email"] != user.email:
            existing = await db.execute(
                select(UserMaster).where(
                    UserMaster.email == update_data["email"],
                    UserMaster.user_id != user_id,
                    UserMaster.is_deleted == "N",
                )
            )
            if existing.scalar_one_or_none():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Email already registered.",
                )
            update_data["username"] = update_data["email"]

        if "employee_id" in update_data and update_data["employee_id"] != user.employee_id:
            existing = await db.execute(
                select(UserMaster).where(
                    UserMaster.employee_id == update_data["employee_id"],
                    UserMaster.company_id == user.company_id,
                    UserMaster.user_id != user_id,
                    UserMaster.is_deleted == "N",
                )
            )
            if existing.scalar_one_or_none():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Employee ID already exists for this company.",
                )

        for field, value in update_data.items():
            setattr(user, field, value)
        await db.commit()
        await db.refresh(user)
        return user

    async def set_status(
        self, db: AsyncSession, user_id: int, new_status: str, company_id: Optional[int] = None
    ) -> UserMaster:
        user = await self.get_by_id(db, user_id, company_id)
        user.status = new_status
        await db.commit()
        return user

    async def reset_password(
        self, db: AsyncSession, user_id: int, new_password: str, company_id: Optional[int] = None
    ) -> dict:
        user = await self.get_by_id(db, user_id, company_id)
        user.password_hash = hash_password(new_password)
        await db.commit()
        return {"message": "Password reset successfully."}

    async def delete(
        self, db: AsyncSession, user_id: int, company_id: Optional[int] = None
    ) -> dict:
        user = await self.get_by_id(db, user_id, company_id)
        user.is_deleted = "Y"
        await db.commit()
        return {"message": "User deleted successfully."}
