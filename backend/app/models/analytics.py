from sqlalchemy import BigInteger, Column, Date, DateTime, ForeignKey, Integer, Numeric
from sqlalchemy.sql import func

from app.db.base import Base


class AnalyticsSummary(Base):
    """
    Daily snapshot of company-level training analytics.
    Refreshed by a background job — never queried in real time.
    This prevents heavy aggregation from slowing down live users.
    """

    __tablename__ = "analytics_summary"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    company_id = Column(Integer, ForeignKey("company_master.company_id"))
    report_date = Column(Date)
    total_employees = Column(Integer, default=0)
    completed = Column(Integer, default=0)
    in_progress = Column(Integer, default=0)
    not_started = Column(Integer, default=0)
    compliance_rate = Column(Numeric(5, 2), default=0)
    created_date = Column(DateTime, server_default=func.now())
