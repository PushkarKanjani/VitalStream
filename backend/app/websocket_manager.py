"""WebSocket connection manager + MongoDB change-stream listener."""

from __future__ import annotations
import json
import logging
from datetime import datetime
from fastapi import WebSocket
from motor.motor_asyncio import AsyncIOMotorDatabase

import asyncio
import math
import os
import random
import threading
import time
from datetime import datetime, timezone
from fastapi import WebSocket
from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger("vitalstream.ws")

OR_IDS = [f"OR-{i}" for i in range(1, 7)]
KAFKA_BOOTSTRAP = os.getenv("KAFKA_BOOTSTRAP", "localhost:9093")
TOPIC_VITALS    = os.getenv("KAFKA_TOPIC_VITALS", "vitals.raw")

# Real-time cache holding latest vitals per OR for instant hydration
latest_vitals: dict[str, dict] = {}


class ConnectionManager:
    """Tracks all active WebSocket connections and broadcasts to all."""

    def __init__(self):
        self.active: list[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active.append(ws)
        logger.info(f"WS connected. Total: {len(self.active)}")
        # Immediately hydrate client with latest vitals for all 6 ORs
        for or_id in OR_IDS:
            if or_id in latest_vitals:
                try:
                    await ws.send_text(json.dumps({"event": "vitals", "data": latest_vitals[or_id]}))
                except Exception:
                    pass

    def disconnect(self, ws: WebSocket):
        if ws in self.active:
            self.active.remove(ws)
        logger.info(f"WS disconnected. Total: {len(self.active)}")

    async def broadcast(self, message: dict):
        payload = json.dumps(message, default=str)
        dead = []
        for ws in self.active:
            try:
                await ws.send_text(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)


async def change_stream_listener(db: AsyncIOMotorDatabase, manager: ConnectionManager):
    """
    Watches 3 MongoDB collections for changes and broadcasts to all WS clients.
    Attempts MongoDB change-streams first; if not on a replica set, falls back to periodic heartbeat.
    """
    import asyncio
    pipeline = [{"$match": {"operationType": {"$in": ["insert", "update", "replace"]}}}]

    logger.info("Starting MongoDB change-stream watchers…")

    async def watch_collection(collection_name: str, event_type: str):
        collection = db[collection_name]
        async with collection.watch(pipeline, full_document="updateLookup") as stream:
            async for change in stream:
                doc = change.get("fullDocument") or {}
                doc.pop("_id", None)
                await manager.broadcast({
                    "event": event_type,
                    "collection": collection_name,
                    "operation": change["operationType"],
                    "data": doc,
                    "ts": datetime.utcnow().isoformat(),
                })

    try:
        await asyncio.gather(
            watch_collection("alerts", "alert_change"),
            watch_collection("cases",  "case_change"),
            watch_collection("beds",   "bed_change"),
        )
    except Exception as e:
        logger.warning(f"Change streams unavailable on standalone MongoDB ({e}). Falling back to heartbeat loop.")
        while True:
            await asyncio.sleep(3)
            if manager.active:
                try:
                    unacked_count = await db.alerts.count_documents({"acknowledged": False})
                    await manager.broadcast({
                        "event": "heartbeat",
                        "unacked_alerts": unacked_count,
                        "ts": datetime.utcnow().isoformat(),
                    })
                except Exception:
                    pass


def _kafka_consumer_thread(queue: asyncio.Queue, loop: asyncio.AbstractEventLoop):
    """Background thread reading live telemetry from Kafka topic vitals.raw."""
    try:
        from kafka import KafkaConsumer
        consumer = KafkaConsumer(
            TOPIC_VITALS,
            bootstrap_servers=KAFKA_BOOTSTRAP,
            api_version=(2, 5, 0),
            group_id="vitalstream-ui-ws-consumer",
            auto_offset_reset="latest",
            enable_auto_commit=True,
            value_deserializer=lambda m: json.loads(m.decode("utf-8")),
            consumer_timeout_ms=1000,
        )
        logger.info(f"✓ WebSocket Kafka listener attached to {KAFKA_BOOTSTRAP} on {TOPIC_VITALS}")
        while True:
            for msg in consumer:
                loop.call_soon_threadsafe(queue.put_nowait, msg.value)
    except Exception as e:
        logger.warning(f"Kafka consumer thread stopped or unavailable ({e}) — using physiological baseline stream.")


async def vitals_stream_worker(manager: ConnectionManager):
    """
    Broadcasts real-time vitals for all 6 ORs to every connected WebSocket client.
    Streams from Kafka topic vitals.raw whenever messages arrive, and maintains continuous
    natural physiological micro-variations so charts and cards are always dynamic and responsive.
    """
    queue: asyncio.Queue = asyncio.Queue()
    loop = asyncio.get_running_loop()

    # Start Kafka background reader
    t = threading.Thread(target=_kafka_consumer_thread, args=(queue, loop), daemon=True)
    t.start()

    # Fixed window of 20 values per OR suite — iterated at 800ms for smooth real-time clinical monitoring
    # Dummy clinical outliers and alerts are seeded across every OR window (OR-1 to OR-6)
    WINDOW_SIZE = 20

    def generate_fixed_window(or_idx: int) -> list[dict]:
        base_hr    = 68.0 + (or_idx * 3.5)
        base_sbp   = 112.0 + (or_idx * 4.0)
        base_dbp   = 74.0 + (or_idx * 1.5)
        base_spo2  = 99.0 - (or_idx * 0.12)
        base_temp  = 36.7 + (or_idx * 0.06)
        base_etco2 = 35.0 + (or_idx * 0.4)

        points = []
        for j in range(WINDOW_SIZE):
            rad  = (j / WINDOW_SIZE) * 2 * math.pi
            rad2 = (j / WINDOW_SIZE) * 4 * math.pi
            noise = math.sin(rad * 5.3 + 0.7) * 0.25

            hr    = round(base_hr   + math.sin(rad) * 3.0 + math.cos(rad2) * 1.0 + noise, 1)
            sbp   = round(base_sbp  + math.sin(rad + 0.4) * 4.5 + math.cos(rad2) * 1.2, 1)
            dbp   = round(base_dbp  + math.sin(rad + 0.4) * 2.0, 1)
            spo2  = round(min(100.0, base_spo2 + math.cos(rad) * 0.3 + math.sin(rad2) * 0.1), 1)
            temp  = round(base_temp + math.sin(rad * 0.5) * 0.10, 2)
            etco2 = round(base_etco2 + math.sin(rad + 0.8) * 1.8 + math.cos(rad2) * 0.4, 1)

            is_outlier = False
            outlier_reason = None
            severity = None
            metric = None
            val = None
            alert_type = None
            threshold = None

            # ── OR-1: Coronary Bypass — SpO₂ desaturation & Tachycardia ──
            rule = None
            expected_low = None
            expected_high = None
            z_score = None
            unit = ""

            # ── Only OR-2 has an active clinical outlier (Hypotensive event: SBP 70.0 mmHg) ──
            # Other rooms (OR-1, OR-3, OR-4, OR-5, OR-6) operate within normal stable ranges
            # to mirror authentic clinical environments and prevent alarm fatigue.
            if or_idx == 2:
                if j == 5:
                    sbp = 70.0
                    is_outlier = True
                    metric = "syst_bp"
                    val = sbp
                    unit = "mmHg"
                    rule = "THRESHOLD"
                    expected_low = 75.0
                    expected_high = 180.0
                    outlier_reason = f"SBP {val:.1f} mmHg | below {expected_low} | THRESHOLD"
                    severity = "CRITICAL"
                    alert_type = "BP_LOW"
                    threshold = 75.0

            points.append({
                "or_id": f"OR-{or_idx}",
                "patient_id": f"vdb-patient-{100 + or_idx}",
                "case_id": f"CASE-00{or_idx}",
                "hr":       hr,
                "syst_bp":  sbp,
                "dias_bp":  dbp,
                "o2_sat":   spo2,
                "temp_c":   temp,
                "etco2":    etco2,
                "is_outlier":     is_outlier,
                "outlier_reason": outlier_reason,
                "metric":         metric,
                "val":            val,
                "unit":           unit,
                "rule":           rule,
                "expected_low":   expected_low,
                "expected_high":  expected_high,
                "z_score":        z_score,
                "severity":       severity,
                "alert_type":     alert_type,
                "threshold":      threshold,
            })
        return points

    or_windows = {f"OR-{i}": generate_fixed_window(i) for i in range(1, 7)}
    current_step = 0

    from app.outlier_rules import register_reading, get_active_outliers, METRIC_RULES

    # Try connecting to Cassandra for recording flagged outliers
    cass_session = None
    try:
        from consumer.consumer_cassandra import connect_cassandra
        _, cass_session = connect_cassandra()
        logger.info("✓ WebSocket worker connected to Cassandra for live outlier writes")
    except Exception as e:
        logger.warning(f"Cassandra connection skipped in WS worker ({e})")

    # Pre-populate latest_vitals cache with step 0
    now_utc_init = datetime.now(timezone.utc)
    for or_id, w in or_windows.items():
        v = dict(w[0])
        v["timestamp"] = now_utc_init.isoformat()
        v["ts_utc_ms"] = int(now_utc_init.timestamp() * 1000)
        latest_vitals[or_id] = v

    last_kafka_ts = {or_id: 0.0 for or_id in OR_IDS}

    while True:
        now_ts = time.time()
        now_utc = datetime.now(timezone.utc)
        now_iso = now_utc.isoformat()
        ts_utc_ms = int(now_utc.timestamp() * 1000)
        today_date = now_utc.date()

        # 1. Forward incoming Kafka messages if active
        while not queue.empty():
            try:
                rec = queue.get_nowait()
                or_id = rec.get("or_id")
                if or_id in or_windows:
                    last_kafka_ts[or_id] = now_ts
                    v_data = {
                        "or_id": or_id,
                        "patient_id": rec.get("patient_id") or f"vdb-patient-{or_id}",
                        "case_id": rec.get("case_id") or f"CASE-{or_id}",
                        "hr": rec.get("hr"),
                        "syst_bp": rec.get("syst_bp"),
                        "dias_bp": rec.get("dias_bp"),
                        "o2_sat": rec.get("o2_sat"),
                        "temp_c": rec.get("temp_c"),
                        "etco2": rec.get("etco2"),
                        "is_outlier": rec.get("is_outlier", False),
                        "outlier_reason": rec.get("outlier_reason"),
                        "timestamp": rec.get("timestamp") or now_iso,
                        "ts_utc_ms": ts_utc_ms,
                    }
                    latest_vitals[or_id] = v_data
                    await manager.broadcast({"event": "vitals", "data": v_data})
            except Exception:
                pass

        # 2. Iterate over the fixed 20-value window for ORs without external Kafka feed
        current_step = (current_step + 1) % WINDOW_SIZE

        for or_id in OR_IDS:
            if now_ts - last_kafka_ts[or_id] > 1.2:
                template = or_windows[or_id][current_step]
                v_data = dict(template)
                v_data["timestamp"] = now_iso
                v_data["ts_utc_ms"] = ts_utc_ms

                # Register reading in active outlier tracker
                if v_data.get("is_outlier") and v_data.get("metric"):
                    register_reading(
                        v_data["patient_id"],
                        or_id,
                        v_data["metric"],
                        float(v_data["val"]),
                        current_ts_s=now_ts
                    )
                else:
                    # Register normal metrics
                    for m_name, m_val in [("hr", v_data["hr"]), ("syst_bp", v_data["syst_bp"]), ("o2_sat", v_data["o2_sat"])]:
                        if m_val is not None:
                            register_reading(
                                v_data["patient_id"],
                                or_id,
                                m_name,
                                float(m_val),
                                current_ts_s=now_ts
                            )

                active_outliers = get_active_outliers(current_ts_s=now_ts)
                v_data["active_outliers"] = active_outliers

                # If dummy outlier is flagged, record it into Cassandra AND MongoDB alerts
                if v_data.get("is_outlier"):
                    # 1. Cassandra write to both patient_outliers and outliers_by_or
                    if cass_session:
                        try:
                            # P2 patient_outliers write
                            cass_session.execute("""
                                INSERT INTO patient_outliers
                                  (patient_id, bucket_date, ts_utc_ms, or_id, metric, value, unit, rule, expected_low, expected_high, z_score, severity)
                                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                            """, (
                                v_data["patient_id"], today_date, ts_utc_ms,
                                or_id, v_data["metric"], float(v_data["val"]),
                                v_data.get("unit") or "", v_data.get("rule") or "THRESHOLD",
                                float(v_data.get("expected_low") or 0.0), float(v_data.get("expected_high") or 0.0),
                                float(v_data.get("z_score")) if v_data.get("z_score") is not None else None,
                                v_data.get("severity") or "CRITICAL"
                            ))

                            cass_session.execute("""
                                INSERT INTO latest_vitals_by_or
                                  (or_id, patient_id, ts, hr, syst_bp, dias_bp, o2_sat, temp_c, is_outlier, outlier_reason)
                                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                            """, (
                                or_id, v_data["patient_id"], now_utc,
                                float(v_data["hr"]), float(v_data["syst_bp"]), float(v_data["dias_bp"]),
                                float(v_data["o2_sat"]), float(v_data["temp_c"]),
                                True, v_data["outlier_reason"]
                            ))
                            cass_session.execute("""
                                INSERT INTO outliers_by_or
                                  (or_id, reading_date, ts, patient_id, metric, val, outlier_reason, severity)
                                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                            """, (
                                or_id, today_date, now_utc,
                                v_data["patient_id"], v_data.get("metric", "hr"), float(v_data.get("val", v_data["hr"])),
                                v_data["outlier_reason"], v_data.get("severity", "CRITICAL")
                            ))
                            logger.info(f"🚨 Recorded flagged outlier in Cassandra: {or_id} - {v_data['outlier_reason']}")
                        except Exception as ce:
                            logger.debug(f"Cassandra outlier write: {ce}")

                    # 2. MongoDB Alerts & WebSocket Broadcast
                    try:
                        db = get_db()
                        metric_tag = (v_data.get("metric") or "HR").upper()
                        alert_id = f"ALT-{or_id}-{metric_tag}"
                        alert_doc = {
                            "alert_id": alert_id,
                            "case_id": v_data["case_id"],
                            "patient_id": v_data["patient_id"],
                            "or_id": or_id,
                            "alert_type": v_data.get("alert_type") or "HR_HIGH",
                            "severity": "critical" if v_data.get("severity") == "CRITICAL" else "warning",
                            "message": v_data["outlier_reason"],
                            "value": float(v_data.get("val") or v_data["hr"]),
                            "threshold": float(v_data.get("threshold") or 140.0),
                            "created_at": now_utc,
                            "acknowledged": False,
                            "acknowledged_by": None,
                            "acknowledged_at": None,
                            "escalation_tier": 1,
                        }
                        await db.alerts.update_one(
                            {"alert_id": alert_id},
                            {"$set": alert_doc},
                            upsert=True
                        )
                        # Broadcast alert to all active UI clients
                        alert_wire = dict(alert_doc)
                        alert_wire["created_at"] = now_iso
                        await manager.broadcast({"event": "alert_change", "data": alert_wire})
                    except Exception as me:
                        logger.debug(f"Alert upsert/broadcast error: {me}")

                latest_vitals[or_id] = v_data
                await manager.broadcast({"event": "vitals", "data": v_data})

        # Broadcast active outliers snapshot for true active counting
        all_active = get_active_outliers(current_ts_s=now_ts)
        await manager.broadcast({"event": "active_outliers", "data": all_active})

        await asyncio.sleep(0.8)  # 800ms comfortable cadence



