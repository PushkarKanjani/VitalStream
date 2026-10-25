# Member 3 Guide: Apache Flink Alert Detection & Escalation Engine

> **Assigned Role:** Member 3  
> **Component Ownership:** Apache Flink Stream Processing, Stateful Alert Detection (`flink/jobs/alert_detection.py`), and 10-Minute Escalation Timers (`flink/jobs/escalation_timer.py`).  
> **Estimated Completion Time:** 45 - 60 minutes.

---

## 1. Master Prompt for Member 3's Antigravity (AG)

Copy and paste the exact block below into your Antigravity chat window:

```markdown
ROLE & TASK
You are a Senior Distributed Stream Processing Engineer specializing in Apache Flink and PyFlink.
You are working on the VitalStream project repository.
Your goal is to inspect, refine, test, and verify Member 3's assigned stream processing jobs:
1. `flink/jobs/alert_detection.py` (Real-time vital threshold anomaly detection with 5-minute stateful deduplication)
2. `flink/jobs/escalation_timer.py` (KeyedProcessFunction with processing-time timers for unacknowledged alert escalation)

PROJECT CONSTRAINTS
- Do NOT touch or overwrite `backend/app/*` (FastAPI REST & WebSockets), `frontend/*`, or MongoDB collections directly except through the escalation sink.
- Flink JobManager runs in Docker at `jobmanager:6123` (web dashboard at `http://localhost:8081`).
- Input stream: `vitals.raw` Kafka topic.
- Output stream: `alerts.raised` and `alerts.acknowledged` Kafka topics.

EXECUTION STEPS
1. Inspect `flink/jobs/alert_detection.py`:
   - Verify threshold evaluations: `BP_LOW` (<90), `BP_HIGH` (>160), `HR_LOW` (<45), `HR_HIGH` (>120), `O2_FALLING` (<90), `TEMP_HIGH` (>38.5).
   - Check the stateful deduplication logic to ensure the same alert is not spammed every second for the same patient within 5 minutes.
2. Inspect `flink/jobs/escalation_timer.py`:
   - Verify the union of `alerts.raised` and `alerts.acknowledged` streams.
   - Verify that `on_timer` fires after 10 minutes and writes an escalation record to MongoDB if `acknowledged == False`.
3. Provide a lightweight local test runner script or mock test to demonstrate the Flink logic executing on sample vitals without requiring a full cluster deployment if Docker Flink is in standby.
4. Output a summary of findings, state management details, and prepare me for my code review.
```

---

## 2. Technical Walkthrough & Architectural Decisions

### A. Alert Detection (`alert_detection.py`)
- **API:** PyFlink DataStream API (`StreamExecutionEnvironment`).
- **Partitioning / Keying:** `key_by(lambda x: patient_id)`.
- **State Management:**
  - Maintains state mapping `f"{patient_id}:{alert_type}" -> last_raised_epoch_sec`.
  - **Deduplication Window:** 300 seconds (5 minutes). If a patient's systolic BP drops below 90 mmHg repeatedly over 2 minutes, only **one** alert is raised, preventing alert fatigue for surgical staff.
- **Alert Payload Output:**
  Emitted to Kafka topic `alerts.raised`:
  ```json
  {
    "alert_id": "a1b2c3d4",
    "case_id": "101",
    "or_id": "OR-1",
    "patient_id": "vdb-patient-101",
    "alert_type": "BP_LOW",
    "severity": "critical",
    "reason": "Systolic BP 82 mmHg (< 90 threshold)",
    "acknowledged": false,
    "created_at": "2026-10-25T21:00:00Z"
  }
  ```

### B. Escalation Timer (`escalation_timer.py`)
- **Core Pattern:** `KeyedProcessFunction` with event-driven timer registration.
- **Two-Stream Union:**
  - Stream 1: `alerts.raised` (tagged `_event_type = "raised"`).
  - Stream 2: `alerts.acknowledged` (tagged `_event_type = "acked"`).
- **Execution Flow:**
  1. When an alert arrives, Flink stores `_acked = False` in managed state and registers a timer:
     `ctx.timer_service().register_processing_time_timer(now + 10_minutes)`.
  2. If the user clicks **ACK** on the dashboard, FastAPI emits to `alerts.acknowledged`. The consumer updates `_acked = True`.
  3. When `on_timer` fires:
     - If `_acked == True`: No-op (alert was handled).
     - If `_acked == False`: Alert is escalated! An escalation document is inserted into MongoDB `escalations` collection, and the alert severity is set to `critical`.

---

## 3. Step-by-Step Verification Commands

### Step 1: Check Flink Cluster Health
Open your browser at `http://localhost:8081`.  
You should see:
- Available Task Slots: $\ge 1$
- Running Jobs: 0 (or active jobs if already submitted).

### Step 2: Submit Alert Detection Job to Flink
```bash
docker exec -it vs_jobmanager flink run -py /opt/flink/jobs/alert_detection.py
```
Or run the Python detection job directly with your environment:
```bash
python flink/jobs/alert_detection.py
```

### Step 3: Trigger an Anomaly to Verify Detection
Inject a simulated critical vital packet to Kafka:
```python
from kafka import KafkaProducer
import json, datetime
p = KafkaProducer(bootstrap_servers='localhost:9093', value_serializer=lambda v: json.dumps(v).encode())
p.send('vitals.raw', key=b'OR-1', value={
    "patient_id": "TEST-PATIENT-1",
    "or_id": "OR-1",
    "case_id": "CASE-999",
    "timestamp": datetime.datetime.utcnow().isoformat(),
    "syst_bp": 72.0,   # CRITICAL (< 90)
    "hr": 135.0,       # CRITICAL (> 120)
    "o2_sat": 86.0     # HYPOXIA (< 90)
})
p.flush()
print("Sent critical test packet!")
```

### Step 4: Verify Alert in Kafka & UI
- Inspect Kafka `alerts.raised`:
  ```bash
  docker exec -it vs_kafka kafka-console-consumer --bootstrap-server localhost:9092 --topic alerts.raised --from-beginning --max-messages 1
  ```
- Open `http://localhost:5173` and click the **Alerts** tab: the new critical alert will appear in the light pastel queue.

---

## 4. Code Review & Viva Defense Questions for Member 3

### Q1: Why use Apache Flink instead of evaluating thresholds inside FastAPI?
> **Answer:**  
> FastAPI is a request-response web framework. Processing continuous high-throughput streams (6 ORs $\times$ multiple telemetry channels) in the web tier would cause severe event loop latency and bottleneck the API. Apache Flink is a purpose-built distributed stream processor that handles out-of-order events, event-time watermarking, and millisecond stateful pattern evaluation.

### Q2: What is the purpose of the 5-minute stateful deduplication window?
> **Answer:**  
> During hypotension or bradycardia, monitors emit abnormal values once every second. Without deduplication, 300 identical alerts would be generated in 5 minutes, crashing message queues and causing severe clinical alert fatigue. Flink's per-key state remembers when an alert type was last fired and suppresses duplicates for 300 seconds.

### Q3: How does Flink handle timers for alert escalation?
> **Answer:**  
> In `escalation_timer.py`, we implement a `KeyedProcessFunction`. When an alert is received, we register a timer using `ctx.timer_service().register_processing_time_timer()`. Flink manages these timers internally. When `on_timer()` triggers, if the state does not indicate an acknowledgment, it fires the escalation pipeline.

### Q4: What is the difference between Processing Time and Event Time in Flink?
> **Answer:**  
> **Event Time** uses the timestamp embedded within the data record itself (when the sensor physically sampled the patient).  
> **Processing Time** uses the system wall-clock time of the Flink cluster machine executing the operator. We use Processing Time for the escalation timer because escalation is tied to real human elapsed time (e.g. 10 wall-clock minutes since notification).
