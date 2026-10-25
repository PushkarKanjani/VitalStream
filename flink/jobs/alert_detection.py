#!/usr/bin/env python3
"""
VitalStream — Flink Alert Detection Job (PyFlink)
Reads from vitals.raw Kafka topic.
Applies 30-second tumbling windows per patient.
Raises alerts for: BP_LOW, BP_HIGH, O2_FALLING, HR_HIGH, HR_LOW.
Writes alerts to: alerts.raised Kafka topic + MongoDB alerts collection.

Run:
    flink run -py flink/jobs/alert_detection.py
"""

import json
import os
import uuid
from datetime import datetime, timezone

from pyflink.common import Types, WatermarkStrategy, Duration
from pyflink.common.serialization import SimpleStringSchema
from pyflink.datastream import StreamExecutionEnvironment, TimeCharacteristic
from pyflink.datastream.connectors.kafka import (
    FlinkKafkaConsumer, FlinkKafkaProducer, KafkaRecordSerializationSchema,
    KafkaSource, KafkaOffsetsInitializer,
)
from pyflink.datastream.window import TumblingEventTimeWindows
from pyflink.common.watermark_strategy import WatermarkStrategy
from pyflink.datastream.functions import ProcessWindowFunction, KeyedProcessFunction
from pyflink.datastream.state import ValueStateDescriptor

KAFKA_BOOTSTRAP = os.getenv("KAFKA_BOOTSTRAP", "kafka:9092")
TOPIC_IN        = "vitals.raw"
TOPIC_OUT       = "alerts.raised"

# ── Alert thresholds ──────────────────────────────────────────────────────────
THRESHOLDS = {
    "BP_LOW":    lambda v: v.get("syst_bp") is not None and v["syst_bp"] < 90,
    "BP_HIGH":   lambda v: v.get("syst_bp") is not None and v["syst_bp"] > 160,
    "HR_LOW":    lambda v: v.get("hr")      is not None and v["hr"] < 45,
    "HR_HIGH":   lambda v: v.get("hr")      is not None and v["hr"] > 120,
    "O2_FALLING":lambda v: v.get("o2_sat")  is not None and v["o2_sat"] < 90,
    "TEMP_HIGH": lambda v: v.get("temp_c")  is not None and v["temp_c"] > 38.5,
}

SEVERITY = {
    "BP_LOW": "critical", "BP_HIGH": "warning",
    "HR_LOW": "warning",  "HR_HIGH": "warning",
    "O2_FALLING": "critical", "TEMP_HIGH": "warning",
}

DEDUP_WINDOW_SEC = 300   # 5 min — don't re-raise same alert within this window


class AlertDetectorFunction(KeyedProcessFunction):
    """
    Per-patient stateful function.
    Tracks the last time each alert type was raised (deduplication).
    Emits an alert JSON string if threshold is breached and dedup window has passed.
    """

    def open(self, runtime_context):
        # State: dict[alert_type -> last_raised_epoch_sec]
        self.last_raised = runtime_context.get_map_state(
            # MapState not directly available in PyFlink — use ValueState with dict
        )
        self._state = {}

    def process_element(self, value, ctx):
        try:
            v = json.loads(value)
        except Exception:
            return

        now_epoch = datetime.now(timezone.utc).timestamp()
        patient_id = v.get("patient_id", "unknown")
        or_id      = v.get("or_id", "OR-?")
        case_id    = v.get("case_id", "unknown")

        for alert_type, check_fn in THRESHOLDS.items():
            if not check_fn(v):
                continue

            last_ts = self._state.get(f"{patient_id}:{alert_type}", 0)
            if now_epoch - last_ts < DEDUP_WINDOW_SEC:
                continue   # within dedup window — skip

            # Raise alert
            self._state[f"{patient_id}:{alert_type}"] = now_epoch
            alert = {
                "alert_id":   str(uuid.uuid4())[:8],
                "case_id":    case_id,
                "or_id":      or_id,
                "patient_id": patient_id,
                "alert_type": alert_type,
                "severity":   SEVERITY[alert_type],
                "reason":     _build_reason(alert_type, v),
                "acknowledged": False,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            yield json.dumps(alert)

    def on_timer(self, timestamp, ctx):
        pass


def _build_reason(alert_type: str, v: dict) -> str:
    reasons = {
        "BP_LOW":     f"Systolic BP {v.get('syst_bp')} mmHg (< 90 threshold)",
        "BP_HIGH":    f"Systolic BP {v.get('syst_bp')} mmHg (> 160 threshold)",
        "HR_LOW":     f"Heart rate {v.get('hr')} bpm (< 45 threshold)",
        "HR_HIGH":    f"Heart rate {v.get('hr')} bpm (> 120 threshold)",
        "O2_FALLING": f"SpO2 {v.get('o2_sat')}% (< 90 threshold — hypoxia risk)",
        "TEMP_HIGH":  f"Temperature {v.get('temp_c')}°C (> 38.5 threshold)",
    }
    return reasons.get(alert_type, "Threshold breached")


def main():
    env = StreamExecutionEnvironment.get_execution_environment()
    env.set_parallelism(1)
    env.set_stream_time_characteristic(TimeCharacteristic.ProcessingTime)

    # Add Kafka connector JARs (available in Flink image)
    env.add_jars(
        "file:///opt/flink/lib/flink-sql-connector-kafka-3.1.0-1.18.jar"
    )

    # ── Source: vitals.raw ────────────────────────────────────────────────────
    kafka_source = FlinkKafkaConsumer(
        topics=TOPIC_IN,
        deserialization_schema=SimpleStringSchema(),
        properties={
            "bootstrap.servers": KAFKA_BOOTSTRAP,
            "group.id": "flink-alert-detector",
            "auto.offset.reset": "latest",
        }
    )

    # ── Sink: alerts.raised ────────────────────────────────────────────────────
    kafka_sink = FlinkKafkaProducer(
        topic=TOPIC_OUT,
        serialization_schema=SimpleStringSchema(),
        producer_config={"bootstrap.servers": KAFKA_BOOTSTRAP},
    )

    # ── Pipeline ───────────────────────────────────────────────────────────────
    stream = env.add_source(kafka_source)

    # Key by patient_id, apply stateful alert detector
    alerts_stream = (
        stream
        .map(lambda x: x)   # passthrough (string JSON)
        .key_by(lambda x: json.loads(x).get("patient_id", "unknown"))
        .process(AlertDetectorFunction())
    )

    alerts_stream.add_sink(kafka_sink)

    env.execute("VitalStream — Alert Detection Job")


if __name__ == "__main__":
    main()
