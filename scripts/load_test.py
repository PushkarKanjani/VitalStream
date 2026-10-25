#!/usr/bin/env python3
"""
VitalStream — Load Test Script
Simulates sustained write load to Cassandra.
Measures: writes/sec, p50/p95/p99 latency.

Usage:
    python scripts/load_test.py --duration 60 --ors 6
"""

import argparse
import os
import random
import statistics
import time
from datetime import datetime, date, timezone

from cassandra.cluster import Cluster, ExecutionProfile, EXEC_PROFILE_DEFAULT
from cassandra.policies import DCAwareRoundRobinPolicy
from cassandra.query import ConsistencyLevel
from dotenv import load_dotenv

load_dotenv()

CASS_HOST     = os.getenv("CASSANDRA_HOST", "localhost")
CASS_PORT     = int(os.getenv("CASSANDRA_PORT", "9042"))
CASS_KEYSPACE = os.getenv("CASSANDRA_KEYSPACE", "vitalstream")


def connect():
    profile = ExecutionProfile(
        load_balancing_policy=DCAwareRoundRobinPolicy(local_dc="datacenter1"),
        consistency_level=ConsistencyLevel.LOCAL_ONE,
    )
    cluster = Cluster([CASS_HOST], port=CASS_PORT,
                      execution_profiles={EXEC_PROFILE_DEFAULT: profile})
    return cluster.connect(CASS_KEYSPACE)


def random_vital(or_id: str, patient_id: str) -> dict:
    return {
        "patient_id":   patient_id,
        "reading_date": date.today(),
        "ts":           datetime.now(timezone.utc),
        "or_id":        or_id,
        "hr":           random.uniform(60, 100),
        "syst_bp":      random.uniform(100, 140),
        "dias_bp":      random.uniform(60, 90),
        "o2_sat":       random.uniform(95, 100),
        "temp_c":       random.uniform(36.5, 37.5),
        "etco2":        random.uniform(35, 45),
        "raw_source":   "load_test",
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--duration", type=int, default=30, help="Test duration (seconds)")
    parser.add_argument("--ors",      type=int, default=6,  help="Number of simulated ORs")
    args = parser.parse_args()

    session = connect()
    stmt = session.prepare("""
        INSERT INTO vitals_by_patient_day
          (patient_id, reading_date, ts, or_id, hr, syst_bp, dias_bp, o2_sat, temp_c, etco2, raw_source)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """)

    print(f"\n{'='*60}")
    print(f"VitalStream Load Test — {args.ors} ORs, {args.duration}s")
    print(f"{'='*60}")

    latencies = []
    total_writes = 0
    t_start = time.time()
    t_end   = t_start + args.duration

    while time.time() < t_end:
        for i in range(1, args.ors + 1):
            or_id      = f"OR-{i}"
            patient_id = f"load-test-patient-{i}"
            v = random_vital(or_id, patient_id)

            t0 = time.perf_counter()
            session.execute(stmt, (
                v["patient_id"], v["reading_date"], v["ts"],
                v["or_id"], v["hr"], v["syst_bp"], v["dias_bp"],
                v["o2_sat"], v["temp_c"], v["etco2"], v["raw_source"]
            ))
            latency_ms = (time.perf_counter() - t0) * 1000
            latencies.append(latency_ms)
            total_writes += 1

    elapsed = time.time() - t_start
    latencies.sort()

    p50  = latencies[int(len(latencies) * 0.50)]
    p95  = latencies[int(len(latencies) * 0.95)]
    p99  = latencies[int(len(latencies) * 0.99)]
    mean = statistics.mean(latencies)

    print(f"\n✓ RESULTS")
    print(f"  Total writes : {total_writes}")
    print(f"  Duration     : {elapsed:.1f}s")
    print(f"  Throughput   : {total_writes/elapsed:.1f} writes/sec")
    print(f"  Latency p50  : {p50:.2f} ms")
    print(f"  Latency p95  : {p95:.2f} ms")
    print(f"  Latency p99  : {p99:.2f} ms")
    print(f"  Latency mean : {mean:.2f} ms")
    print()

    # Pass/fail
    ok = p95 < 10
    print(f"  SLA (p95 < 10ms): {'✓ PASS' if ok else '✗ FAIL'}")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    main()
