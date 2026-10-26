"""
Unit test for P2: Insert real outlier record into Cassandra patient_outliers table, SELECT it back, assert fields match.
"""
from datetime import datetime, timezone
import pytest
from consumer.consumer_cassandra import connect_cassandra

def test_p2_cassandra_outlier_roundtrip():
    cluster, session = connect_cassandra()
    assert session is not None, "Failed to connect to Cassandra"

    now_utc = datetime.now(timezone.utc)
    ts_utc_ms = int(now_utc.timestamp() * 1000)
    bucket_date = now_utc.date()
    patient_id = "test-patient-p2-verification"
    or_id = "OR-2"
    metric = "syst_bp"
    val = 70.0
    unit = "mmHg"
    rule = "THRESHOLD"
    expected_low = 75.0
    expected_high = 180.0
    z_score = None
    severity = "CRITICAL"

    # 1. Insert SBP=70 outlier record
    session.execute("""
        INSERT INTO patient_outliers
          (patient_id, bucket_date, ts_utc_ms, or_id, metric, value, unit, rule, expected_low, expected_high, z_score, severity)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """, (
        patient_id, bucket_date, ts_utc_ms,
        or_id, metric, val, unit, rule,
        expected_low, expected_high, z_score, severity
    ))

    # 2. SELECT it back
    row = session.execute("""
        SELECT patient_id, bucket_date, ts_utc_ms, or_id, metric, value, unit, rule, expected_low, expected_high, z_score, severity
        FROM patient_outliers
        WHERE patient_id = %s AND bucket_date = %s AND ts_utc_ms = %s
    """, (patient_id, bucket_date, ts_utc_ms)).one()

    assert row is not None, "Failed to SELECT back inserted outlier from Cassandra"
    print(f"\n[P2 Verify] Retrieved row: {row}")

    # 3. Assert all fields match
    assert row.patient_id == patient_id
    assert row.or_id == or_id
    assert row.metric == metric
    assert abs(row.value - 70.0) < 0.01, f"Expected value 70.0, got {row.value}"
    assert row.unit == unit
    assert row.rule == "THRESHOLD"
    assert abs(row.expected_low - 75.0) < 0.01
    assert abs(row.expected_high - 180.0) < 0.01
    assert row.z_score is None
    assert row.severity == "CRITICAL"
    assert row.ts_utc_ms == ts_utc_ms

    cluster.shutdown()
    print("P2 Verification: ALL FIELDS MATCH!")

if __name__ == "__main__":
    test_p2_cassandra_outlier_roundtrip()
