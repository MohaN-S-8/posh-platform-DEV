from sqlalchemy import (
    BigInteger,
    Column,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
)
from sqlalchemy.sql import func

from app.db.base import Base


class CertificateTemplate(Base):
    """
    Admin creates templates that define what certificates look like.
    Stores paths to logo and signature images.
    """

    __tablename__ = "certificate_template"

    template_id = Column(Integer, primary_key=True, autoincrement=True)
    template_name = Column(String(100))
    logo_path = Column(String(255))  # path in MinIO
    font_name = Column(String(50), default="Helvetica")
    signature_path = Column(String(255))  # path in MinIO
    color_code = Column(String(20), default="#1a3c5e")
    company_id = Column(Integer, ForeignKey("company_master.company_id"))
    status = Column(Enum("Active", "Inactive"), default="Active")
    created_date = Column(DateTime, server_default=func.now())
    updated_date = Column(DateTime, server_default=func.now(), onupdate=func.now())


class Certificate(Base):
    """
    One row per certificate issued.
    certificate_number is unique, publicly verifiable via QR code.
    """

    __tablename__ = "certificates"

    certificate_id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(BigInteger, ForeignKey("user_master.user_id"))
    video_id = Column(Integer, ForeignKey("video_master.video_id"), nullable=True)
    company_id = Column(Integer, ForeignKey("company_master.company_id"))
    template_id = Column(Integer, ForeignKey("certificate_template.template_id"), nullable=True)
    certificate_number = Column(String(100), unique=True)  # e.g. POSH-2026-000123
    course_name = Column(String(200))
    completion_date = Column(Date)
    issue_date = Column(Date)
    qr_code_path = Column(String(255))  # QR image stored in MinIO
    pdf_path = Column(String(255))  # Certificate PDF stored in MinIO
    status = Column(Enum("Valid", "Revoked"), default="Valid")
    created_date = Column(DateTime, server_default=func.now())
    updated_date = Column(DateTime, server_default=func.now(), onupdate=func.now())
