"""
Single source of truth for outlier rules: clinical thresholds, robust z-score, and sensor artifacts.
Used across backend telemetry, Cassandra stream consumer, and frontend clinical UI.
"""
import math
import statistics
from typing import Optional, Dict, Any, List

METRIC_RULES = {
    "syst_bp": {
        "label": "SBP",
        "full_label": "Systolic BP",
        "unit": "mmHg",
        "expected_low": 75.0,
        "expected_high": 180.0,
        "impossible_low": 20.0,
        "impossible_high": 300.0,
    },
    "hr": {
        "label": "HR",
        "full_label": "Heart Rate",
        "unit": "bpm",
        "expected_low": 45.0,
        "expected_high": 140.0,
        "impossible_low": 20.0,
        "impossible_high": 260.0,
    },
    "o2_sat": {
        "label": "SpO2",
        "full_label": "Oxygen Saturation",
        "unit": "%",
        "expected_low": 85.0,
        "expected_high": 100.0,
        "impossible_low": 30.0,
        "impossible_high": 100.0,
    },
    "etco2": {
        "label": "EtCO2",
        "full_label": "End-Tidal CO2",
        "unit": "mmHg",
        "expected_low": 20.0,
        "expected_high": 55.0,
        "impossible_low": 5.0,
        "impossible_high": 100.0,
    },
    "temp_c": {
        "label": "Temp",
        "full_label": "Temperature",
        "unit": "°C",
        "expected_low": 35.0,
        "expected_high": 39.5,
        "impossible_low": 25.0,
        "impossible_high": 45.0,
    }
}


def evaluate_reading(
    metric: str,
    val: float,
    history: Optional[List[float]] = None
) -> Dict[str, Any]:
    """
    Evaluates a single metric reading against:
    1. SENSOR ARTIFACT: physiologically impossible value or flatline (>=5 identical readings)
    2. THRESHOLD: low / high clinical limit breaches
    3. STATISTICAL: robust z-score |val - rolling_median| / (1.4826 * MAD) >= 3.5 over up to 60 readings
    """
    rule_cfg = METRIC_RULES.get(metric)
    if not rule_cfg or val is None:
        return {
            "is_outlier": False,
            "rule": "none",
            "reason": None,
            "label": None,
            "severity": None,
            "z_score": None,
            "expected_low": None,
            "expected_high": None,
            "is_clinical": False,
        }

    expected_low = rule_cfg["expected_low"]
    expected_high = rule_cfg["expected_high"]
    impossible_low = rule_cfg["impossible_low"]
    impossible_high = rule_cfg["impossible_high"]
    unit = rule_cfg["unit"]
    label = rule_cfg["label"]

    clean_history = [float(x) for x in (history or []) if x is not None]

    # 1. Sensor Artifact check: Physiologically impossible value
    if val < impossible_low or val > impossible_high:
        return {
            "is_outlier": True,
            "rule": "ARTIFACT",
            "reason": f"SENSOR CHECK: {label} {val:.1f} {unit} physiologically impossible",
            "label": "SENSOR CHECK",
            "severity": "WARNING",
            "z_score": None,
            "expected_low": expected_low,
            "expected_high": expected_high,
            "is_clinical": False,
        }

    # 1b. Sensor Artifact check: Flatline (>= 5 consecutive identical values)
    if len(clean_history) >= 4:
        recent = clean_history[-4:] + [val]
        if max(recent) - min(recent) == 0.0:
            return {
                "is_outlier": True,
                "rule": "ARTIFACT",
                "reason": f"SENSOR CHECK: {label} flatline detected at {val:.1f} {unit}",
                "label": "SENSOR CHECK",
                "severity": "WARNING",
                "z_score": None,
                "expected_low": expected_low,
                "expected_high": expected_high,
                "is_clinical": False,
            }

    # 2. Clinical Threshold Check
    if val < expected_low:
        return {
            "is_outlier": True,
            "rule": "THRESHOLD",
            "reason": f"{label} {val:.1f} {unit} | below {expected_low} | THRESHOLD",
            "label": f"{label} Low",
            "severity": "CRITICAL",
            "z_score": None,
            "expected_low": expected_low,
            "expected_high": expected_high,
            "is_clinical": True,
        }
    elif val > expected_high:
        return {
            "is_outlier": True,
            "rule": "THRESHOLD",
            "reason": f"{label} {val:.1f} {unit} | above {expected_high} | THRESHOLD",
            "label": f"{label} High",
            "severity": "CRITICAL",
            "z_score": None,
            "expected_low": expected_low,
            "expected_high": expected_high,
            "is_clinical": True,
        }

    # 3. Statistical Check: Robust Z-Score over up to 60 readings
    series = (clean_history + [val])[-60:]
    if len(series) >= 10:
        rolling_median = statistics.median(series)
        deviations = [abs(x - rolling_median) for x in series]
        mad = statistics.median(deviations)
        if mad > 1e-4:
            robust_z = abs(val - rolling_median) / (1.4826 * mad)
            if robust_z >= 3.5:
                return {
                    "is_outlier": True,
                    "rule": "STATISTICAL",
                    "reason": f"{label} {val:.1f} {unit} | z = {robust_z:.1f} | STATISTICAL",
                    "label": f"{label} Statistical",
                    "severity": "WARNING",
                    "z_score": round(robust_z, 2),
                    "expected_low": expected_low,
                    "expected_high": expected_high,
                    "is_clinical": True,
                }

    return {
        "is_outlier": False,
        "rule": "none",
        "reason": None,
        "label": None,
        "severity": None,
        "z_score": None,
        "expected_low": expected_low,
        "expected_high": expected_high,
        "is_clinical": False,
    }


