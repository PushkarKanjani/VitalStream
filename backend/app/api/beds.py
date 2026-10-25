"""Beds API — ACID reservation using MongoDB findOneAndUpdate."""

from datetime import datetime
from fastapi import APIRouter, HTTPException, status
from app.db import get_db
from app.models import BedReserveRequest, BedStatus

router = APIRouter()


@router.post("/reserve", status_code=status.HTTP_200_OK)
async def reserve_bed(payload: BedReserveRequest):
    """
    ACID bed reservation.
    Uses findOneAndUpdate with a filter on status == 'available' so only ONE
    concurrent request can succeed — the second one gets 409.
    """
    db = get_db()
    result = await db.beds.find_one_and_update(
        {"bed_id": payload.bed_id, "status": "available"},   # atomic filter
        {
            "$set": {
                "status": "occupied",
                "case_id": payload.case_id,
                "reserved_by": payload.reserved_by,
                "reserved_at": datetime.utcnow(),
            }
        },
        return_document=True,  # return updated doc
    )
    if result is None:
        # Either bed doesn't exist or it's already occupied
        bed = await db.beds.find_one({"bed_id": payload.bed_id})
        if not bed:
            raise HTTPException(404, f"Bed {payload.bed_id} not found")
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Bed {payload.bed_id} is already {bed['status']} (case {bed.get('case_id', '?')}). "
            "Double-booking prevented."
        )
    result.pop("_id", None)
    return {"message": f"Bed {payload.bed_id} reserved for case {payload.case_id}", "bed": result}


@router.post("/release/{bed_id}")
async def release_bed(bed_id: str):
    db = get_db()
    result = await db.beds.update_one(
        {"bed_id": bed_id},
        {"$set": {"status": "available", "case_id": None, "reserved_by": None, "reserved_at": None}}
    )
    if result.matched_count == 0:
        raise HTTPException(404, f"Bed {bed_id} not found")
    return {"message": f"Bed {bed_id} released"}


@router.get("/", response_model=list[BedStatus])
async def list_beds(type: str | None = None):
    db = get_db()
    query = {"type": type} if type else {}
    cursor = db.beds.find(query, {"_id": 0})
    return await cursor.to_list(length=50)


@router.get("/available")
async def available_beds():
    db = get_db()
    cursor = db.beds.find({"status": "available"}, {"_id": 0})
    return await cursor.to_list(length=50)
