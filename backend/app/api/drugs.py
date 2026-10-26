"""Drugs API — Indian drug catalog search and composition lookup."""

import re
from typing import List, Optional
from fastapi import APIRouter, Query, HTTPException
from app.db import get_db

router = APIRouter()

@router.get("/search")
async def search_drugs(q: Optional[str] = Query(default="", description="Search query by brand name or salt composition")):
    """
    Searches the Indian drug catalog in MongoDB.
    Matches either brand name (e.g. 'Augm') or salt composition (e.g. 'pantoprazole').
    """
    db = get_db()
    query_str = (q or "").strip()
    
    if not query_str:
        cursor = db.drug_catalog.find({}, {"_id": 0}).limit(20)
        return await cursor.to_list(length=20)
    
    regex = re.compile(re.escape(query_str), re.IGNORECASE)
    cursor = db.drug_catalog.find({
        "$or": [
            {"brand": {"$regex": regex}},
            {"salts.name": {"$regex": regex}}
        ]
    }, {"_id": 0}).limit(30)
    
    results = await cursor.to_list(length=30)
    return results


@router.get("/all")
async def get_all_drugs():
    """Returns the full Indian drug catalog."""
    db = get_db()
    cursor = db.drug_catalog.find({}, {"_id": 0})
    return await cursor.to_list(length=100)


@router.get("/{brand}")
async def get_drug_by_brand(brand: str):
    """Fetches details for a specific brand."""
    db = get_db()
    drug = await db.drug_catalog.find_one({"brand": brand}, {"_id": 0})
    if not drug:
        # Try case-insensitive
        drug = await db.drug_catalog.find_one({"brand": {"$regex": f"^{re.escape(brand)}$", "$options": "i"}}, {"_id": 0})
    if not drug:
        raise HTTPException(404, f"Drug '{brand}' not found in catalog")
    return drug
