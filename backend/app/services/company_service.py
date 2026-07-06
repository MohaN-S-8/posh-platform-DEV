from fastapi import HTTPException, status
from sqlalchemy import bindparam, select, text
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
        await db.execute(
            text(
                """
                INSERT IGNORE INTO company_languages (company_id, language_id, is_default)
                VALUES (:company_id, 1, TRUE)
                """
            ),
            {"company_id": company.company_id},
        )
        await db.commit()
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

    async def get_language_preferences(self, db: AsyncSession, company_id: int) -> list[dict]:
        await self.get_by_id(db, company_id)
        result = await db.execute(
            text(
                """
                SELECT
                    lm.language_id,
                    lm.language_name,
                    CASE WHEN cl.language_id IS NULL THEN 0 ELSE 1 END AS enabled,
                    COALESCE(cl.is_default, 0) AS is_default
                FROM language_master lm
                LEFT JOIN company_languages cl
                    ON cl.language_id = lm.language_id
                    AND cl.company_id = :company_id
                ORDER BY lm.language_id
                """
            ),
            {"company_id": company_id},
        )
        return [
            {
                "language_id": row.language_id,
                "language_name": row.language_name,
                "enabled": bool(row.enabled),
                "is_default": bool(row.is_default),
            }
            for row in result
        ]

    async def update_language_preferences(
        self,
        db: AsyncSession,
        company_id: int,
        language_ids: list[int],
        default_language_id: int | None = None,
    ) -> list[dict]:
        await self.get_by_id(db, company_id)
        unique_language_ids = sorted({int(language_id) for language_id in language_ids})
        if not unique_language_ids:
            raise HTTPException(400, "Select at least one language.")

        if default_language_id is None:
            default_language_id = unique_language_ids[0]
        if default_language_id not in unique_language_ids:
            raise HTTPException(400, "Default language must be selected.")

        valid_result = await db.execute(
            text(
                """
                SELECT language_id
                FROM language_master
                WHERE language_id IN :language_ids
                """
            ).bindparams(bindparam("language_ids", expanding=True)),
            {"language_ids": unique_language_ids},
        )
        valid_ids = {row.language_id for row in valid_result}
        if valid_ids != set(unique_language_ids):
            raise HTTPException(400, "One or more selected languages are invalid.")

        await db.execute(
            text("DELETE FROM company_languages WHERE company_id = :company_id"),
            {"company_id": company_id},
        )
        for language_id in unique_language_ids:
            await db.execute(
                text(
                    """
                    INSERT INTO company_languages (company_id, language_id, is_default)
                    VALUES (:company_id, :language_id, :is_default)
                    """
                ),
                {
                    "company_id": company_id,
                    "language_id": language_id,
                    "is_default": language_id == default_language_id,
                },
            )
        await db.commit()
        return await self.get_language_preferences(db, company_id)
