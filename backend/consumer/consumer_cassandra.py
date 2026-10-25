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
import os
import time
from datetime import datetime, date

from cassandra.cluster import Cluster, ExecutionProfile, EXEC_PROFILE_DEFAULT
from cassandra.policies import DCAwareRoundRobinPolicy
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
CASS_HOST       = os.getenv("CASSANDRA_HOST", "localhost")
CASS_PORT       = int(os.getenv("CASSANDRA_PORT", "9042"))
CASS_KEYSPACE   = os.getenv("CASSANDRA_KEYSPACE", "vitalstream")

BATCH_SIZE = 50        # rows per Cassandra batch
REPORT_EVERY = 500     # log every N rows


def connect_cassandra():
    profile = ExecutionProfile(
        load_balancing_policy=DCAwareRoundRobinPolicy(local_dc="datacenter1"),
        consistency_level=ConsistencyLevel.LOCAL_ONE,
    )
    cluster = Cluster(
        [CASS_HOST],
        port=CASS_PORT,
        execution_profiles={EXEC_PROFILE_DEFAULT: profile}
    )
    session = cluster.connect(CASS_KEYSPACE)
    logger.info(f"✓ Cassandra connected ({CASS_HOST}:{CASS_PORT})")
    return session


def prepare_statements(session):
    insert_by_patient = session.prepare("""
        INSERT INTO vitals_by_patient_day
          (patient_id, reading_date, ts, or_id, hr, syst_bp, dias_bp, o2_sat, temp_c, etco2, raw_source)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """)
    insert_by_or = session.prepare("""
        INSERT INTO vitals_by_or_day
          (or_id, reading_date, ts, patient_id, hr, syst_bp, dias_bp, o2_sat, temp_c)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """)
    update_latest = session.prepare("""
        INSERT INTO latest_vitals_by_or
          (or_id, patient_id, ts, hr, syst_bp, dias_bp, o2_sat, temp_c)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """)
    return insert_by_patient, insert_by_or, update_latest


def main():
    session = connect_cassandra()
    stmt_patient, stmt_or, stmt_latest = prepare_statements(session)

    consumer = KafkaConsumer(
        KAFKA_TOPIC,
        bootstrap_servers=KAFKA_BOOTSTRAP,
        group_id=KAFKA_GROUP,
        auto_offset_reset="latest",
        enable_auto_commit=True,
        value_deserializer=lambda m: json.loads(m.decode("utf-8")),
        max_poll_records=200,
    )
    logger.info(f"✓ Kafka consumer started ({KAFKA_BOOTSTRAP}) → topic: {KAFKA_TOPIC}")

    batch = BatchStatement(consistency_level=ConsistencyLevel.LOCAL_ONE)
    batch_count = 0
    total = 0
    t0 = time.time()

    for msg in consumer:
        v = msg.value
        ts = datetime.fromisoformat(v["timestamp"])
        d  = ts.date()

        batch.add(stmt_patient, (
            v["patient_id"], d, ts,
            v["or_id"],
            v.get("hr"),  v.get("syst_bp"), v.get("dias_bp"),
            v.get("o2_sat"), v.get("temp_c"), v.get("etco2"),
            v.get("source", "vitaldb")
        ))
        batch.add(stmt_or, (
            v["or_id"], d, ts, v["patient_id"],
            v.get("hr"), v.get("syst_bp"), v.get("dias_bp"),
            v.get("o2_sat"), v.get("temp_c")
        ))
        # Always upsert latest (single-row per OR)
        session.execute(stmt_latest, (
            v["or_id"], v["patient_id"], ts,
            v.get("hr"), v.get("syst_bp"), v.get("dias_bp"),
            v.get("o2_sat"), v.get("temp_c")
        ))

        batch_count += 1
        total += 1

        if batch_count >= BATCH_SIZE:
            session.execute(batch)
            batch = BatchStatement(consistency_level=ConsistencyLevel.LOCAL_ONE)
            batch_count = 0

        if total % REPORT_EVERY == 0:
            elapsed = time.time() - t0
            logger.info(f"✓ {total} rows written | {total/elapsed:.1f} rows/sec")


if __name__ == "__main__":
    main()
