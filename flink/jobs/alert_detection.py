#!/usr/bin/env python3
"""
VitalStream — Flink Alert Detection Job (PyFlink)

vitals.raw (Kafka) -> key_by(patient_id) -> stateful threshold detector
  -> MongoDB `alerts` collection (upsert on alert_id)  [drives the dashboard]
  -> alerts.raised Kafka topic                         [feeds escalation job]

Per-patient MapState (alert_type -> last raised epoch sec) provides the
5-minute de-duplication window. Threshold logic lives in alert_logic.py.

Run (inside the Flink container):
    flink run -py /opt/flink/usrlib/alert_detection.py \
              --pyFiles /opt/flink/usrlib/alert_logic.py
"""

import json
import logging
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from pyflink.common import Types
from pyflink.common.serialization import SimpleStringSchema
from pyflink.common.watermark_strategy import WatermarkStrategy
from pyflink.datastream import StreamExecutionEnvironment
from pyflink.datastream.connectors.base import DeliveryGuarantee
from pyflink.datastream.connectors.kafka import (
    KafkaOffsetsInitializer, KafkaRecordSerializationSchema, KafkaSink, KafkaSource,
)
from pyflink.datastream.functions import KeyedProcessFunction, MapFunction
from pyflink.datastream.state import MapStateDescriptor

from alert_logic import evaluate

KAFKA_BOOTSTRAP = os.getenv("KAFKA_BOOTSTRAP", "kafka:9092")
MONGO_URI = os.getenv(
    "MONGO_URI",
    "mongodb://vsadmin:vspass2024@mongodb:27017/vitalstream?authSource=admin",
)
TOPIC_IN = "vitals.raw"
TOPIC_OUT = "alerts.raised"
KAFKA_JAR = os.getenv(
    "KAFKA_CONNECTOR_JAR",
    "file:///opt/flink/lib/flink-sql-connector-kafka-3.1.0-1.18.jar",
)

log = logging.getLogger("alert_detection")


class AlertDetector(KeyedProcessFunction):
    """Keyed by patient_id. MapState holds last-raised time per alert type."""

    def open(self, runtime_context):
        self.last_raised = runtime_context.get_map_state(
            MapStateDescriptor("last_raised", Types.STRING(), Types.DOUBLE())
        )

    def process_element(self, value, ctx):
        try:
            vital = json.loads(value)
            if not isinstance(vital, dict):
                return
        except Exception:
            return  # drop malformed packets

        state = {k: v for k, v in self.last_raised.items()}
        for alert in evaluate(vital, state, time.time()):
            self.last_raised.put(alert["alert_type"], state[alert["alert_type"]])
            yield json.dumps(alert)


class MongoUpsert(MapFunction):
    """Persists each alert to MongoDB (idempotent) and passes it downstream."""

    def open(self, runtime_context):
        self.client = None
        try:
            from pymongo import MongoClient
            self.client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=3000)
            self.coll = self.client["vitalstream"]["alerts"]
        except Exception as e:  # keep the pipeline alive
            print(f"[ALERT] MongoDB unavailable: {e}")

    def map(self, value):
        if self.client is not None:
            try:
                alert = json.loads(value)
                self.coll.update_one(
                    {"alert_id": alert["alert_id"]}, {"$setOnInsert": alert}, upsert=True
                )
            except Exception as e:
                print(f"[ALERT] MongoDB write failed: {e}")
        return value

    def close(self):
        if self.client is not None:
            self.client.close()


def main():
    env = StreamExecutionEnvironment.get_execution_environment()
    env.set_parallelism(1)
    env.add_jars(KAFKA_JAR)

    source = (
        KafkaSource.builder()
        .set_bootstrap_servers(KAFKA_BOOTSTRAP)
        .set_topics(TOPIC_IN)
        .set_group_id("flink-alert-detector")
        .set_starting_offsets(KafkaOffsetsInitializer.latest())
        .set_value_only_deserializer(SimpleStringSchema())
        .build()
    )

    sink = (
        KafkaSink.builder()
        .set_bootstrap_servers(KAFKA_BOOTSTRAP)
        .set_record_serializer(
            KafkaRecordSerializationSchema.builder()
            .set_topic(TOPIC_OUT)
            .set_value_serialization_schema(SimpleStringSchema())
            .build()
        )
        .set_delivery_guarantee(DeliveryGuarantee.AT_LEAST_ONCE)
        .build()
    )

    (
        env.from_source(source, WatermarkStrategy.no_watermarks(), "vitals.raw")
        .key_by(lambda x: _patient_key(x), key_type=Types.STRING())
        .process(AlertDetector(), output_type=Types.STRING())
        .map(MongoUpsert(), output_type=Types.STRING())
        .sink_to(sink)
    )

    env.execute("VitalStream — Alert Detection Job")


def _patient_key(raw: str) -> str:
    try:
        return str(json.loads(raw).get("patient_id", "unknown"))
    except Exception:
        return "unknown"


if __name__ == "__main__":
    main()
