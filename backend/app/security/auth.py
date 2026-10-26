"""
VitalStream Clinical Authentication & Cryptographic Audit Verification.
Implements:
- Role-based clinical actor tagging (Surgeon, Anesthetist, Nursing Lead, System Daemon)
- Cryptographic SHA-256 HMAC integrity signatures for immutable audit trails (HIPAA § 164.312(b))
"""

import hmac
import hashlib
import json
import os
from typing import Optional
from fastapi import Header, HTTPException, status

AUDIT_SECRET_KEY = os.getenv("SECRET_KEY", "vitalstream_clinical_master_hmac_secret_2024")


def generate_audit_hash(record: dict, secret: Optional[str] = None) -> str:
    """
    Computes a cryptographic HMAC-SHA256 checksum over normalized audit record data.
    Ensures tamper-evidence for medical audits and CDSCO compliance reports.
    """
    key = (secret or AUDIT_SECRET_KEY).encode("utf-8")
    normalized = json.dumps(record, sort_keys=True, default=str).encode("utf-8")
    return hmac.new(key, normalized, hashlib.sha256).hexdigest()


def verify_audit_hash(record: dict, signature: str, secret: Optional[str] = None) -> bool:
    """Verifies that an audit record has not been altered since generation."""
    expected = generate_audit_hash(record, secret)
    return hmac.compare_digest(expected, signature)


class ClinicalActor:
    """Represents a verified clinical practitioner operating within the command center."""
    def __init__(self, staff_id: str, name: str, role: str):
        self.staff_id = staff_id
        self.name = name
        self.role = role  # surgeon | anesthetist | nurse | admin | pharmacist

    def __repr__(self):
        return f"<ClinicalActor {self.name} ({self.role})>"


def get_current_actor(
    x_staff_id: Optional[str] = Header("STF-101", description="Clinical Staff ID"),
    x_staff_name: Optional[str] = Header("Dr. Aditi Sharma", description="Clinical Staff Name"),
    x_staff_role: Optional[str] = Header("surgeon", description="Role: surgeon | anesthetist | nurse | pharmacist")
) -> ClinicalActor:
    """
    Extracts and validates clinical actor headers.
    In development / demo mode, sensible defaults (Dr. Aditi Sharma, Chief Surgeon) are provided.
    In production mode, credentials can be validated against JWT tokens.
    """
    valid_roles = {"surgeon", "anesthetist", "nurse", "pharmacist", "admin", "system"}
    role_norm = (x_staff_role or "surgeon").strip().lower()

    if role_norm not in valid_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Invalid clinical role '{x_staff_role}'. Authorized roles: {', '.join(sorted(valid_roles))}"
        )

    return ClinicalActor(
        staff_id=x_staff_id or "STF-101",
        name=x_staff_name or "Dr. Aditi Sharma",
        role=role_norm
    )
