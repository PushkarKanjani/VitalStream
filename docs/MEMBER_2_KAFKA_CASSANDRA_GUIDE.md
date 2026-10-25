# Member 2 Guide: Kafka Ingestion & Cassandra Consumer Pipeline

> **Assigned Role:** Member 2  
> **Component Ownership:** Kafka Streaming Infrastructure, VitalDB Producer Simulator (`simulator/monitor_sim.py`), and High-Throughput Cassandra Consumer (`backend/consumer/consumer_cassandra.py`).  
> **Estimated Completion Time:** 45 - 60 minutes.

---

## 1. Master Prompt for Member 2's Antigravity (AG)

Copy and paste the exact block below into your Antigravity chat window:

```markdown
ROLE & TASK
You are a Staff Data Streaming Engineer. You are working on the VitalStream project repository.
Your goal is to inspect, refine, test, and verify Member 2's assigned pipeline:
1. The VitalDB Producer Simulator in `simulator/monitor_sim.py`
2. The Kafka-to-Cassandra Batch Consumer in `backend/consumer/consumer_cassandra.py`

PROJECT CONSTRAINTS
- Do NOT touch or overwrite `backend/app/*` (FastAPI REST & WebSockets), `frontend/*`, or MongoDB collections.
- The shared Kafka broker is accessible on `localhost:9093` (external listener for host processes) and `kafka:9092` (internal Docker).
- The raw vitals topic is `vitals.raw` partitioned across 6 ORs.
- Cassandra is running on `localhost:9042`, keyspace `vitalstream`.

EXECUTION STEPS
1. Inspect `simulator/monitor_sim.py`:
   - Verify that data points contain: `patient_id`, `or_id`, `case_id`, `timestamp`, `hr`, `syst_bp`, `dias_bp`, `o2_sat`, `temp_c`, `etco2`.
   - Ensure the Kafka message key is set to `or_id` to guarantee partition affinity.
   - Verify that NaN / missing float values from VitalDB are cleaned/filtered.
2. Inspect `backend/consumer/consumer_cassandra.py`:
   - Verify prepared statements for `vitals_by_patient_day`, `vitals_by_or_day`, and `latest_vitals_by_or`.
   - Check batch execution with `ConsistencyLevel.LOCAL_ONE` and verify batch sizing (50 records).
3. Run a quick 10-second end-to-end integration test:
   - Run the simulator for 1 case.
   - Run the consumer and confirm records are committed to Cassandra without errors.
4. Output a summary of findings, latency/throughput observations, and prepare me for my code review.
```

---

## 2. Technical Walkthrough & Architectural Decisions

### A. Kafka Topic & Partitioning Strategy
- **Topic Name:** `vitals.raw`
- **Partitions:** 6 (one dedicated partition per Operating Room: `OR-1` to `OR-6`).
- **Partition Key:** `or_id` (e.g., `b"OR-1"`).
- **Why Partition by OR?**  
  In clinical monitoring, vitals for a given OR must be strictly ordered in time. Partitioning by `or_id` guarantees that all messages for that room land on the same Kafka partition, preserving chronological ordering without distributed locking.

### B. Cassandra Consumer Write Pipeline
- **Driver:** DataStax Python Driver (`cassandra-driver`).
- **Batching:** `BatchStatement(consistency_level=ConsistencyLevel.LOCAL_ONE)`.
- **Target Tables:**
  1. `vitals_by_patient_day`: Historical querying by patient.
  2. `vitals_by_or_day`: Historical querying by OR.
  3. `latest_vitals_by_or`: Instantaneous snapshot lookup for the live UI.
- **Why `ConsistencyLevel.LOCAL_ONE`?**  
  Vitals are emitted at 1 Hz per room. In high-frequency ingestion, availability and write latency (<5ms) take precedence over strict distributed quorum. If a single node acknowledges, the write is accepted.

---

## 3. Step-by-Step Verification Commands

### Step 1: Ensure Kafka and Cassandra are Running
```bash
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```
Verify `vs_kafka` and `vs_cassandra` are `Up (healthy)`.

### Step 2: Ensure Cassandra Tables Exist
```bash
docker exec -i vs_cassandra cqlsh -f /scripts/init_cassandra.cql
```

### Step 3: Run the Cassandra Consumer (Terminal 1)
```bash
cd backend
python consumer/consumer_cassandra.py
```
You should see:
```text
[CONSUMER] ✓ Cassandra connected (localhost:9042)
[CONSUMER] ✓ Kafka consumer started (localhost:9093) → topic: vitals.raw
```

### Step 4: Run the VitalDB Simulator (Terminal 2)
```bash
python simulator/monitor_sim.py --ors 6 --speed 10 --cases 6
```
You will observe:
```text
[SIM] [OR-1] Case 1 loaded. Streaming at 10x speed…
[CONSUMER] ✓ 500 rows written | 185.4 rows/sec
```

### Step 5: Verify Data in Cassandra
```bash
docker exec -it vs_cassandra cqlsh -e "SELECT count(*) FROM vitalstream.vitals_by_patient_day;"
```

---

## 4. Code Review & Viva Defense Questions for Member 2

### Q1: Why did you partition Kafka by `or_id` instead of `patient_id`?
> **Answer:**  
> A patient is assigned to a specific OR during surgery. If a patient transitions or if an emergency procedure starts, the physical monitoring hardware belongs to the OR. Partitioning by `or_id` guarantees that all incoming telemetry from that physical sensor rig lands on the exact same partition in strictly monotonic temporal order.

### Q2: Why use `BatchStatement` in the Cassandra consumer?
> **Answer:**  
> Inserting rows one-by-one generates individual RPC round trips over TCP for every vital sign reading. `BatchStatement` groups up to 50 insertions into a single network payload, slashing network overhead and maximizing ingestion throughput up to thousands of writes per second.

### Q3: What happens if VitalDB records contain NaN or empty sensor values?
> **Answer:**  
> In `monitor_sim.py`, line 90 explicitly tests `val != val` (IEEE 754 NaN definition) and skips missing channels. Only validated float metrics are serialized into the JSON payload, preventing downstream Cassandra type-cast exceptions.

### Q4: How does the consumer avoid duplicate writes if restarted?
> **Answer:**  
> Cassandra `INSERT` operations on primary keys are idempotent upserts. In `vitals_by_patient_day`, the composite key is `(patient_id, reading_date, ts)`. If an offset is re-read, the row with that identical timestamp is simply overwritten with the same value without creating duplicate entries.
