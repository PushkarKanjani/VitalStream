"""Orders API — medication orders with allergy checking."""

import uuid
from datetime import datetime
from fastapi import APIRouter, HTTPException, status
from app.db import get_db
from app.models import OrderCreate, Order

router = APIRouter()

# Known drug → allergy mappings (simplified clinical rules)
ALLERGY_DRUG_MAP: dict[str, list[str]] = {
    "penicillin":  ["amoxicillin", "ampicillin", "piperacillin", "penicillin"],
    "sulfa":       ["sulfamethoxazole", "trimethoprim-sulfamethoxazole"],
    "latex":       [],   # equipment allergy — no drugs blocked directly
    "aspirin":     ["aspirin", "ibuprofen", "naproxen", "ketorolac"],
    "codeine":     ["codeine", "morphine", "hydrocodone", "oxycodone"],
    "iodine":      ["iodine", "povidone-iodine"],
    "contrast":    ["iodinated contrast"],
}


def _check_allergy(patient_allergies: list[str], medication: str) -> str | None:
    """Returns the offending allergy string if blocked, else None."""
    med_lower = medication.lower()
    for allergy in patient_allergies:
        blocked_drugs = ALLERGY_DRUG_MAP.get(allergy.lower(), [allergy.lower()])
        if any(med_lower == d or med_lower.startswith(d) for d in blocked_drugs):
            return allergy
    return None


@router.post("/", response_model=Order, status_code=status.HTTP_201_CREATED)
async def create_order(payload: OrderCreate):
    db = get_db()

    # Fetch patient allergies
    patient = await db.patients.find_one({"patient_id": payload.patient_id}, {"_id": 0})
    if not patient:
        raise HTTPException(404, f"Patient {payload.patient_id} not found")

    allergies: list[str] = patient.get("allergies", [])
    blocking_allergy = _check_allergy(allergies, payload.medication)

    if blocking_allergy:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            f"ORDER BLOCKED — Patient {payload.patient_id} is allergic to '{blocking_allergy}'. "
            f"Medication '{payload.medication}' cannot be administered."
        )

    order = Order(**payload.model_dump(), order_id=str(uuid.uuid4())[:8], allergy_check_passed=True)
    await db.orders.insert_one(order.model_dump())
    return order


@router.get("/case/{case_id}")
async def get_orders_for_case(case_id: str):
    db = get_db()
    cursor = db.orders.find({"case_id": case_id}, {"_id": 0})
    return await cursor.to_list(length=100)


@router.patch("/{order_id}/administer")
async def administer_order(order_id: str):
    db = get_db()
    result = await db.orders.update_one(
        {"order_id": order_id, "status": "pending"},
        {"$set": {"status": "administered", "administered_at": datetime.utcnow()}}
    )
    if result.matched_count == 0:
        raise HTTPException(404, "Order not found or not pending")
    return {"message": f"Order {order_id} marked as administered"}
