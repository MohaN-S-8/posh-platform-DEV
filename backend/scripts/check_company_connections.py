"""Read-only diagnostic; reports IDs and counts, never credentials or personal data."""

import asyncio
import json

from sqlalchemy import select

from app.api.v1.analytics import current_analytics
from app.api.v1.compliance import companies, overview
from app.db.session import AsyncSessionLocal, engine
from app.models.user import UserMaster


async def main():
    engine.echo = False
    async with AsyncSessionLocal() as db:
        users = (
            (
                await db.execute(
                    select(UserMaster).where(
                        UserMaster.role_id.in_([1, 2, 5]), UserMaster.is_deleted == "N"
                    )
                )
            )
            .scalars()
            .all()
        )
        for user in users:
            try:
                analytics = await current_analytics(db, user)
                visible = await companies(db, user)
                print(
                    json.dumps(
                        {
                            "user_id": user.user_id,
                            "role": user.role_id,
                            "analytics_companies": [
                                row["company_id"] for row in analytics.get("organizations", [])
                            ],
                            "compliance_companies": [row["company_id"] for row in visible],
                        }
                    )
                )
                for company in visible:
                    data = await overview(company["company_id"], db, user)
                    print(
                        json.dumps(
                            {
                                "company_id": company["company_id"],
                                "external_members": len(data["members"]),
                                "letters": len(data["letters"]),
                            }
                        )
                    )
            except Exception as error:
                print(json.dumps({"user_id": user.user_id, "error_type": type(error).__name__}))
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
