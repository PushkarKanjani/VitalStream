"""Orders API — medication orders with allergy checking and Indian prescription support."""

import uuid
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, HTTPException, Header, status
from pydantic import BaseModel
from app.db import get_db
from app.models import OrderCreate, Order
from app.allergy_checker import evaluate_allergy_safety, ALLERGY_CLASS_RULES

router = APIRouter()


class AllergyCheckRequest(BaseModel):
    patient_id: str
    medication: str
    case_id: Optional[str] = None


@router.get("/allergy-rules")
async def get_allergy_rules():
    """Returns clinical cross-reactivity and allergy rules."""
    return ALLERGY_CLASS_RULES


@router.post("/check")
async def check_allergy(payload: AllergyCheckRequest):
    """
    Evaluates medication against patient allergies.
    Returns: outcome ('BLOCK' | 'CAUTION' | 'CLEARED'), reason, drug details, patient allergies.
    """
    db = get_db()
    patient = await db.patients.find_one({"patient_id": payload.patient_id}, {"_id": 0})
    if not patient:
        raise HTTPException(status_code=404, detail=f"Patient {payload.patient_id} not found")

    allergies: list[str] = patient.get("allergies", [])
    result = await evaluate_allergy_safety(payload.medication, allergies, db)
    return {
        **result,
        "patient_allergies": allergies,
    }


@router.post("/", response_model=Order, status_code=status.HTTP_201_CREATED)
async def create_order(
    payload: OrderCreate,
    idempotency_key_header: Optional[str] = Header(None, alias="Idempotency-Key")
):
    db = get_db()

    # Deduplication check (P10)
    key = payload.idempotency_key or idempotency_key_header
    if key:
        existing = await db.orders.find_one({"idempotency_key": key}, {"_id": 0})
        if existing:
            return existing

    # Fetch patient allergies
    patient = await db.patients.find_one({"patient_id": payload.patient_id}, {"_id": 0})
    if not patient:
        raise HTTPException(404, f"Patient {payload.patient_id} not found")

    allergies: list[str] = patient.get("allergies", [])
    safety = await evaluate_allergy_safety(payload.medication, allergies, db)

    if safety["outcome"] == "BLOCK":
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            safety["reason"]
        )

    allergy_status = safety["outcome"]  # "CAUTION" or "CLEARED"
    caution_note = safety["reason"] if allergy_status == "CAUTION" else None

    # Construct Indian Rx Line if not provided
    rx_line = payload.rx_line
    if not rx_line:
        med_low = payload.medication.lower()
        form = payload.form or ("Inj." if ("inj" in med_low or "cefazolin" in med_low) else "Tab.")
        brand = payload.brand or payload.medication
        dose = payload.dose if payload.dose is not None else payload.dose_mg
        unit = payload.unit or "mg"
        route = payload.route or ("IV" if ("inj" in med_low or "cefazolin" in med_low) else "Oral")
        freq = payload.frequency or "BD"
        pattern = f" ({payload.pattern})" if payload.pattern else ""
        dur = f" x {payload.duration_days} days" if payload.duration_days else ""
        timing = f" ({payload.food_timing})" if payload.food_timing and route.lower() in ["oral", "po"] else ""
        rx_line = f"{form} {brand} {dose}{unit} | {route} | {freq}{pattern}{dur}{timing}".strip()

    order_dict = payload.model_dump()
    order_dict["order_id"] = str(uuid.uuid4())[:8]
    order_dict["allergy_check_passed"] = True
    order_dict["allergy_status"] = allergy_status
    order_dict["caution_note"] = caution_note
    order_dict["rx_line"] = rx_line
    if key:
        order_dict["idempotency_key"] = key

    order = Order(**order_dict)
    await db.orders.insert_one(order.model_dump())
    return order


@router.get("/case/{case_id}")
async def get_orders_for_case(case_id: str):
    db = get_db()
    cursor = db.orders.find({"case_id": case_id}, {"_id": 0}).sort("created_at", -1)
    orders = await cursor.to_list(length=100)
    # Ensure legacy orders render cleanly without cefazolin ()
    for ord_doc in orders:
        if not ord_doc.get("rx_line"):
            med = ord_doc.get("medication", "")
            med_low = med.lower()
            form = ord_doc.get("form") or ("Inj." if ("inj" in med_low or "cefazolin" in med_low) else "Tab.")
            dose = ord_doc.get("dose") or ord_doc.get("dose_mg") or 500
            unit = ord_doc.get("unit") or "mg"
            route = ord_doc.get("route") or ("IV" if ("inj" in med_low or "cefazolin" in med_low) else "Oral")
            freq = ord_doc.get("frequency") or "STAT"
            ord_doc["rx_line"] = f"{form} {med.capitalize()} {dose}{unit} | {route} | {freq}".strip()
    return orders


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

