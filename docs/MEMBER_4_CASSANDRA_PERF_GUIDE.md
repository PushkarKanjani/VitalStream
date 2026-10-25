# Member 4 Guide: Cassandra Schema, TWCS Compaction & SLA Load Testing

> **Assigned Role:** Member 4  
> **Component Ownership:** Cassandra Time-Series Modeling (`scripts/init_cassandra.cql`), Compaction Tuning (`TimeWindowCompactionStrategy`), and High-Throughput Load Testing & SLA Benchmarking (`scripts/load_test.py`).  
> **Estimated Completion Time:** 30 - 45 minutes.

---

## 1. Master Prompt for Member 4's Antigravity (AG)

Copy and paste the exact block below into your Antigravity chat window:

```markdown
ROLE & TASK
You are a Staff Database Architect and Performance Engineer specializing in Apache Cassandra and NoSQL storage engines.
You are working on the VitalStream project repository.
Your goal is to inspect, refine, test, and verify Member 4's assigned database and benchmarking module:
1. `scripts/init_cassandra.cql` (Schema design, primary keys, clustering order, and TimeWindowCompactionStrategy)
2. `scripts/load_test.py` (Benchmarking harness measuring throughput and p50/p95/p99 write latency against SLA < 10ms)

PROJECT CONSTRAINTS
- Do NOT touch or modify `backend/app/*` (FastAPI REST & WebSockets), `frontend/*`, or MongoDB collections.
- Cassandra runs in Docker on port `9042`, keyspace `vitalstream`.
- Replication factor is 1 for local development (`SimpleStrategy`).
- SLA threshold: p95 write latency MUST be under 10 ms.

EXECUTION STEPS
1. Inspect `scripts/init_cassandra.cql`:
   - Verify table `vitals_by_patient_day` schema:
     `PRIMARY KEY ((patient_id, reading_date), ts) WITH CLUSTERING ORDER BY (ts DESC)`
   - Verify table `vitals_by_or_day` schema:
     `PRIMARY KEY ((or_id, reading_date), ts) WITH CLUSTERING ORDER BY (ts DESC)`
   - Verify table `latest_vitals_by_or` schema:
     `PRIMARY KEY (or_id)`
   - Ensure `TimeWindowCompactionStrategy` (TWCS) is configured with `compaction_window_unit = 'DAYS'` and `compaction_window_size = 1`.
2. Inspect `scripts/load_test.py`:
   - Verify multi-threaded or multi-OR write loop.
   - Verify timing with `time.perf_counter()` and statistical percentile calculations (p50, p95, p99).
3. Execute the load test benchmark:
   - Run `python scripts/load_test.py --duration 30 --ors 6`.
   - Record and output the latency percentiles and confirm SLA pass/fail.
4. Prepare me for my viva defense with detailed explanations of LSM-trees, memtables, commitlogs, and TWCS compaction.
```

---

## 2. Technical Walkthrough & Architectural Decisions

### A. Primary Key Architecture
In Cassandra, query patterns dictate table schemas. We enforce two query access paths:

#### 1. By Patient Day (`vitals_by_patient_day`):
```sql
CREATE TABLE IF NOT EXISTS vitals_by_patient_day (
    patient_id      text,
    reading_date    date,
    ts              timestamp,
    or_id           text,
    hr              float,
    syst_bp         float,
    dias_bp         float,
    o2_sat          float,
    temp_c          float,
    etco2           float,
    raw_source      text,
    PRIMARY KEY ((patient_id, reading_date), ts)
) WITH CLUSTERING ORDER BY (ts DESC)
AND compaction = {
    'class': 'TimeWindowCompactionStrategy',
    'compaction_window_unit': 'DAYS',
    'compaction_window_size': 1
};
```
- **Composite Partition Key:** `(patient_id, reading_date)`.  
  *Why?* Confines all telemetry of one patient for a given day to a single node and single partition. Prevents unbounded partition growth (hot-spotting) for patients hospitalized for weeks.
- **Clustering Column:** `ts DESC`.  
  *Why?* The most recent vital readings are stored first on disk, making "get latest 100 vitals" an instant sequential disk read without reversing index scans.

#### 2. By OR Day (`vitals_by_or_day`):
- **Partition Key:** `(or_id, reading_date)`.
- **Clustering Column:** `ts DESC`.
- Enables surgical staff to view all events that occurred in Operating Room 2 today.

### B. Why TimeWindowCompactionStrategy (TWCS)?
- Default Cassandra compaction (`SizeTieredCompactionStrategy` or STCS) merges SSTables of similar sizes. Over time, old historical data gets mixed with fresh data across SSTables, resulting in high disk I/O and large compaction overhead.
- **TWCS creates discrete SSTables based on time windows** (e.g., 1 day). Once a day ends, no new writes arrive for that date; those SSTables are sealed and never touched by compaction again! This eliminates compaction read amplification.

---

## 3. Step-by-Step Verification Commands

### Step 1: Initialize Cassandra Schema
```bash
docker exec -i vs_cassandra cqlsh -f /scripts/init_cassandra.cql
```

### Step 2: Inspect Compaction Settings via CQLSH
```bash
docker exec -it vs_cassandra cqlsh -e "DESCRIBE TABLE vitalstream.vitals_by_patient_day;"
```
Look for:
```cql
AND compaction = {'class': 'org.apache.cassandra.db.compaction.TimeWindowCompactionStrategy', 'compaction_window_size': '1', 'compaction_window_unit': 'DAYS'}
```

### Step 3: Run the SLA Load Test Script
```bash
python scripts/load_test.py --duration 30 --ors 6
```
Expected output:
```text
============================================================
VitalStream Load Test — 6 ORs, 30s
============================================================

✓ RESULTS
  Total writes : 4280
  Duration     : 30.1s
  Throughput   : 142.2 writes/sec
  Latency p50  : 2.14 ms
  Latency p95  : 4.88 ms
  Latency p99  : 7.21 ms
  Latency mean : 2.45 ms

  SLA (p95 < 10ms): ✓ PASS
============================================================
```

---

## 4. Code Review & Viva Defense Questions for Member 4

### Q1: Why did you partition by `(patient_id, reading_date)` rather than just `patient_id`?
> **Answer:**  
> In Apache Cassandra, a single partition should not exceed 100 MB or 100,000 cells. At 1 Hz sampling frequency, one patient produces 86,400 rows per day across 7 columns ($\approx 600,000$ cells). If we partitioned only by `patient_id`, a patient admitted for a week would create a monstrous, degrading partition that causes JVM garbage collection pauses and read timeouts. Adding `reading_date` bounds each partition cleanly to 24 hours.

### Q2: How does Cassandra achieve such high write throughput (<5ms)?
> **Answer:**  
> Cassandra writes sequentially using an append-only Log-Structured Merge (LSM) architecture:
> 1. Writes are appended immediately to the disk **CommitLog** (sequential I/O for crash recovery).
> 2. Simultaneously, writes are inserted into an in-memory sorted data structure called the **Memtable**.
> 3. Once acknowledged in memory and CommitLog, the write returns immediately. There are zero random disk seeks. When the Memtable fills up, it flushes sequentially to disk as an immutable **SSTable**.

### Q3: Why is `TimeWindowCompactionStrategy` preferred over `SizeTieredCompactionStrategy` for time-series?
> **Answer:**  
> Time-series data arrives ordered by timestamp and is rarely updated or deleted. TWCS groups SSTables strictly by timestamp windows (1 day). Once that day has elapsed, no new data is written to that window, so those SSTables are permanently frozen. STCS, on the other hand, repeatedly rewrites old and new data together, causing massive write amplification.

### Q4: What does the p95 latency metric signify in your SLA test?
> **Answer:**  
> $95\%$ of all write operations completed faster than the p95 value (e.g. 4.88 ms), and only $5\%$ took longer. In real-time clinical telemetry, average latency hides tail spikes; p95 guarantees that 19 out of 20 telemetry updates are written with sub-5ms latency, easily passing our strict clinical SLA of $< 10$ ms.
