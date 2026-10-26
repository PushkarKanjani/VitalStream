#!/usr/bin/env python3
"""
scripts/outlier_check.py — Outlier Acceptance Test (P6)
Acceptance test script that:
1. Clears existing active outlier test records.
2. Injects SBP 70 into OR-2 for 20 seconds.
3. Asserts the card state via API:
   - metric = 'syst_bp' (SBP)
   - value = 70.0
   - count >= 1 for OR-2
   - OR-1 never appeared as an SBP outlier
4. Restores normal SBP (120.0 mmHg) into OR-2.
5. Asserts count = 0 after the 60-second D1 active outlier window has passed.
6. Asserts exit code 0 on complete pass.
"""

import sys
import time
import json
import urllib.request
import urllib.error

# Ensure UTF-8 output on Windows
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

BASE_URL = "http://127.0.0.1:8000"

def http_post(endpoint: str, data: dict = None):
    url = f"{BASE_URL}{endpoint}"
    payload = json.dumps(data or {}).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    with urllib.request.urlopen(req, timeout=5) as resp:
        return json.loads(resp.read().decode("utf-8"))

def http_get(endpoint: str):
    url = f"{BASE_URL}{endpoint}"
    req = urllib.request.Request(url, method="GET")
    with urllib.request.urlopen(req, timeout=5) as resp:
        return json.loads(resp.read().decode("utf-8"))

def main():
    print("=" * 65)
    print("  VitalStream -- P6 Outlier Acceptance Test")
    print("=" * 65)

    # 1. Reset/clear active outliers state
    print("\n[Step 1] Clearing test outlier state...")
    try:
        http_post("/api/metrics/outliers/clear")
        print("  [OK] State cleared successfully")
    except Exception as e:
        print(f"  [WARN] Failed to clear state ({e}), proceeding with test...")

    # Timestamp reference
    t0 = time.time()

    # 2. Inject SBP 70 into OR-2 for 20 seconds (simulated timestamp progression t0 -> t0 + 20)
    print("\n[Step 2] Injecting SBP 70 into OR-2 for 20 seconds...")
    for sec in range(0, 21, 5):
        sim_ts = t0 + sec
        res = http_post("/api/metrics/inject", {
            "or_id": "OR-2",
            "patient_id": "vdb-patient-102",
            "metric": "syst_bp",
            "value": 70.0,
            "current_ts_s": sim_ts
        })
        assert res.get("status") == "ok", f"Injection failed at t0+{sec}s"
    print("  [OK] SBP 70.0 injected into OR-2 across 20s timeline")

    # 3. Assert active outlier state via API at t0 + 20s
    print("\n[Step 3] Asserting active outlier state via API...")
    active_data = http_get(f"/api/metrics/outliers/active?current_ts_s={t0 + 20.0}")
    outliers = active_data.get("active_outliers", [])
    print(f"  Active outliers returned: {len(outliers)}")

    or2_sbp = [o for o in outliers if o["or_id"] == "OR-2" and o["metric"] == "syst_bp"]
    assert len(or2_sbp) == 1, f"Expected exactly 1 SBP outlier on OR-2, found {len(or2_sbp)}"
    
    rec = or2_sbp[0]
    assert rec["metric"] == "syst_bp", f"Expected metric 'syst_bp', got {rec['metric']}"
    assert rec["value"] == 70.0, f"Expected value 70.0, got {rec['value']}"
    assert rec["rule"] == "THRESHOLD", f"Expected rule 'THRESHOLD', got {rec['rule']}"
    assert rec["severity"] == "CRITICAL", f"Expected severity 'CRITICAL', got {rec['severity']}"
    print(f"  [OK] Verified OR-2 card state: metric={rec['metric']} (SBP), value={rec['value']} mmHg, rule={rec['rule']}")

    # Assert OR-1 never appeared as an SBP outlier
    or1_sbp = [o for o in outliers if o["or_id"] == "OR-1" and o["metric"] == "syst_bp"]
    assert len(or1_sbp) == 0, f"OR-1 should never appear as SBP outlier, but found: {or1_sbp}"
    print("  [OK] Confirmed OR-1 never appeared in outlier list")

    # 4. Restore normal SBP (120.0 mmHg) into OR-2 at t0 + 21s
    print("\n[Step 4] Restoring normal SBP (120.0 mmHg) into OR-2...")
    restore_res = http_post("/api/metrics/inject", {
        "or_id": "OR-2",
        "patient_id": "vdb-patient-102",
        "metric": "syst_bp",
        "value": 120.0,
        "current_ts_s": t0 + 21.0
    })
    assert restore_res.get("status") == "ok", "Failed to restore normal SBP"
    print("  [OK] Restored normal SBP (120.0) at t0 + 21s")

    # 4b. Verify that within 60s D1 window (e.g. at t0 + 40s), it is still kept in the 60s active history window
    within_window = http_get(f"/api/metrics/outliers/active?current_ts_s={t0 + 40.0}")
    or2_within = [o for o in within_window.get("active_outliers", []) if o["or_id"] == "OR-2" and o["metric"] == "syst_bp"]
    assert len(or2_within) == 1, "Expected OR-2 SBP outlier to still be visible within 60s window (D1)"
    print("  [OK] Confirmed OR-2 SBP retained within 60s D1 active-outlier window (t0 + 40s)")

    # 5. Assert count = 0 after the 60-second D1 window has passed (e.g. at t0 + 85s, which is 65s after last violation at t0 + 20s)
    print("\n[Step 5] Asserting expiration after 60s D1 window (t0 + 85s)...")
    expired_data = http_get(f"/api/metrics/outliers/active?current_ts_s={t0 + 85.0}")
    or2_expired = [o for o in expired_data.get("active_outliers", []) if o["or_id"] == "OR-2" and o["metric"] == "syst_bp"]
    assert len(or2_expired) == 0, f"Expected 0 SBP outliers on OR-2 after 60s, found: {or2_expired}"
    print("  [OK] Confirmed OR-2 SBP outlier expired cleanly to history after 60s (count=0)")

    print("\n" + "=" * 65)
    print("  ALL ACCEPTANCE CHECKS PASSED: Exit code 0")
    print("=" * 65)
    return 0

if __name__ == "__main__":
    sys.exit(main())
