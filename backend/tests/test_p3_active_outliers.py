"""
Unit test for P3: Active outliers window (60s).
Verifies:
Force SBP 70 for 20 s then 118. Count goes 0 -> 1 -> 0 within the window.
"""
from app.outlier_rules import (
    register_reading,
    get_active_outlier_count,
    get_active_outliers,
    clear_active_outliers,
    ACTIVE_OUTLIER_WINDOW_SECONDS,
)

def test_p3_active_outliers_transition():
    clear_active_outliers()
    patient_id = "patient-p3-test"
    or_id = "OR-2"
    metric = "syst_bp"

    # 1. Initial State: Normal SBP 118.0 -> Count must be 0
    t0 = 1000.0
    register_reading(patient_id, or_id, metric, 118.0, current_ts_s=t0)
    count_0 = get_active_outlier_count(current_ts_s=t0)
    print(f"\n[P3 Step 1] Initial normal reading SBP 118.0 at t={t0}: active count = {count_0}")
    assert count_0 == 0, f"Expected 0 active outliers, got {count_0}"

    # 2. Force SBP 70.0 for 20 s (t=1001 to t=1021) -> Count goes to 1
    t_outlier_start = 1001.0
    register_reading(patient_id, or_id, metric, 70.0, current_ts_s=t_outlier_start)
    count_1 = get_active_outlier_count(current_ts_s=t_outlier_start)
    print(f"[P3 Step 2] Injected SBP 70.0 at t={t_outlier_start}: active count = {count_1}")
    assert count_1 == 1, f"Expected 1 active outlier, got {count_1}"

    # Advance 20 seconds still forcing SBP 70.0 (last violation at t=1021)
    t_outlier_end = 1021.0
    register_reading(patient_id, or_id, metric, 70.0, current_ts_s=t_outlier_end)
    count_1b = get_active_outlier_count(current_ts_s=t_outlier_end)
    assert count_1b == 1

    # 3. Restore to SBP 118.0 at t=1022.0 (1 s after violation ended)
    t_restored = 1022.0
    register_reading(patient_id, or_id, metric, 118.0, current_ts_s=t_restored)
    # Still within 60s active window (only 1s elapsed since last violation)
    count_still_active = get_active_outlier_count(current_ts_s=t_restored)
    print(f"[P3 Step 3] Restored to SBP 118.0 at t={t_restored} (1s post-violation): active count = {count_still_active}")
    assert count_still_active == 1, "Outlier should remain active within 60s window"

    # 4. Advance time past the 60s D1 window: t = 1021.0 + 65.0 = 1086.0
    t_expired = 1086.0
    register_reading(patient_id, or_id, metric, 118.0, current_ts_s=t_expired)
    count_final = get_active_outlier_count(current_ts_s=t_expired)
    print(f"[P3 Step 4] Normal reading at t={t_expired} (65s post-violation > 60s window): active count = {count_final}")
    assert count_final == 0, f"Expected active outlier count to be 0 after window expiry, got {count_final}"

    print("P3 Verification: Count successfully transitioned 0 -> 1 -> 0 within the window!")

if __name__ == "__main__":
    test_p3_active_outliers_transition()
    print("PASS")
