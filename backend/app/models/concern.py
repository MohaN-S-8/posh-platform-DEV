from sqlalchemy import (
    BigInteger,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.sql import func

from app.db.base import Base


class Concern(Base):
    """Concerns reported by portal users for admin review."""

    __tablename__ = "concerns"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(BigInteger, ForeignKey("user_master.user_id"))
    company_id = Column(Integer, ForeignKey("company_master.company_id"))
    category = Column(String(100))
    message = Column(Text)
    status = Column(Enum("Open", "Reviewed", "Closed"), default="Open")
    created_date = Column(DateTime, server_default=func.now())
    updated_date = Column(DateTime, server_default=func.now(), onupdate=func.now())
