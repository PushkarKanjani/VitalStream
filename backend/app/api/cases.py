"""Cases API — POST /api/cases, GET /api/cases/active, GET /api/cases/{id}"""

from datetime import datetime
from fastapi import APIRouter, HTTPException, status
from app.db import get_db
from app.models import Case, CaseCreate

router = APIRouter()


@router.post("/", response_model=Case, status_code=status.HTTP_201_CREATED)
async def create_case(payload: CaseCreate):
    db = get_db()

    # Check bed is not already occupied
    bed = await db.beds.find_one({"bed_id": payload.or_id})
    if not bed:
        raise HTTPException(404, f"Bed {payload.or_id} not found")
    if bed["status"] != "available":
        raise HTTPException(409, f"{payload.or_id} is currently {bed['status']} — cannot create case")

    case = Case(**payload.model_dump())
    case_doc = case.model_dump()
    case_doc["scheduled_start"] = datetime.utcnow()

    await db.cases.insert_one(case_doc)
    # Mark bed occupied
    await db.beds.update_one(
        {"bed_id": payload.or_id},
        {"$set": {"status": "occupied", "case_id": case.case_id}}
    )
    return case


@router.get("/active")
async def get_active_cases():
    db = get_db()
    cursor = db.cases.find({"status": "active"}, {"_id": 0})
    return await cursor.to_list(length=100)


@router.get("/{case_id}")
async def get_case(case_id: str):
    db = get_db()
    doc = await db.cases.find_one({"case_id": case_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Case not found")
    return doc


@router.patch("/{case_id}/start")
async def start_case(case_id: str):
    db = get_db()
    result = await db.cases.update_one(
        {"case_id": case_id, "status": "scheduled"},
        {"$set": {"status": "active", "actual_start": datetime.utcnow()}}
    )
    if result.matched_count == 0:
        raise HTTPException(404, "Case not found or not in scheduled state")
    return {"message": f"Case {case_id} started"}


@router.patch("/{case_id}/end")
async def end_case(case_id: str):
    db = get_db()
    case = await db.cases.find_one({"case_id": case_id})
    if not case:
        raise HTTPException(404, "Case not found")
    await db.cases.update_one(
        {"case_id": case_id},
        {"$set": {"status": "completed", "actual_end": datetime.utcnow()}}
    )
    # Free the bed
    await db.beds.update_one(
        {"bed_id": case["or_id"]},
        {"$set": {"status": "available", "case_id": None, "reserved_by": None}}
    )
    return {"message": f"Case {case_id} completed"}
