from sqlalchemy import (
    BigInteger,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
)
from sqlalchemy.sql import func

from app.db.base import Base


class EmployeeUploadBatch(Base):
    """
    Tracks every bulk employee upload.
    Lets HR see status of their upload (Processing / Completed / Failed).
    """

    __tablename__ = "employee_upload_batch"

    batch_id = Column(BigInteger, primary_key=True, autoincrement=True)
    company_id = Column(Integer, ForeignKey("company_master.company_id"))
    uploaded_by = Column(BigInteger, ForeignKey("user_master.user_id"))
    file_name = Column(String(255))
    total_rows = Column(Integer, default=0)
    success_rows = Column(Integer, default=0)
    failed_rows = Column(Integer, default=0)
    error_report_path = Column(String(255))  # path to error CSV in MinIO
    status = Column(Enum("Processing", "Completed", "Failed"), default="Processing")
    created_date = Column(DateTime, server_default=func.now())
    updated_date = Column(DateTime, server_default=func.now(), onupdate=func.now())
