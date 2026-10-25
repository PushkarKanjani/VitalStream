"""Local tests for the Flink alert logic — run: python flink/tests/test_alert_logic.py"""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "jobs"))
from alert_logic import evaluate, DEDUP_WINDOW_SEC  # noqa: E402


class AlertLogicTests(unittest.TestCase):
    def test_critical_packet_raises_three_alerts(self):
        v = {"patient_id": "P1", "or_id": "OR-1", "case_id": "C1",
             "syst_bp": 72.0, "hr": 135.0, "o2_sat": 86.0}
        types = {a["alert_type"] for a in evaluate(v, {}, 1000.0)}
        self.assertEqual(types, {"BP_LOW", "HR_HIGH", "O2_FALLING"})

    def test_normal_packet_raises_nothing(self):
        v = {"patient_id": "P1", "syst_bp": 120, "hr": 80, "o2_sat": 98, "temp_c": 36.8}
        self.assertEqual(evaluate(v, {}, 1000.0), [])

    def test_boundaries_are_exclusive(self):
        v = {"patient_id": "P1", "syst_bp": 90, "hr": 120, "o2_sat": 90}
        self.assertEqual(evaluate(v, {}, 1000.0), [])

    def test_dedup_within_5_minutes(self):
        v = {"patient_id": "P1", "hr": 130}
        state = {}
        self.assertEqual(len(evaluate(v, state, 1000.0)), 1)
        self.assertEqual(len(evaluate(v, state, 1000.0 + 299)), 0)
        self.assertEqual(len(evaluate(v, state, 1000.0 + DEDUP_WINDOW_SEC)), 1)

    def test_missing_or_bad_values_ignored(self):
        v = {"patient_id": "P1", "hr": None, "syst_bp": "abc"}
        self.assertEqual(evaluate(v, {}, 1000.0), [])

    def test_alert_payload_shape(self):
        a = evaluate({"patient_id": "P1", "or_id": "OR-2", "case_id": "C9", "hr": 130}, {}, 1000.0)[0]
        for k in ("alert_id", "case_id", "or_id", "patient_id", "alert_type",
                  "severity", "reason", "acknowledged", "created_at"):
            self.assertIn(k, a)
        self.assertFalse(a["acknowledged"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
