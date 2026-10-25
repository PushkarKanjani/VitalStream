"""Alerts API — GET unacknowledged, POST acknowledge."""

from datetime import datetime
from fastapi import APIRouter, HTTPException
from app.db import get_db
from app.models import AlertAck

router = APIRouter()


@router.get("/unacknowledged")
async def get_unacknowledged_alerts(limit: int = 50):
    db = get_db()
    cursor = db.alerts.find(
        {"acknowledged": False},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit)
    return await cursor.to_list(length=limit)


@router.get("/")
async def get_all_alerts(limit: int = 100, severity: str | None = None):
    db = get_db()
    query = {"severity": severity} if severity else {}
    cursor = db.alerts.find(query, {"_id": 0}).sort("created_at", -1).limit(limit)
    return await cursor.to_list(length=limit)


@router.post("/{alert_id}/acknowledge")
async def acknowledge_alert(alert_id: str, payload: AlertAck):
    db = get_db()
    result = await db.alerts.update_one(
        {"alert_id": alert_id, "acknowledged": False},
        {
            "$set": {
                "acknowledged": True,
                "acknowledged_by": payload.acknowledged_by,
                "ack_time": datetime.utcnow(),
            }
        }
    )
    if result.matched_count == 0:
        raise HTTPException(404, f"Alert {alert_id} not found or already acknowledged")
    return {"message": f"Alert {alert_id} acknowledged by {payload.acknowledged_by}"}


@router.get("/case/{case_id}")
async def alerts_for_case(case_id: str):
    db = get_db()
    cursor = db.alerts.find({"case_id": case_id}, {"_id": 0}).sort("created_at", -1)
    return await cursor.to_list(length=100)


@router.get("/stats")
async def alert_stats():
    db = get_db()
    total = await db.alerts.count_documents({})
    unacked = await db.alerts.count_documents({"acknowledged": False})
    critical = await db.alerts.count_documents({"severity": "critical", "acknowledged": False})
    return {"total": total, "unacknowledged": unacked, "critical_unacked": critical}
