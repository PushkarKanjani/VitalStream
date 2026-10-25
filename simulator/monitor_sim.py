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
import math
import os
import random
import threading
import time
from datetime import datetime, timezone

import pandas as pd
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
        api_version=(2, 5, 0),
        value_serializer=lambda v: json.dumps(v).encode("utf-8"),
        key_serializer=lambda k: k.encode("utf-8") if k else None,
        acks=1,
        linger_ms=10,
        batch_size=32768,
    )


def generate_synthetic_data(duration_seconds: int = 120) -> list[dict]:
    """Fallback generator providing realistic surgical telemetry if VitalDB API is unreachable."""
    data = []
    base_hr = random.uniform(65, 85)
    base_sbp = random.uniform(110, 130)
    base_dbp = random.uniform(70, 85)
    base_spo2 = random.uniform(97, 100)
    base_temp = random.uniform(36.2, 37.1)
    base_etco2 = random.uniform(34, 38)

    for _ in range(duration_seconds):
        data.append({
            "Solar8000/HR": round(base_hr + random.gauss(0, 2), 1),
            "Solar8000/NIBP_SBP": round(base_sbp + random.gauss(0, 3), 1),
            "Solar8000/NIBP_DBP": round(base_dbp + random.gauss(0, 2), 1),
            "Solar8000/SPO2": min(100.0, round(base_spo2 + random.gauss(0, 0.4), 1)),
            "Solar8000/TEMP1": round(base_temp + random.gauss(0, 0.05), 2),
            "Primus/CO2_INSP": round(base_etco2 + random.gauss(0, 0.5), 1),
        })
    return data


def stream_case(producer: KafkaProducer, case_id: int, or_id: str, speed: float, patient_id: str):
    """Download and stream one VitalDB case into Kafka."""
    logger.info(f"[{or_id}] Loading VitalDB case {case_id} for patient {patient_id}…")
    rows = []
    try:
        case = vitaldb.VitalFile(case_id, TRACKS)
        try:
            df = case.to_pandas(TRACKS, 1)
        except TypeError:
            df = case.to_pandas(1)
        
        if df is not None and not df.empty:
            rows = df.to_dict(orient="records")
    except Exception as e:
        logger.warning(f"[{or_id}] VitalDB API download failed for case {case_id}: {e} — using synthetic surgical vitals")

    if not rows:
        rows = generate_synthetic_data(duration_seconds=120)

    logger.info(f"[{or_id}] Case {case_id} loaded ({len(rows)} rows). Streaming at {speed}× speed…")

    interval = 1.0 / max(0.01, speed)   # seconds to sleep between rows
    rows_sent = 0

    # Explicit partition routing: OR-1 -> partition 0, ..., OR-6 -> partition 5
    partition_idx = None
    try:
        if or_id.startswith("OR-"):
            p_num = int(or_id.split("-")[1]) - 1
            if 0 <= p_num < 6:
                partition_idx = p_num
    except Exception:
        partition_idx = None

    for row in rows:
        record = {
            "patient_id": patient_id,
            "or_id":      or_id,
            "case_id":    str(case_id),
            "timestamp":  datetime.now(timezone.utc).isoformat(),
            "source":     "vitaldb",
        }
        for track, field in VITAL_MAP.items():
            val = row.get(track)
            if pd.notna(val):
                try:
                    fval = float(val)
                    if not (math.isnan(fval) or math.isinf(fval)):
                        record[field] = round(fval, 2)
                except (ValueError, TypeError):
                    pass

        # Skip rows with no vital data
        if not any(f in record for f in VITAL_MAP.values()):
            continue

        producer.send(TOPIC_VITALS, key=or_id, value=record, partition=partition_idx)
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
    try:
        if hasattr(vitaldb, "caseids"):
            all_cases = vitaldb.caseids[:args.cases]
        elif hasattr(vitaldb, "find_cases"):
            all_cases = vitaldb.find_cases(TRACKS)[:args.cases]
        else:
            all_cases = list(range(1, args.cases + 1))
    except Exception as e:
        logger.warning(f"Could not load caseids from vitaldb: {e}, falling back to sequential case numbers")
        all_cases = list(range(1, args.cases + 1))

    if not all_cases:
        all_cases = list(range(1, args.cases + 1))

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
