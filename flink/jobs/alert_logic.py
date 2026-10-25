"""
VitalStream — pure-Python alert logic (no PyFlink dependency).

Kept separate from the Flink job so it can be unit-tested without a cluster.
The Flink operator stores `last_raised` (alert_type -> epoch seconds) in
managed MapState keyed by patient_id and delegates the decision to `evaluate`.
"""

import uuid
from datetime import datetime, timezone

DEDUP_WINDOW_SEC = 300  # 5 minutes


def _num(v, key):
    """Return a float for v[key] or None if missing / non-numeric."""
    x = v.get(key)
    if isinstance(x, bool) or x is None:
        return None
    try:
        return float(x)
    except (TypeError, ValueError):
        return None


THRESHOLDS = {
    "BP_LOW":     lambda v: _num(v, "syst_bp") is not None and _num(v, "syst_bp") < 90,
    "BP_HIGH":    lambda v: _num(v, "syst_bp") is not None and _num(v, "syst_bp") > 160,
    "HR_LOW":     lambda v: _num(v, "hr") is not None and _num(v, "hr") < 45,
    "HR_HIGH":    lambda v: _num(v, "hr") is not None and _num(v, "hr") > 120,
    "O2_FALLING": lambda v: _num(v, "o2_sat") is not None and _num(v, "o2_sat") < 90,
    "TEMP_HIGH":  lambda v: _num(v, "temp_c") is not None and _num(v, "temp_c") > 38.5,
}

SEVERITY = {
    "BP_LOW": "critical", "BP_HIGH": "warning",
    "HR_LOW": "warning", "HR_HIGH": "warning",
    "O2_FALLING": "critical", "TEMP_HIGH": "warning",
}


def build_reason(alert_type: str, v: dict) -> str:
    reasons = {
        "BP_LOW":     f"Systolic BP {v.get('syst_bp')} mmHg (< 90 threshold)",
        "BP_HIGH":    f"Systolic BP {v.get('syst_bp')} mmHg (> 160 threshold)",
        "HR_LOW":     f"Heart rate {v.get('hr')} bpm (< 45 threshold)",
        "HR_HIGH":    f"Heart rate {v.get('hr')} bpm (> 120 threshold)",
        "O2_FALLING": f"SpO2 {v.get('o2_sat')}% (< 90 threshold — hypoxia risk)",
        "TEMP_HIGH":  f"Temperature {v.get('temp_c')}°C (> 38.5 threshold)",
    }
    return reasons.get(alert_type, "Threshold breached")


def evaluate(vital: dict, last_raised: dict, now_epoch: float):
    """
    Check one vitals packet against all thresholds.

    last_raised: alert_type -> epoch seconds of the last alert (mutated in place).
    Returns a list of alert dicts to emit (already deduplicated).
    """
    alerts = []
    patient_id = vital.get("patient_id", "unknown")
    for alert_type, breached in THRESHOLDS.items():
        if not breached(vital):
            continue
        last = last_raised.get(alert_type)
        if last is not None and now_epoch - last < DEDUP_WINDOW_SEC:
            continue  # duplicate within 5-minute window
        last_raised[alert_type] = now_epoch
        alerts.append({
            "alert_id": uuid.uuid4().hex[:8],
            "case_id": vital.get("case_id", "unknown"),
            "or_id": vital.get("or_id", "OR-?"),
            "patient_id": patient_id,
            "alert_type": alert_type,
            "severity": SEVERITY[alert_type],
            "reason": build_reason(alert_type, vital),
            "acknowledged": False,
            "created_at": datetime.fromtimestamp(now_epoch, timezone.utc).isoformat(),
        })
    return alerts
