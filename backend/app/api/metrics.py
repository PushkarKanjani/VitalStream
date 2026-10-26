"""Metrics API — pipeline health: Kafka lag, Cassandra stats, Flink jobs."""

import asyncio
import os
import httpx
from fastapi import APIRouter
from app.db import get_db

router = APIRouter()

FLINK_URL = os.getenv("FLINK_URL", "http://localhost:8081")


@router.get("/health")
async def system_health():
    """Returns health of all pipeline components."""
    db = get_db()

    # MongoDB ping
    try:
        await db.command("ping")
        mongo_status = "online"
    except Exception as e:
        mongo_status = f"error: {e}"

    # Flink ping
    flink_status = "unknown"
    flink_jobs = []
    try:
        async with httpx.AsyncClient(timeout=3) as client:
            r = await client.get(f"{FLINK_URL}/jobs/overview")
            if r.status_code == 200:
                jobs = r.json().get("jobs", [])
                flink_jobs = [{"id": j["jid"], "name": j["name"], "state": j["state"]} for j in jobs]
                flink_status = "online"
    except Exception:
        flink_status = "offline"

    # Counts
    alerts_unacked = await db.alerts.count_documents({"acknowledged": False})
    active_cases = await db.cases.count_documents({"status": "active"})

    return {
        "mongodb": mongo_status,
        "flink": flink_status,
        "flink_jobs": flink_jobs,
        "active_cases": active_cases,
        "unacked_alerts": alerts_unacked,
    }


@router.get("/cassandra")
async def cassandra_metrics():
    """Returns row count from Cassandra vitals table via REST (nodetool proxy)."""
    # In a real setup we'd query Cassandra directly.
    # For demo we return the last recorded metric from pipeline_health collection.
    db = get_db()
    doc = await db.pipeline_health.find_one(
        {"component": "cassandra"},
        {"_id": 0},
        sort=[("recorded_at", -1)]
    )
    return doc or {"component": "cassandra", "status": "no data yet"}


@router.get("/kafka")
async def kafka_metrics():
    db = get_db()
    doc = await db.pipeline_health.find_one(
        {"component": "kafka"},
        {"_id": 0},
        sort=[("recorded_at", -1)]
    )
    return doc or {"component": "kafka", "status": "no data yet"}


from app.outlier_rules import get_active_outliers, get_active_outlier_count, METRIC_RULES


from pydantic import BaseModel
from typing import Optional

class ReadingInjection(BaseModel):
    or_id: str = "OR-2"
    patient_id: str = "vdb-patient-102"
    metric: str = "syst_bp"
    value: float = 70.0
    current_ts_s: Optional[float] = None


@router.get("/rules")
async def get_outlier_rules():
    """Single source of truth rules config for outlier detection."""
    return METRIC_RULES


@router.get("/outliers/active")
async def active_outliers_endpoint(current_ts_s: Optional[float] = None):
    """
    Returns only ACTIVE outliers:
    - latest reading still violates its rule, OR
    - last violating reading was within 60s (D1 window).
    True count is returned without any artificial limit cap.
    """
    active = get_active_outliers(current_ts_s=current_ts_s)
    return {
        "count": len(active),
        "active_outliers": active
    }


@router.post("/inject")
async def inject_reading(req: ReadingInjection):
    """Inject a specific vital reading for P6 acceptance testing."""
    from app.outlier_rules import register_reading
    res = register_reading(
        req.patient_id,
        req.or_id,
        req.metric,
        req.value,
        current_ts_s=req.current_ts_s
    )
    return {
        "status": "ok",
        "or_id": req.or_id,
        "metric": req.metric,
        "value": req.value,
        "evaluation": res
    }


@router.post("/outliers/clear")
async def clear_outliers_endpoint():
    """Clears in-memory active outliers store."""
    from app.outlier_rules import clear_active_outliers
    clear_active_outliers()
    return {"status": "cleared"}


@router.get("/outliers")
async def cassandra_outliers(limit: int = 50, active_only: bool = False):
    """Returns active or recent outliers flagged by Cassandra."""
    if active_only:
        active = get_active_outliers()
        return {"count": len(active), "outliers": active}

    try:
        from consumer.consumer_cassandra import connect_cassandra
        cluster, session = connect_cassandra()
        rows = session.execute("""
            SELECT or_id, reading_date, ts, patient_id, metric, val, outlier_reason, severity
            FROM outliers_by_or
            LIMIT %s
        """, (limit,))
        outliers = [
            {
                "or_id": r.or_id,
                "reading_date": str(r.reading_date),
                "ts": r.ts.isoformat() if r.ts else None,
                "patient_id": r.patient_id,
                "metric": r.metric,
                "val": r.val,
                "outlier_reason": r.outlier_reason,
                "severity": r.severity,
            }
            for r in rows
        ]
        cluster.shutdown()
        return {"count": len(outliers), "outliers": outliers}
    except Exception as e:
        return {"count": 0, "outliers": [], "error": str(e)}

