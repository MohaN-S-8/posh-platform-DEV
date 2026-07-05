from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.company import CompanyMaster
from app.schemas.company import CompanyCreate, CompanyUpdate


class CompanyService:
    async def get_all(self, db: AsyncSession) -> list:
        result = await db.execute(select(CompanyMaster).where(CompanyMaster.is_deleted == "N"))
        return result.scalars().all()

    async def get_by_id(self, db: AsyncSession, company_id: int) -> CompanyMaster:
        result = await db.execute(
            select(CompanyMaster).where(
                CompanyMaster.company_id == company_id,
                CompanyMaster.is_deleted == "N",
            )
        )
        company = result.scalar_one_or_none()
        if not company:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Company not found.",
            )
        return company

    async def create(self, db: AsyncSession, data: CompanyCreate) -> CompanyMaster:
        data_dict = data.model_dump()

        # Normalize company_code
        if "company_code" in data_dict and data_dict["company_code"]:
            data_dict["company_code"] = data_dict["company_code"].upper()

        # Check duplicate code
        existing = await db.execute(
            select(CompanyMaster).where(CompanyMaster.company_code == data_dict["company_code"])
        )
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Company code already exists.",
            )

        company = CompanyMaster(
            **data_dict,
            status="Active",
        )

        db.add(company)
        await db.commit()
        await db.refresh(company)
        return company

    async def update(self, db: AsyncSession, company_id: int, data: CompanyUpdate) -> CompanyMaster:
        company = await self.get_by_id(db, company_id)

        # Only update fields that were actually sent
        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(company, field, value)

        await db.commit()
        await db.refresh(company)
        return company

    async def set_status(self, db: AsyncSession, company_id: int, new_status: str) -> CompanyMaster:
        company = await self.get_by_id(db, company_id)
        company.status = new_status
        await db.commit()
        await db.refresh(company)
        return company

    async def delete(self, db: AsyncSession, company_id: int) -> dict:
        company = await self.get_by_id(db, company_id)
        company.is_deleted = "Y"  # soft delete
        await db.commit()
        return {"message": "Company deleted successfully."}
