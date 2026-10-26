"""VitalStream — Pydantic v2 models (request/response schemas)."""

from __future__ import annotations
from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, Field
import uuid


# ── PATIENT ────────────────────────────────────────────────────────────────────
class Patient(BaseModel):
    patient_id: str
    name: str
    age: int
    gender: Literal["M", "F", "Other"]
    blood_type: str
    allergies: list[str] = []
    chronic_conditions: list[str] = []
    weight_kg: float
    height_cm: float
    source: str = "synthea"


# ── CASE ───────────────────────────────────────────────────────────────────────
class CaseCreate(BaseModel):
    patient_id: str
    or_id: str                    # OR-1 … OR-6
    surgeon_name: str
    anesthesiologist: str
    procedure_type: str
    estimated_duration_minutes: int = 120


class Case(CaseCreate):
    case_id: str = Field(default_factory=lambda: str(uuid.uuid4())[:8])
    status: Literal["scheduled", "active", "completed", "cancelled"] = "scheduled"
    scheduled_start: datetime = Field(default_factory=datetime.utcnow)
    actual_start: Optional[datetime] = None
    actual_end: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


# ── BED ────────────────────────────────────────────────────────────────────────
class BedReserveRequest(BaseModel):
    bed_id: str                   # OR-1 … OR-6 or REC-1 … REC-6
    case_id: str
    reserved_by: str              # staff name / ID


class BedStatus(BaseModel):
    bed_id: str
    type: Literal["operating_room", "recovery"]
    status: Literal["available", "occupied", "cleaning"]
    case_id: Optional[str] = None
    reserved_by: Optional[str] = None
    floor: int


# ── ORDER (medication) ────────────────────────────────────────────────────────
class OrderCreate(BaseModel):
    case_id: str
    patient_id: str
    medication: str
    dose_mg: float = 500.0
    route: str = "IV"
    ordered_by: str = "Attending Clinician"
    # Indian prescription & structured drug attributes (P9 & P11)
    brand: Optional[str] = None
    salts: Optional[list[dict]] = None
    form: Optional[str] = "Tab."
    strength: Optional[str] = None
    dose: Optional[float] = None
    unit: Optional[str] = "mg"
    frequency: Optional[str] = "BD"
    pattern: Optional[str] = "1-0-1"
    food_timing: Optional[str] = "after food"
    duration_days: Optional[int] = 5
    qty: Optional[int] = None
    mrp_inr: Optional[float] = None
    allergy_status: Optional[str] = "CLEARED"
    caution_note: Optional[str] = None
    rx_line: Optional[str] = None
    idempotency_key: Optional[str] = None


class Order(OrderCreate):
    order_id: str = Field(default_factory=lambda: str(uuid.uuid4())[:8])
    status: Literal["pending", "administered", "cancelled"] = "pending"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    allergy_check_passed: bool = True


# ── ALERT ──────────────────────────────────────────────────────────────────────
class Alert(BaseModel):
    alert_id: str
    case_id: str
    or_id: str
    patient_id: str
    alert_type: Literal["BP_LOW", "BP_HIGH", "O2_FALLING", "HR_HIGH", "HR_LOW", "TEMP_HIGH"]
    severity: Literal["warning", "critical"]
    reason: str
    acknowledged: bool = False
    acknowledged_by: Optional[str] = None
    ack_time: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class AlertAck(BaseModel):
    acknowledged_by: str
