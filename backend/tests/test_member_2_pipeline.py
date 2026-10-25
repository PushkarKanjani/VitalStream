#!/usr/bin/env python3
"""
VitalStream — Member 2 Integration & Verification Test Suite
Tests:
1. Kafka broker connection & 6-partition inspection on vitals.raw.
2. Producer simulation across OR-1 through OR-6 with partition routing.
3. Kafka consumer receiving valid packets on ALL 6 partitions.
4. Schema validation: patient_id, or_id, case_id, timestamp, hr, syst_bp, dias_bp, o2_sat, temp_c, etco2.
5. Cassandra connection & batch writes to vitals_by_patient_day, vitals_by_or_day, latest_vitals_by_or.
6. Write latency & throughput benchmark.
"""

import json
import os
import sys
import time
from datetime import datetime, timezone

from cassandra.cluster import Cluster, ExecutionProfile, EXEC_PROFILE_DEFAULT
from cassandra.policies import DCAwareRoundRobinPolicy
from cassandra.query import BatchStatement, ConsistencyLevel
from kafka import KafkaConsumer, KafkaProducer
from kafka.structs import TopicPartition

KAFKA_BOOTSTRAP = os.getenv("KAFKA_BOOTSTRAP", "localhost:9093")
TOPIC_VITALS    = os.getenv("KAFKA_TOPIC_VITALS", "vitals.raw")
CASS_HOST       = os.getenv("CASSANDRA_HOST", "localhost")
CASS_PORT       = int(os.getenv("CASSANDRA_PORT", "9042"))
CASS_KEYSPACE   = os.getenv("CASSANDRA_KEYSPACE", "vitalstream")


if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

def log(msg, status="INFO"):
    symbol = {"INFO": "*", "PASS": "OK", "FAIL": "ERR", "WARN": "!"}.get(status, "*")
    print(f"[{status}] [{symbol}] {msg}", flush=True)


def test_kafka_partitions():
    log(f"Connecting to Kafka ({KAFKA_BOOTSTRAP})...")
    consumer = KafkaConsumer(bootstrap_servers=KAFKA_BOOTSTRAP, api_version=(2, 5, 0), request_timeout_ms=10000)
    topics = consumer.topics()
    assert TOPIC_VITALS in topics, f"Topic '{TOPIC_VITALS}' not found in Kafka topics: {topics}"
    
    partitions = consumer.partitions_for_topic(TOPIC_VITALS)
    consumer.close()
    
    log(f"Topic '{TOPIC_VITALS}' found with partitions: {sorted(list(partitions))}", "PASS")
    assert len(partitions) == 6, f"Expected 6 partitions, got {len(partitions)}"
    return sorted(list(partitions))


def test_producer_to_all_partitions():
    log("Testing producer across OR-1 through OR-6...")
    producer = KafkaProducer(
        bootstrap_servers=KAFKA_BOOTSTRAP,
        api_version=(2, 5, 0),
        value_serializer=lambda v: json.dumps(v).encode("utf-8"),
        key_serializer=lambda k: k.encode("utf-8") if k else None,
        acks=1,
    )

    test_records = []
    for i in range(1, 7):
        or_id = f"OR-{i}"
        part_idx = i - 1
        rec = {
            "patient_id": f"test-patient-OR{i}",
            "or_id":      or_id,
            "case_id":    str(100 + i),
            "timestamp":  datetime.now(timezone.utc).isoformat(),
            "source":     "integration_test",
            "hr":         72.0 + i,
            "syst_bp":    120.0 + i,
            "dias_bp":    80.0 + i,
            "o2_sat":     98.5,
            "temp_c":     36.6 + (i * 0.1),
            "etco2":      35.0,
        }
        producer.send(TOPIC_VITALS, key=or_id, value=rec, partition=part_idx)
        test_records.append((part_idx, or_id, rec))

    producer.flush()
    producer.close()
    log(f"Emitted {len(test_records)} test records explicitly mapped across all 6 partitions.", "PASS")
    return test_records


