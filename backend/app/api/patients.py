"""Patients API — lookup and bulk load from VitalDB/Synthea."""

from fastapi import APIRouter, HTTPException, UploadFile, File
from app.db import get_db
from app.models import Patient

router = APIRouter()


@router.get("/{patient_id}", response_model=Patient)
async def get_patient(patient_id: str):
    db = get_db()
    doc = await db.patients.find_one({"patient_id": patient_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, f"Patient {patient_id} not found")
    return doc


@router.get("/")
async def search_patients(name: str | None = None, limit: int = 20):
    db = get_db()
    query = {"name": {"$regex": name, "$options": "i"}} if name else {}
    cursor = db.patients.find(query, {"_id": 0}).limit(limit)
    return await cursor.to_list(length=limit)


@router.post("/bulk", status_code=201)
async def bulk_insert_patients(patients: list[Patient]):
    """Called by vitaldb_downloader.py to seed the patients collection."""
    db = get_db()
    if not patients:
        return {"inserted": 0}
    docs = [p.model_dump() for p in patients]
    result = await db.patients.insert_many(docs, ordered=False)
    return {"inserted": len(result.inserted_ids)}


@router.get("/count")
async def patient_count():
    db = get_db()
    n = await db.patients.count_documents({})
    return {"count": n}
