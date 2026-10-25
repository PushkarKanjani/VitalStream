#!/usr/bin/env python3
"""
VitalStream — Flink Escalation Timer Job (PyFlink)
Watches alerts.raised topic.
Tracks unacknowledged alerts.
If an alert is not acknowledged within 10 minutes → writes escalation to MongoDB.

Run:
    flink run -py flink/jobs/escalation_timer.py
"""

import json
import os
import logging
from datetime import datetime, timezone, timedelta

from pyflink.common import Types
from pyflink.common.serialization import SimpleStringSchema
from pyflink.datastream import StreamExecutionEnvironment, TimeCharacteristic
from pyflink.datastream.connectors.kafka import FlinkKafkaConsumer
from pyflink.datastream.functions import KeyedProcessFunction
from pyflink.datastream.timerservice import TimerService

KAFKA_BOOTSTRAP  = os.getenv("KAFKA_BOOTSTRAP", "kafka:9092")
TOPIC_ALERTS_IN  = "alerts.raised"
TOPIC_ALERTS_ACK = "alerts.acknowledged"
MONGO_URI        = os.getenv("MONGO_URI", "mongodb://vsadmin:vspass2024@host.docker.internal:27017/vitalstream?authSource=admin")

ESCALATION_DELAY_MS = 10 * 60 * 1000   # 10 minutes in milliseconds
logging.basicConfig(level=logging.INFO)


class EscalationTimerFunction(KeyedProcessFunction):
    """
    Keyed by alert_id.
    On alert.raised  → register a processing-time timer for T+10min.
    On timer fires   → if not yet acknowledged, write escalation to MongoDB.
    On alert.ack     → cancel the timer (via state flag).
    """

    def open(self, runtime_context):
        from pyflink.datastream.state import ValueStateDescriptor
        self._acked = runtime_context.get_state(
            ValueStateDescriptor("acked", Types.BOOLEAN())
        )
        self._alert_doc = runtime_context.get_state(
            ValueStateDescriptor("alert_doc", Types.STRING())
        )

    def process_element(self, value, ctx):
        try:
            msg = json.loads(value)
        except Exception:
            return

        event_type = msg.get("_event_type", "raised")   # producer marks type

        if event_type == "acked":
            self._acked.update(True)
            return

        # It's a new alert — store it and set timer
        self._alert_doc.update(value)
        self._acked.update(False)

        # Register processing-time timer: now + 10 min
        timer_ts = ctx.timer_service().current_processing_time() + ESCALATION_DELAY_MS
        ctx.timer_service().register_processing_time_timer(timer_ts)

    def on_timer(self, timestamp, ctx):
        if self._acked.value():
            return   # already acknowledged — no escalation needed

        raw = self._alert_doc.value()
        if not raw:
            return

        alert = json.loads(raw)
        escalation = {
            "alert_id":     alert["alert_id"],
            "case_id":      alert.get("case_id"),
            "or_id":        alert.get("or_id"),
            "patient_id":   alert.get("patient_id"),
            "alert_type":   alert.get("alert_type"),
            "severity":     "critical",   # always critical after escalation
            "reason":       f"ESCALATED: {alert.get('reason')} — unacknowledged for 10 minutes",
            "escalated_at": datetime.now(timezone.utc).isoformat(),
        }

        # Write to MongoDB directly from Flink task (acceptable for demo)
        try:
            from pymongo import MongoClient
            client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=3000)
            db = client["vitalstream"]
            db.escalations.insert_one(escalation)
            db.alerts.update_one(
                {"alert_id": alert["alert_id"]},
                {"$set": {"escalated": True, "escalated_at": escalation["escalated_at"]}}
            )
            client.close()
            print(f"[ESCALATION] Alert {alert['alert_id']} escalated to charge nurse")
        except Exception as e:
            print(f"[ESCALATION] MongoDB write failed: {e}")


def main():
    env = StreamExecutionEnvironment.get_execution_environment()
    env.set_parallelism(1)
    env.set_stream_time_characteristic(TimeCharacteristic.ProcessingTime)

    env.add_jars(
        "file:///opt/flink/lib/flink-sql-connector-kafka-3.1.0-1.18.jar"
    )

    # Source 1: new alerts
    alerts_source = FlinkKafkaConsumer(
        topics=TOPIC_ALERTS_IN,
        deserialization_schema=SimpleStringSchema(),
        properties={
            "bootstrap.servers": KAFKA_BOOTSTRAP,
            "group.id": "flink-escalation-timer",
            "auto.offset.reset": "latest",
        }
    )

    # Source 2: acknowledgements
    ack_source = FlinkKafkaConsumer(
        topics=TOPIC_ALERTS_ACK,
        deserialization_schema=SimpleStringSchema(),
        properties={
            "bootstrap.servers": KAFKA_BOOTSTRAP,
            "group.id": "flink-escalation-ack",
            "auto.offset.reset": "latest",
        }
    )

    # Tag messages so the function knows which stream they came from
    alerts_tagged = env.add_source(alerts_source).map(
        lambda x: json.dumps({**json.loads(x), "_event_type": "raised"})
    )
    acks_tagged = env.add_source(ack_source).map(
        lambda x: json.dumps({**json.loads(x), "_event_type": "acked"})
    )

    # Union both streams, key by alert_id
    (
        alerts_tagged.union(acks_tagged)
        .key_by(lambda x: json.loads(x).get("alert_id", "unknown"))
        .process(EscalationTimerFunction())
    )

    env.execute("VitalStream — Escalation Timer Job")


if __name__ == "__main__":
    main()
