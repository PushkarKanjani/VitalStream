#!/usr/bin/env python3
"""
VitalStream — Kafka → Cassandra Consumer
Reads vitals from vitals.raw, writes to Cassandra vitals_by_patient_day
and vitals_by_or_day tables. Batches writes for throughput.

Usage:
    python consumer_cassandra.py

Requires:
    - Kafka running on localhost:9093 (external listener)
    - Cassandra running on localhost:9042
    - .env file with connection settings
"""

import json
import logging
import math
import os
import time
from datetime import datetime, date

os.environ["CASS_DRIVER_NO_EXTENSIONS"] = "1"
os.environ["CASS_DRIVER_NO_CYTHON"] = "1"

from cassandra.cluster import Cluster, ExecutionProfile, EXEC_PROFILE_DEFAULT
from cassandra.policies import DCAwareRoundRobinPolicy, AddressTranslator
from cassandra.query import BatchStatement, ConsistencyLevel
from dotenv import load_dotenv
from kafka import KafkaConsumer

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s [CONSUMER] %(message)s")
logger = logging.getLogger(__name__)

# ── Config ────────────────────────────────────────────────────────────────────
KAFKA_BOOTSTRAP = os.getenv("KAFKA_BOOTSTRAP", "localhost:9093")
KAFKA_TOPIC     = os.getenv("KAFKA_TOPIC_VITALS", "vitals.raw")
KAFKA_GROUP     = os.getenv("KAFKA_GROUP_ID", "vitalstream-consumer")
KAFKA_RESET     = os.getenv("KAFKA_AUTO_OFFSET_RESET", "latest")
_raw_host       = os.getenv("CASSANDRA_HOST", "127.0.0.1")
CASS_HOST       = "127.0.0.1" if _raw_host in ("localhost", "127.0.0.1") else _raw_host
CASS_PORT       = int(os.getenv("CASSANDRA_PORT", "9042"))
CASS_KEYSPACE   = os.getenv("CASSANDRA_KEYSPACE", "vitalstream")

from collections import defaultdict, deque
import statistics

BATCH_SIZE = 50        # rows per Cassandra batch
REPORT_EVERY = 500     # log every N rows


class WindowOutlierDetector:
    """
    Fixed-window outlier detector (10 to 20 values).
    Iterates over a sliding buffer of the last 20 readings per metric per OR.
    Flags readings that breach clinical safety thresholds or exceed 2.5 standard deviations.
    """
    def __init__(self, window_size: int = 20):
        self.window_size = window_size
        self.windows = defaultdict(lambda: deque(maxlen=self.window_size))

    def evaluate(self, or_id: str, hr: float | None, syst_bp: float | None,
                 dias_bp: float | None, o2_sat: float | None, temp_c: float | None):
        """Returns (is_outlier, outlier_reason, metric, value, severity)."""
        metrics = {
            "hr": (hr, 45.0, 140.0, "Heart Rate"),
            "syst_bp": (syst_bp, 75.0, 180.0, "Systolic BP"),
            "o2_sat": (o2_sat, 85.0, 100.0, "Oxygen Saturation"),
            "temp_c": (temp_c, 35.0, 39.5, "Temperature"),
        }

        for metric_name, (val, min_bound, max_bound, label) in metrics.items():
            if val is None:
                continue

            buf = self.windows[(or_id, metric_name)]
            buf.append(val)

            # 1. Absolute clinical safety outlier threshold
            if val < min_bound or val > max_bound:
                reason = f"Clinical Outlier: {label} {val} outside bounds [{min_bound}, {max_bound}]"
                return True, reason, metric_name, val, "CRITICAL"

            # 2. Window-based statistical Z-score outlier (over 10-20 sample window)
            if len(buf) >= 10:
                mean = statistics.mean(buf)
                stdev = statistics.stdev(buf)
                if stdev > 0.01:
                    z = abs(val - mean) / stdev
                    if z >= 2.5:
                        reason = f"Statistical Outlier: {label} {val} (Z-score: {z:.2f} > 2.5 over {len(buf)}-reading window)"
                        return True, reason, metric_name, val, "WARNING"

        return False, None, None, None, None


class LocalhostTranslator(AddressTranslator):
    def translate(self, addr):
        return CASS_HOST if CASS_HOST in ("127.0.0.1", "localhost") else addr


def to_float(val):
    if val is None:
        return None
    try:
        f = float(val)
        return None if (math.isnan(f) or math.isinf(f)) else round(f, 2)
    except (ValueError, TypeError):
        return None


def connect_cassandra():
    profile = ExecutionProfile(
        load_balancing_policy=DCAwareRoundRobinPolicy(local_dc="datacenter1"),
        consistency_level=ConsistencyLevel.LOCAL_ONE,
    )
    kwargs = {}
    if CASS_HOST in ("127.0.0.1", "localhost"):
        kwargs["address_translator"] = LocalhostTranslator()

    cluster = Cluster(
        [CASS_HOST],
        port=CASS_PORT,
        protocol_version=5,
        execution_profiles={EXEC_PROFILE_DEFAULT: profile},
        **kwargs
    )
    session = cluster.connect(CASS_KEYSPACE)
    logger.info(f"✓ Cassandra connected ({CASS_HOST}:{CASS_PORT})")
    return cluster, session


