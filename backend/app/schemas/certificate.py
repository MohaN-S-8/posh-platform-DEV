from datetime import date
from typing import Optional

from pydantic import BaseModel


class CertificateTemplateCreate(BaseModel):
    template_name: str
    font_name: Optional[str] = "Helvetica"
    color_code: Optional[str] = "#1a3c5e"


class CertificateTemplateUpdate(BaseModel):
    template_name: Optional[str] = None
    font_name: Optional[str] = None
    color_code: Optional[str] = None
    status: Optional[str] = None


class CertificateTemplateResponse(BaseModel):
    template_id: int
    template_name: str
    font_name: str
    color_code: str
    status: str

    class Config:
        from_attributes = True


class CertificateResponse(BaseModel):
    certificate_id: int
    certificate_number: str
    course_name: str
    completion_date: Optional[date]
    issue_date: Optional[date]
    status: str

    class Config:
        from_attributes = True


class CertificateVerifyResponse(BaseModel):
    """Public-facing response — deliberately limited to avoid PII exposure."""

    certificate_number: str
    employee_name: str  # first name + masked last name: "Ravi K."
    course_name: str
    completion_date: Optional[date]
    issue_date: Optional[date]
    status: str  # Valid or Revoked
