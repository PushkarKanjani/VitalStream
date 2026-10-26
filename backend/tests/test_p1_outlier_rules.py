"""
Unit test for P1: Single source of truth for outlier rules.
Tests 3 synthetic series:
1. Normal series -> 'none'
2. One statistical spike -> 'STATISTICAL'
3. Flatline -> 'ARTIFACT'
"""
from app.outlier_rules import evaluate_reading

def test_p1_three_synthetic_series():
    # 1. Normal series: HR hovering around 75 bpm with natural +/- 1-2 variation
    normal_history = [74.0, 76.0, 75.0, 74.0, 75.0, 76.0, 75.0, 74.0, 75.0, 75.0, 74.0, 76.0]
    normal_reading = 75.0
    res_normal = evaluate_reading("hr", normal_reading, normal_history)
    rule_normal = res_normal["rule"]

    # 2. One spike: Stable HR 75.0 with subtle noise, followed by an acute spike to 95.0 bpm
    # Within absolute thresholds (45-140 bpm), but robust z-score |95 - 75| / (1.4826 * 1.0) = 13.49 >= 3.5
    spike_history = [75.0, 74.0, 76.0, 75.0, 74.0, 75.0, 76.0, 75.0, 74.0, 75.0, 74.0, 75.0]
    spike_reading = 95.0
    res_spike = evaluate_reading("hr", spike_reading, spike_history)
    rule_spike = res_spike["rule"]

    # 3. Flatline: 5 consecutive identical readings (sensor disconnection or frozen leads)
    flatline_history = [75.0, 75.0, 75.0, 75.0]
    flatline_reading = 75.0
    res_flatline = evaluate_reading("hr", flatline_reading, flatline_history)
    rule_flatline = res_flatline["rule"]

    results = [rule_normal, rule_spike, rule_flatline]
    print(f"P1 Results: {results}")

    assert results == ["none", "STATISTICAL", "ARTIFACT"], f"Expected ['none', 'STATISTICAL', 'ARTIFACT'] but got {results}"

if __name__ == "__main__":
    test_p1_three_synthetic_series()
    print("PASS")
