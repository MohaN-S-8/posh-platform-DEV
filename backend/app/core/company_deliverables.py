import json
import re

from fastapi import HTTPException
from sqlalchemy import select, text

from app.models.company import CompanyMaster

# Master codes are stable; display names may be edited without changing access.
FEATURE_ITEMS = {
    "policy": ["PoSH Policy", "POSH Policy"],
    "training": [
        "PoSH Training",
        "POSH Awareness Training",
        "IC Member Training",
        "My IC Training",
        "IC Training",
    ],
    "certificate": ["Assessment & Certificate", "Assessment & Certificates"],
    "reports": ["Analytics & Reports", "Client Status"],
    "annual": ["Annual Returns", "Annual Return"],
    "compliance": ["POSH Compliance"],
    "complaints": ["POSH Complaints", "Raise POSH Complaints", "Concerns Received"],
    "audit": ["Audit", "POSH Audit", "PoSH Audit"],
}
CODE_FEATURES = {
    "POLICY": {"policy"},
    "POSH_POLICY": {"policy"},
    "TRAINING": {"training"},
    "IC_TRAINING": {"training"},
    "AWARENESS_TRAINING": {"training"},
    "CERTIFICATE": {"certificate"},
    "ASSESSMENT": {"certificate"},
    "REPORTING": {"reports", "annual", "compliance", "audit"},
    "REPORTS": {"reports"},
    "ANNUAL_RETURNS": {"annual"},
    "ANNUAL_RETURN": {"annual"},
    "COMPLIANCE": {"compliance"},
    "POSH_COMPLIANCE": {"compliance"},
    "COMPLAINTS": {"complaints"},
    "CONCERNS": {"complaints"},
    "AUDIT": {"audit"},
}


def selected_codes(value):
    try:
        rows = json.loads(value or "[]") if isinstance(value, str) else value or []
    except (TypeError, ValueError):
        return set()
    if not isinstance(rows, list):
        return set()
    posh = [row for row in rows if isinstance(row, dict) and row.get("scope") == "POSH"]
    if not any("deliverable_codes" in row for row in posh):
        return None  # Older contracts have not yet been configured with checkboxes.
    codes = set()
    for row in posh:
        values = row.get("deliverable_codes", [])
        if not isinstance(values, list) or any(not isinstance(code, str) for code in values):
            return set()
        codes.update(values)
    return codes


def master_features(row):
    code = re.sub(r"[^A-Z0-9]+", "_", row["code"].upper()).strip("_")
    if code in CODE_FEATURES:
        return CODE_FEATURES[code]
    name = row["name"].strip().casefold()
    return {
        feature
        for feature, labels in FEATURE_ITEMS.items()
        if name in {label.casefold() for label in labels}
    }


async def company_features(db, current_user):
    if current_user.role_id in (1, 2):
        return None
    result = await db.execute(
        select(CompanyMaster.service_details_json).where(
            CompanyMaster.company_id == current_user.company_id, CompanyMaster.is_deleted == "N"
        )
    )
    company = result.first()
    if company is None:
        return set()
    codes = selected_codes(company[0])
    if codes is None:
        return None
    result = await db.execute(
        text(
            "SELECT code, name FROM posh_master_codes WHERE category = 'Deliverables' AND is_active = TRUE"
        )
    )
    features = set()
    for row in result.mappings():
        if row["code"] in codes:
            features.update(master_features(row))
    return features


def request_feature(path):
    path = path.removeprefix("/api/v1").rstrip("/")
    prefix = path.split("/")[1:2]
    feature = {
        "policy": "policy",
        "videos": "training",
        "assessments": "certificate",
        "certificates": "certificate",
        "annual-returns": "annual",
        "concerns": "complaints",
    }.get(prefix[0] if prefix else "")
    if feature:
        return feature
    if path.startswith(
        ("/employee/courses", "/employee/history", "/employee/summary", "/hr/training")
    ):
        return "training"
    if path.startswith("/hr/compliance"):
        return "compliance"
    if path.startswith(("/hr/reports", "/analytics")):
        return "reports"
    if path.startswith(("/admin/audit-logs", "/admin/audit-logins")):
        return "audit"
    return None


async def enforce_company_deliverable(db, current_user, path):
    feature = request_feature(path)
    if feature is None or current_user.role_id in (1, 2):
        return
    allowed = await company_features(db, current_user)
    if allowed is not None and feature not in allowed:
        raise HTTPException(
            403, "This deliverable is not enabled for your company. Contact your administrator."
        )


async def restrict_role_records(db, current_user, rows):
    allowed = await company_features(db, current_user)
    if allowed is None:
        return rows
    blocked = {
        label
        for feature, labels in FEATURE_ITEMS.items()
        if feature not in allowed
        for label in labels
    }
    output = [
        {**row, "is_allowed": False} if row["access_item"] in blocked else row for row in rows
    ]
    existing = {row["access_item"] for row in output}
    for index, label in enumerate(sorted(blocked - existing), 1):
        output.append(
            {
                "id": -index,
                "role_label": str(current_user.role_id),
                "access_item": label,
                "access_status": "Not included in company deliverables",
                "is_allowed": False,
                "display_order": 0,
            }
        )
    return output