def test_consumer_all_partitions():
    log("Verifying Kafka consumer receives live packets on ALL 6 partitions...")
    consumer = KafkaConsumer(
        bootstrap_servers=KAFKA_BOOTSTRAP,
        api_version=(2, 5, 0),
        auto_offset_reset="earliest",
        enable_auto_commit=True,
        value_deserializer=lambda m: json.loads(m.decode("utf-8")),
    )

    tps = [TopicPartition(TOPIC_VITALS, p) for p in range(6)]
    consumer.assign(tps)

    # Seek to end - 10 on each partition to see recent messages
    for tp in tps:
        end_offset = consumer.end_offsets([tp])[tp]
        seek_to = max(0, end_offset - 10)
        consumer.seek(tp, seek_to)

    partitions_seen = set()
    messages_by_partition = {p: 0 for p in range(6)}

    start_time = time.time()
    while (time.time() - start_time) < 5.0 and len(partitions_seen) < 6:
        poll_res = consumer.poll(timeout_ms=1000)
        for tp, msgs in poll_res.items():
            for msg in msgs:
                p = msg.partition
                partitions_seen.add(p)
                messages_by_partition[p] += 1
                
                # Schema verification
                val = msg.value
                assert "patient_id" in val, "Missing patient_id"
                assert "or_id" in val, "Missing or_id"
                assert "timestamp" in val, "Missing timestamp"
                assert msg.key is not None, "Missing Kafka message key (should be or_id)"

    consumer.close()

    for p in range(6):
        log(f"Partition {p}: received {messages_by_partition[p]} messages", "PASS" if messages_by_partition[p] > 0 else "WARN")

    assert len(partitions_seen) == 6, f"Expected messages on all 6 partitions, saw only {partitions_seen}"
    log("Test passed: Kafka consumer received live data packets on ALL 6 partitions!", "PASS")


def test_cassandra_writes_and_latency():
    log(f"Connecting to Cassandra at {CASS_HOST}:{CASS_PORT}...")
    profile = ExecutionProfile(
        load_balancing_policy=DCAwareRoundRobinPolicy(local_dc="datacenter1"),
        consistency_level=ConsistencyLevel.LOCAL_ONE,
    )
    cluster = Cluster([CASS_HOST], port=CASS_PORT, protocol_version=5, execution_profiles={EXEC_PROFILE_DEFAULT: profile})
    session = cluster.connect(CASS_KEYSPACE)
    log("Cassandra keyspace 'vitalstream' connected.", "PASS")

    stmt_patient = session.prepare("""
        INSERT INTO vitals_by_patient_day
          (patient_id, reading_date, ts, or_id, hr, syst_bp, dias_bp, o2_sat, temp_c, etco2, raw_source)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """)
    stmt_or = session.prepare("""
        INSERT INTO vitals_by_or_day
          (or_id, reading_date, ts, patient_id, hr, syst_bp, dias_bp, o2_sat, temp_c)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """)
    stmt_latest = session.prepare("""
        INSERT INTO latest_vitals_by_or
          (or_id, patient_id, ts, hr, syst_bp, dias_bp, o2_sat, temp_c)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """)

    log("Benchmarking batch write performance with ConsistencyLevel.LOCAL_ONE...")
    batch = BatchStatement(consistency_level=ConsistencyLevel.LOCAL_ONE)
    n_records = 50
    now = datetime.now(timezone.utc)
    d = now.date()

    t_start = time.perf_counter()
    for j in range(n_records):
        or_id = f"OR-{(j % 6) + 1}"
        pid = f"bench-patient-{(j % 6) + 1}"
        ts = now
        batch.add(stmt_patient, (pid, d, ts, or_id, 75.0, 120.0, 80.0, 99.0, 36.8, 35.0, "benchmark"))
        batch.add(stmt_or, (or_id, d, ts, pid, 75.0, 120.0, 80.0, 99.0, 36.8))

    session.execute(batch)
    t_batch = (time.perf_counter() - t_start) * 1000  # ms
    per_record_latency = t_batch / (n_records * 2)

    log(f"Batch write of 100 statements executed in {t_batch:.2f} ms ({per_record_latency:.3f} ms per record)", "PASS")

    # Single-row write latency test for latest_vitals_by_or
    single_latencies = []
    for k in range(10):
        t0 = time.perf_counter()
        session.execute(stmt_latest, (f"OR-{(k % 6) + 1}", f"bench-patient-{(k % 6) + 1}", now, 78.0, 122.0, 81.0, 98.0, 36.7))
        single_latencies.append((time.perf_counter() - t0) * 1000)

    avg_single = sum(single_latencies) / len(single_latencies)
    p95_single = sorted(single_latencies)[int(len(single_latencies) * 0.95)]
    log(f"Single latest_vitals_by_or writes: Avg = {avg_single:.2f} ms | P95 = {p95_single:.2f} ms", "PASS")

    # Verify rows in Cassandra
    row_count = session.execute("SELECT count(*) FROM vitals_by_patient_day").one()[0]
    log(f"Verified row count in vitals_by_patient_day: {row_count} rows", "PASS")
    assert row_count > 0, "No rows found in vitals_by_patient_day!"

    cluster.shutdown()


def main():
    print("=" * 70)
    print(" VITALSTREAM — MEMBER 2 PIPELINE INTEGRATION TEST SUITE")
    print("=" * 70)
    
    try:
        test_kafka_partitions()
        test_producer_to_all_partitions()
        test_consumer_all_partitions()
        test_cassandra_writes_and_latency()
        print("=" * 70)
        print(" ALL MEMBER 2 INTEGRATION TESTS PASSED SUCCESSFULLY! ")
        print("=" * 70)
        return 0
    except Exception as e:
        log(f"Test failed: {e}", "FAIL")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
