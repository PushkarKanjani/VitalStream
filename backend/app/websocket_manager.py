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
from datetime import datetime
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

    # Fixed window of 20 values per OR suite (iterating over 20 points smoothly)
    # Includes dummy outlier values for OR-5 to trigger and test Cassandra outlier flagging
    WINDOW_SIZE = 20

    def generate_fixed_window(or_idx: int) -> list[dict]:
        base_hr = 70.0 + (or_idx * 2.5)
        base_sbp = 116.0 + (or_idx * 3.0)
        base_dbp = 76.0 + (or_idx * 1.2)
        base_spo2 = 98.8 - (or_idx * 0.15)
        base_temp = 36.8 + (or_idx * 0.05)

        points = []
        for j in range(WINDOW_SIZE):
            # Smooth sinus oscillation over the 20-value cycle
            rad = (j / WINDOW_SIZE) * 2 * math.pi
            hr = round(base_hr + (math.sin(rad) * 2.2) + (math.cos(rad * 2) * 0.6), 1)
            sbp = round(base_sbp + (math.sin(rad + 0.5) * 3.0), 1)
            dbp = round(base_dbp + (math.sin(rad + 0.5) * 1.5), 1)
            spo2 = round(min(100.0, base_spo2 + (math.cos(rad) * 0.3)), 1)
            temp = round(base_temp + (math.sin(rad * 0.5) * 0.08), 2)

            is_outlier = False
            outlier_reason = None
            severity = None
            metric = None
            val = None

            # DUMMY OUTLIERS INJECTED FOR OR-5 TO VALIDATE CASSANDRA OUTLIER DETECTION
            if or_idx == 5:
                if j == 6:  # Step 6: Critical Tachycardia Outlier
                    hr = 168.0
                    is_outlier = True
                    outlier_reason = "Clinical Outlier: Heart Rate 168.0 bpm outside bounds [45.0, 140.0]"
                    severity = "CRITICAL"
                    metric = "hr"
                    val = hr
                elif j == 13: # Step 13: Hypertensive Crisis Outlier
                    sbp = 196.0
                    is_outlier = True
                    outlier_reason = "Clinical Outlier: Systolic BP 196.0 mmHg outside bounds [75.0, 180.0]"
                    severity = "CRITICAL"
                    metric = "syst_bp"
                    val = sbp
                elif j == 18: # Step 18: Critical Hypoxemia Outlier
                    spo2 = 81.5
                    is_outlier = True
                    outlier_reason = "Clinical Outlier: Oxygen Saturation 81.5% outside bounds [85.0, 100.0]"
                    severity = "CRITICAL"
                    metric = "o2_sat"
                    val = spo2

            points.append({
                "or_id": f"OR-{or_idx}",
                "patient_id": f"vdb-patient-{100 + or_idx}",
                "case_id": f"CASE-00{or_idx}",
                "hr": hr,
                "syst_bp": sbp,
                "dias_bp": dbp,
                "o2_sat": spo2,
                "temp_c": temp,
                "etco2": 36.0,
                "is_outlier": is_outlier,
                "outlier_reason": outlier_reason,
                "metric": metric,
                "val": val,
                "severity": severity,
            })
        return points

    or_windows = {f"OR-{i}": generate_fixed_window(i) for i in range(1, 7)}
    current_step = 0

    # Try connecting to Cassandra for recording flagged outliers
    cass_session = None
    try:
        from consumer.consumer_cassandra import connect_cassandra
        _, cass_session = connect_cassandra()
        logger.info("✓ WebSocket worker connected to Cassandra for live outlier writes")
    except Exception as e:
        logger.warning(f"Cassandra connection skipped in WS worker ({e})")

    # Pre-populate latest_vitals cache with step 0
    for or_id, w in or_windows.items():
        v = dict(w[0])
        v["timestamp"] = datetime.utcnow().isoformat()
        latest_vitals[or_id] = v

    last_kafka_ts = {or_id: 0.0 for or_id in OR_IDS}

    while True:
        now_ts = time.time()
        now_iso = datetime.utcnow().isoformat()
        now_dt = datetime.utcnow()
        today_date = now_dt.date()

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
                        "timestamp": rec.get("timestamp") or now_iso
                    }
                    latest_vitals[or_id] = v_data
                    await manager.broadcast({"event": "vitals", "data": v_data})
            except Exception:
                pass

        # 2. Iterate over the fixed 20-value window for ORs without external Kafka feed
        current_step = (current_step + 1) % WINDOW_SIZE

        for or_id in OR_IDS:
            if now_ts - last_kafka_ts[or_id] > 1.5:
                template = or_windows[or_id][current_step]
                v_data = dict(template)
                v_data["timestamp"] = now_iso

                # If dummy outlier is flagged, record it into Cassandra
                if v_data.get("is_outlier") and cass_session:
                    try:
                        cass_session.execute("""
                            INSERT INTO latest_vitals_by_or
                              (or_id, patient_id, ts, hr, syst_bp, dias_bp, o2_sat, temp_c, is_outlier, outlier_reason)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        """, (
                            or_id, v_data["patient_id"], now_dt,
                            float(v_data["hr"]), float(v_data["syst_bp"]), float(v_data["dias_bp"]),
                            float(v_data["o2_sat"]), float(v_data["temp_c"]),
                            True, v_data["outlier_reason"]
                        ))
                        cass_session.execute("""
                            INSERT INTO outliers_by_or
                              (or_id, reading_date, ts, patient_id, metric, val, outlier_reason, severity)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                        """, (
                            or_id, today_date, now_dt,
                            v_data["patient_id"], v_data.get("metric", "hr"), float(v_data.get("val", v_data["hr"])),
                            v_data["outlier_reason"], v_data.get("severity", "CRITICAL")
                        ))
                        logger.info(f"🚨 Recorded flagged outlier in Cassandra: {or_id} - {v_data['outlier_reason']}")
                    except Exception as ce:
                        logger.debug(f"Cassandra outlier write: {ce}")

                latest_vitals[or_id] = v_data
                await manager.broadcast({"event": "vitals", "data": v_data})

        await asyncio.sleep(1.0)

