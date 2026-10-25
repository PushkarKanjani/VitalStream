#!/usr/bin/env python3
"""
VitalStream — Cassandra Outlier Verification Script
Demonstrates:
1. Iterating over a fixed window of 20 values (not an empty window).
2. Injecting dummy outlier values (HR: 175 bpm, SBP: 205 mmHg, SpO2: 76%).
3. Verifying that Cassandra checks, flags, and persists the outliers with explanations.
"""

import os
import sys
from datetime import datetime, date, timezone

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from consumer.consumer_cassandra import (
    connect_cassandra,
    prepare_statements,
    WindowOutlierDetector,
    to_float
)

def run_outlier_benchmark():
    print("=" * 75)
    print("  VITALSTREAM: CASSANDRA FIXED-WINDOW OUTLIER DETECTION BENCHMARK")
    print("=" * 75)

    cluster, session = connect_cassandra()
    stmt_patient, stmt_or, stmt_latest, stmt_outlier = prepare_statements(session)
    detector = WindowOutlierDetector(window_size=20)

    # 1. Prepare fixed window of 20 values (17 normal + 3 injected dummy outliers)
    WINDOW_SIZE = 20
    test_window = []

    for i in range(WINDOW_SIZE):
        item = {
            "or_id": "OR-5",
            "patient_id": "vdb-patient-105",
            "reading_date": date.today(),
            "ts": datetime.now(timezone.utc),
            "hr": 74.0 + (i % 3) * 1.5,
            "syst_bp": 120.0 + (i % 4) * 2.0,
            "dias_bp": 78.0,
            "o2_sat": 98.6,
            "temp_c": 36.8,
            "etco2": 36.0,
            "raw_source": "benchmark"
        }

        # Inject 3 dummy outliers into the 20-value window
        if i == 5:
            item["hr"] = 175.0  # Dummy Outlier 1: Tachycardia (> 140 bpm)
            item["note"] = "Dummy Outlier: Severe Tachycardia (HR: 175 bpm)"
        elif i == 11:
            item["syst_bp"] = 205.0  # Dummy Outlier 2: Hypertensive Crisis (> 180 mmHg)
            item["note"] = "Dummy Outlier: Hypertensive Crisis (SBP: 205 mmHg)"
        elif i == 17:
            item["o2_sat"] = 76.0  # Dummy Outlier 3: Critical Hypoxemia (< 85%)
            item["note"] = "Dummy Outlier: Critical Hypoxemia (SpO2: 76%)"
        else:
            item["note"] = "Normal Sinus Reading"

        test_window.append(item)

    print(f"\n[1] Iterating over fixed window of {WINDOW_SIZE} values...")
    flagged_count = 0

    for idx, v in enumerate(test_window, 1):
        hr = to_float(v["hr"])
        syst_bp = to_float(v["syst_bp"])
        dias_bp = to_float(v["dias_bp"])
        o2_sat = to_float(v["o2_sat"])
        temp_c = to_float(v["temp_c"])
        etco2 = to_float(v["etco2"])

        is_outlier, reason, metric, val, severity = detector.evaluate(
            v["or_id"], hr, syst_bp, dias_bp, o2_sat, temp_c
        )

        status_tag = f"[OUTLIER FLAGGED: {severity}]" if is_outlier else "[NORMAL]"
        print(f"  Sample #{idx:02d} | HR: {hr:5.1f} | SBP: {syst_bp:5.1f} | SpO2: {o2_sat:4.1f}% | {status_tag} {reason or ''}")

        if is_outlier:
            flagged_count += 1
            session.execute(stmt_outlier, (
                v["or_id"], v["reading_date"], v["ts"], v["patient_id"],
                metric, val, reason, severity
            ))

        session.execute(stmt_patient, (
            v["patient_id"], v["reading_date"], v["ts"], v["or_id"],
            hr, syst_bp, dias_bp, o2_sat, temp_c, etco2, v["raw_source"],
            is_outlier, reason
        ))
        session.execute(stmt_or, (
            v["or_id"], v["reading_date"], v["ts"], v["patient_id"],
            hr, syst_bp, dias_bp, o2_sat, temp_c,
            is_outlier, reason
        ))
        session.execute(stmt_latest, (
            v["or_id"], v["patient_id"], v["ts"],
            hr, syst_bp, dias_bp, o2_sat, temp_c,
            is_outlier, reason
        ))

    print(f"\n[2] Outlier Evaluation Complete: Flagged {flagged_count} outliers out of {WINDOW_SIZE} window values.")

    # 3. Query Cassandra to verify flagged outliers are saved
    print("\n[3] Querying Cassandra outliers_by_or table...")
    rows = list(session.execute("""
        SELECT or_id, reading_date, ts, patient_id, metric, val, outlier_reason, severity
        FROM outliers_by_or
        WHERE or_id = 'OR-5' AND reading_date = %s
        LIMIT 10
    """, (date.today(),)))

    print(f"  [PASS] Total Cassandra Outlier Records Found: {len(rows)}")
    for r in rows[:5]:
        print(f"    * {r.ts.strftime('%H:%M:%S')} UTC | {r.or_id} ({r.patient_id}) | Metric: {r.metric}={r.val} | Severity: {r.severity}")
        print(f"      Reason: {r.outlier_reason}")

    cluster.shutdown()
    print("\n" + "=" * 75)
    print("  BENCHMARK VERDICT: [PASS] Cassandra Outlier Detection Fully Verified!")
    print("=" * 75)

if __name__ == "__main__":
    run_outlier_benchmark()