def prepare_statements(session):
    insert_by_patient = session.prepare("""
        INSERT INTO vitals_by_patient_day
          (patient_id, reading_date, ts, or_id, hr, syst_bp, dias_bp, o2_sat, temp_c, etco2, raw_source, is_outlier, outlier_reason)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """)
    insert_by_or = session.prepare("""
        INSERT INTO vitals_by_or_day
          (or_id, reading_date, ts, patient_id, hr, syst_bp, dias_bp, o2_sat, temp_c, is_outlier, outlier_reason)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """)
    update_latest = session.prepare("""
        INSERT INTO latest_vitals_by_or
          (or_id, patient_id, ts, hr, syst_bp, dias_bp, o2_sat, temp_c, is_outlier, outlier_reason)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """)
    insert_outlier = session.prepare("""
        INSERT INTO outliers_by_or
          (or_id, reading_date, ts, patient_id, metric, val, outlier_reason, severity)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """)
    return insert_by_patient, insert_by_or, update_latest, insert_outlier


def main():
    cluster, session = connect_cassandra()
    stmt_patient, stmt_or, stmt_latest, stmt_outlier = prepare_statements(session)
    detector = WindowOutlierDetector(window_size=20)

    consumer = KafkaConsumer(
        KAFKA_TOPIC,
        bootstrap_servers=KAFKA_BOOTSTRAP,
        api_version=(2, 5, 0),
        group_id=KAFKA_GROUP,
        auto_offset_reset=KAFKA_RESET,
        enable_auto_commit=True,
        value_deserializer=lambda m: json.loads(m.decode("utf-8")),
        max_poll_records=200,
    )
    logger.info(f"✓ Kafka consumer started ({KAFKA_BOOTSTRAP}) → topic: {KAFKA_TOPIC}")

    batch = BatchStatement(consistency_level=ConsistencyLevel.LOCAL_ONE)
    batch_count = 0
    total = 0
    outliers_flagged = 0
    t0 = time.time()

    try:
        for msg in consumer:
            v = msg.value
            ts = datetime.fromisoformat(v["timestamp"])
            d  = ts.date()

            hr = to_float(v.get("hr"))
            syst_bp = to_float(v.get("syst_bp"))
            dias_bp = to_float(v.get("dias_bp"))
            o2_sat = to_float(v.get("o2_sat"))
            temp_c = to_float(v.get("temp_c"))
            etco2 = to_float(v.get("etco2"))
            source = v.get("source", "vitaldb")

            # Fixed-window Outlier Evaluation (iterating over 10-20 sample window)
            is_outlier, reason, metric, val, severity = detector.evaluate(
                v["or_id"], hr, syst_bp, dias_bp, o2_sat, temp_c
            )

            if is_outlier:
                outliers_flagged += 1
                logger.warning(f"🚨 [CASSANDRA OUTLIER FLAGGED] {v['or_id']} {reason}")
                try:
                    session.execute(stmt_outlier, (
                        v["or_id"], d, ts, v["patient_id"], metric, val, reason, severity
                    ))
                except Exception as oe:
                    logger.warning(f"Could not write to outliers_by_or: {oe}")

            batch.add(stmt_patient, (
                v["patient_id"], d, ts,
                v["or_id"],
                hr, syst_bp, dias_bp,
                o2_sat, temp_c, etco2,
                source,
                is_outlier,
                reason
            ))
            batch.add(stmt_or, (
                v["or_id"], d, ts, v["patient_id"],
                hr, syst_bp, dias_bp,
                o2_sat, temp_c,
                is_outlier,
                reason
            ))
            # Always upsert latest (single-row per OR)
            session.execute(stmt_latest, (
                v["or_id"], v["patient_id"], ts,
                hr, syst_bp, dias_bp,
                o2_sat, temp_c,
                is_outlier,
                reason
            ))

            batch_count += 1
            total += 1

            if batch_count >= BATCH_SIZE:
                session.execute(batch)
                batch = BatchStatement(consistency_level=ConsistencyLevel.LOCAL_ONE)
                batch_count = 0

            if total % REPORT_EVERY == 0:
                elapsed = time.time() - t0
                logger.info(f"✓ {total} rows written | {total/max(0.001, elapsed):.1f} rows/sec")
    except KeyboardInterrupt:
        logger.info("Consumer stopping by user request...")
    finally:
        if batch_count > 0:
            logger.info(f"Flushing final batch of {batch_count} records to Cassandra...")
            session.execute(batch)
        consumer.close()
        cluster.shutdown()
        logger.info(f"✓ Consumer terminated cleanly. Total rows written: {total}")


if __name__ == "__main__":
    main()
