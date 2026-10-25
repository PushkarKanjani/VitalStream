#!/usr/bin/env python3
"""
VitalStream — VitalDB Simulator (Kafka Producer)
Streams real VitalDB intraoperative recordings into Kafka vitals.raw.

Usage:
    python monitor_sim.py --ors 6 --speed 10
    python monitor_sim.py --ors 6 --speed 1 --cases 10

Args:
    --ors      Number of ORs to simulate simultaneously (default: 6)
    --speed    Playback multiplier (10 = 10× faster than real-time)
    --cases    Number of VitalDB cases to stream (default: 20)
    --loop     Loop continuously when cases are exhausted
"""

import argparse
import json
import logging
import os
import random
import threading
import time
from datetime import datetime, timezone

import vitaldb
from dotenv import load_dotenv
from kafka import KafkaProducer

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s [SIM] %(message)s")
logger = logging.getLogger(__name__)

KAFKA_BOOTSTRAP = os.getenv("KAFKA_BOOTSTRAP", "localhost:9093")
TOPIC_VITALS    = os.getenv("KAFKA_TOPIC_VITALS", "vitals.raw")

# VitalDB parameter names we care about
TRACKS = ["BIS/EEG1_WAV", "SNUADC/ART", "SNUADC/CVP", "Solar8000/HR",
          "Solar8000/NIBP_SBP", "Solar8000/NIBP_DBP", "Solar8000/SPO2",
          "Solar8000/TEMP1", "Primus/CO2_INSP"]

VITAL_MAP = {
    "Solar8000/HR":         "hr",
    "Solar8000/NIBP_SBP":   "syst_bp",
    "Solar8000/NIBP_DBP":   "dias_bp",
    "Solar8000/SPO2":       "o2_sat",
    "Solar8000/TEMP1":      "temp_c",
    "Primus/CO2_INSP":      "etco2",
}

OR_IDS = [f"OR-{i}" for i in range(1, 7)]


def make_producer() -> KafkaProducer:
    return KafkaProducer(
        bootstrap_servers=KAFKA_BOOTSTRAP,
        value_serializer=lambda v: json.dumps(v).encode("utf-8"),
        key_serializer=lambda k: k.encode("utf-8") if k else None,
        acks=1,
        linger_ms=10,
        batch_size=32768,
    )


def stream_case(producer: KafkaProducer, case_id: int, or_id: str, speed: float, patient_id: str):
    """Download and stream one VitalDB case into Kafka."""
    logger.info(f"[{or_id}] Loading VitalDB case {case_id} for patient {patient_id}…")
    try:
        case = vitaldb.VitalFile(case_id, TRACKS)
        data = case.to_pandas(1)   # 1-second resolution
    except Exception as e:
        logger.warning(f"[{or_id}] Could not load case {case_id}: {e} — skipping")
        return

    logger.info(f"[{or_id}] Case {case_id} loaded ({len(data)} rows). Streaming at {speed}× speed…")

    interval = 1.0 / speed   # seconds to sleep between rows
    rows_sent = 0

    for _, row in data.iterrows():
        record = {
            "patient_id": patient_id,
            "or_id":      or_id,
            "case_id":    str(case_id),
            "timestamp":  datetime.now(timezone.utc).isoformat(),
            "source":     "vitaldb",
        }
        for track, field in VITAL_MAP.items():
            val = row.get(track)
            if val is not None and not (isinstance(val, float) and val != val):  # skip NaN
                record[field] = round(float(val), 2)

        # Skip rows with no vital data
        if not any(f in record for f in VITAL_MAP.values()):
            continue

        producer.send(TOPIC_VITALS, key=or_id, value=record)
        rows_sent += 1
        time.sleep(interval)

    logger.info(f"[{or_id}] Case {case_id} complete — {rows_sent} readings sent")


def simulate_or(producer: KafkaProducer, or_id: str, case_ids: list[int], speed: float, loop: bool):
    """Thread worker: streams cases sequentially for one OR."""
    patient_idx = 0
    case_queue = list(case_ids)

    while True:
        if not case_queue:
            if loop:
                case_queue = list(case_ids)
                logger.info(f"[{or_id}] Looping case queue")
            else:
                logger.info(f"[{or_id}] All cases done")
                break

        cid = case_queue.pop(0)
        patient_id = f"vdb-patient-{cid}"
        stream_case(producer, cid, or_id, speed, patient_id)
        time.sleep(2)   # brief pause between cases
        patient_idx += 1


def main():
    parser = argparse.ArgumentParser(description="VitalStream Kafka Producer")
    parser.add_argument("--ors",   type=int, default=6,    help="Number of ORs to run (max 6)")
    parser.add_argument("--speed", type=float, default=10, help="Playback speed multiplier")
    parser.add_argument("--cases", type=int, default=20,   help="VitalDB cases to use")
    parser.add_argument("--loop",  action="store_true",    help="Loop continuously")
    args = parser.parse_args()

    n_ors = min(args.ors, 6)
    producer = make_producer()
    logger.info(f"✓ Kafka producer ready ({KAFKA_BOOTSTRAP})")

    # Fetch available case IDs from VitalDB
    logger.info("Fetching VitalDB case list…")
    all_cases = vitaldb.caseids[:args.cases]
    logger.info(f"Got {len(all_cases)} cases. Distributing across {n_ors} ORs…")

    # Split cases across ORs
    per_or = max(1, len(all_cases) // n_ors)
    threads = []
    for i in range(n_ors):
        or_id = OR_IDS[i]
        slice_start = i * per_or
        slice_end = slice_start + per_or if i < n_ors - 1 else len(all_cases)
        or_cases = all_cases[slice_start:slice_end]
        t = threading.Thread(
            target=simulate_or,
            args=(producer, or_id, or_cases, args.speed, args.loop),
            daemon=True,
            name=f"sim-{or_id}"
        )
        threads.append(t)
        t.start()
        time.sleep(0.5)   # stagger OR starts

    try:
        for t in threads:
            t.join()
    except KeyboardInterrupt:
        logger.info("Simulator stopped by user")
    finally:
        producer.flush()
        producer.close()


if __name__ == "__main__":
    main()