# ── ACTIVE OUTLIERS STORE (P3) ────────────────────────────────────────────────
# Window D1 = 60 seconds.
# An outlier is ACTIVE if:
# - latest reading still violates its rule, OR
# - last violating reading was within 60s.
# After 60s without violation, it moves to history.
ACTIVE_OUTLIER_WINDOW_SECONDS = 60.0

# Key: f"{or_id}:{metric}"
_active_outliers_store: Dict[str, Dict[str, Any]] = {}


def register_reading(
    patient_id: str,
    or_id: str,
    metric: str,
    val: float,
    history: Optional[List[float]] = None,
    current_ts_s: Optional[float] = None,
) -> Dict[str, Any]:
    """
    Evaluates reading and maintains the active outliers state.
    """
    import time
    now_s = current_ts_s if current_ts_s is not None else time.time()
    ts_utc_ms = int(now_s * 1000)

    res = evaluate_reading(metric, val, history)
    key = f"{or_id}:{metric}"
    rule_cfg = METRIC_RULES.get(metric, {"unit": ""})

    if res["is_outlier"]:
        _active_outliers_store[key] = {
            "patient_id": patient_id,
            "or_id": or_id,
            "metric": metric,
            "value": val,
            "unit": rule_cfg["unit"],
            "rule": res["rule"],
            "expected_low": res["expected_low"],
            "expected_high": res["expected_high"],
            "z_score": res["z_score"],
            "severity": res["severity"],
            "reason": res["reason"],
            "label": res["label"],
            "ts_utc_ms": ts_utc_ms,
            "last_violating_ts_s": now_s,
            "is_currently_violating": True,
        }
    else:
        # If was active, check if still within 60s window
        if key in _active_outliers_store:
            last_violating = _active_outliers_store[key]["last_violating_ts_s"]
            if (now_s - last_violating) <= ACTIVE_OUTLIER_WINDOW_SECONDS:
                _active_outliers_store[key]["is_currently_violating"] = False
                _active_outliers_store[key]["current_value"] = val
            else:
                _active_outliers_store.pop(key, None)

    return res


def get_active_outliers(
    window_seconds: float = ACTIVE_OUTLIER_WINDOW_SECONDS,
    current_ts_s: Optional[float] = None,
) -> List[Dict[str, Any]]:
    """
    Returns list of outliers that are currently violating or violated within window_seconds.
    Evicts expired entries to history.
    """
    import time
    now_s = current_ts_s if current_ts_s is not None else time.time()
    active = []
    for key, item in list(_active_outliers_store.items()):
        if item["is_currently_violating"] or (now_s - item["last_violating_ts_s"] <= window_seconds):
            active.append(dict(item))
        else:
            _active_outliers_store.pop(key, None)
    return active


def get_active_outlier_count(
    window_seconds: float = ACTIVE_OUTLIER_WINDOW_SECONDS,
    current_ts_s: Optional[float] = None,
) -> int:
    return len(get_active_outliers(window_seconds, current_ts_s))


def clear_active_outliers() -> None:
    _active_outliers_store.clear()

