"""
Tests for Cassandra Fixed-Window Outlier Detection.
Verifies:
1. Fixed-window sliding buffer behavior (20 values max, never unbounded).
2. Outlier detection across clinical thresholds and Z-scores.
3. Verification that normal sinus readings are not marked as outliers.
"""

from consumer.consumer_cassandra import WindowOutlierDetector

def test_window_outlier_detector_bounds():
    detector = WindowOutlierDetector(window_size=20)

    # 1. Normal readings should return is_outlier = False
    is_outlier, reason, metric, val, severity = detector.evaluate(
        "OR-1", hr=72.0, syst_bp=120.0, dias_bp=78.0, o2_sat=98.5, temp_c=36.8
    )
    assert not is_outlier
    assert reason is None

    # 2. Extreme Tachycardia Outlier (HR: 165.0 > 140.0)
    is_outlier, reason, metric, val, severity = detector.evaluate(
        "OR-1", hr=165.0, syst_bp=120.0, dias_bp=78.0, o2_sat=98.5, temp_c=36.8
    )
    assert is_outlier
    assert metric == "hr"
    assert val == 165.0
    assert severity == "CRITICAL"
    assert "Heart Rate" in reason

    # 3. Severe Hypertensive Crisis Outlier (SBP: 195.0 > 180.0)
    is_outlier, reason, metric, val, severity = detector.evaluate(
        "OR-2", hr=75.0, syst_bp=195.0, dias_bp=90.0, o2_sat=98.0, temp_c=37.0
    )
    assert is_outlier
    assert metric == "syst_bp"
    assert severity == "CRITICAL"
    assert "Systolic BP" in reason

    # 4. Critical Hypoxemia Outlier (SpO2: 78.0 < 85.0)
    is_outlier, reason, metric, val, severity = detector.evaluate(
        "OR-3", hr=80.0, syst_bp=118.0, dias_bp=75.0, o2_sat=78.0, temp_c=36.7
    )
    assert is_outlier
    assert metric == "o2_sat"
    assert severity == "CRITICAL"
    assert "Oxygen Saturation" in reason


def test_fixed_window_max_size():
    detector = WindowOutlierDetector(window_size=20)
    for i in range(50):
        detector.evaluate("OR-4", hr=70.0 + (i % 5), syst_bp=115.0, dias_bp=75.0, o2_sat=99.0, temp_c=36.8)

    # Window for OR-4 hr must never exceed 20
    assert len(detector.windows[("OR-4", "hr")]) == 20
