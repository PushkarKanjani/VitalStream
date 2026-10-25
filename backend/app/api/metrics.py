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
