# VitalStream — Complete Project Master Guide & External LLM Context

> **Note for External LLMs (ChatGPT, Claude, Gemini):**  
> If you are reading this file as an uploaded context, you are acting as an expert **Big Data Analytics (BDA) Professor and Senior Distributed Systems Architect**. You must use the architectural specifications, database schemas, code snippets, and clinical rules documented in this file to tutor the student, answer technical questions, explain design decisions, and conduct mock viva interviews for the **VitalStream** project. Do NOT hallucinate technologies outside this stack.

---

## 1. Project Overview & Elevator Pitch (30-Second Summary)

**What is VitalStream?**  
VitalStream is a real-time, distributed perioperative clinical command center monitoring **6 simultaneous Operating Rooms (OR-1 to OR-6)** at **Apollo Hospitals, Gandhinagar**. It ingests high-frequency physiological telemetry (ECG Heart Rate, Arterial Blood Pressure, Pulse Oximetry SpO₂, Core Temperature, and End-Tidal CO₂) from authentic surgical procedures (using the **VitalDB** open dataset of 6,388 cases).
Each room is staffed by a dedicated Chief Surgeon (e.g. Dr. Aditi Sharma, Dr. Rajesh Kulkarni, Dr. Anjali Mehta, Dr. Rohan Gupta, Dr. Vivek Menon, Dr. Suresh Nambiar) and anesthesiologist.

**What Core Problems Does It Solve?**
1. **Zero-Latency Telemetry Streaming:** Ingests 518,000+ vitals/day with sub-second dashboard delivery.
2. **Alarm Fatigue Prevention:** Unlike naive systems where all screens scream red, 5 out of 6 rooms run within stable normal limits, cleanly isolating acute clinical breaches (e.g. OR-2 hypotension: SBP 70.0 mmHg).
3. **ACID Bed Allocation:** Prevents race conditions and double-bookings when transferring post-op patients into PACU recovery bays (REC-1 to REC-6).
4. **Closed-Loop Pharmacological Safety:** Integrates a 42-row Indian drug catalog (CDSCO/ICMR formulary) with chemical salt decomposition, blocking contraindicated prescriptions (e.g., Augmentin for penicillin-allergic patients) at the database layer.

---

## 2. Polyglot Architecture & Technology Stack

| Layer / Technology | Component Version | Architectural Responsibility | Key Guarantees & Config |
| :--- | :--- | :--- | :--- |
| **Data Source** | VitalDB Telemetry | 6,388 surgical cases (CABG, Laparoscopy, Craniotomy, etc.) | High-frequency intraoperative recordings (1 Hz to 100 Hz). |
| **Stream Ingestion** | **Apache Kafka 3.6** | Telemetry conveyor belt on topic `vitals.raw`. | **6 dedicated partitions** (1 partition per OR); partition key = `or_id` to guarantee strict temporal ordering; `acks=1`. |
| **Stream Processing** | **Apache Flink 1.18** | Real-time sliding window analytics & anomaly detection. | Stateful stream processor; 5-minute sliding alert deduplication window; 10-minute unacknowledged alert escalation timers. |
| **Time-Series Lake** | **Apache Cassandra 4.1** | High-velocity telemetry & outlier persistence. | **TWCS (TimeWindowCompactionStrategy)** with daily SSTables; append-only writes; sub-5ms P95 latency; `LOCAL_ONE` consistency. |
| **Document & ACID Core** | **MongoDB 7.0** | Surgical cases, PACU beds, drug formulary, patient profiles. | WiredTiger document-level locking; **atomic `findOneAndUpdate`** for bed reservation (preventing race conditions). |
| **Backend API & Push** | **FastAPI + Asyncio** | REST endpoints & asynchronous WebSocket broadcast. | Sub-second push over `/ws/vitals`; in-memory 60s active outlier window store. |
| **Frontend UI** | **React 18 + uPlot + Tailwind** | Intensive care command center cockpit. | **uPlot HTML5 Canvas engine** rendering 60 FPS multi-stream vitals with zero browser lag; 4-tab clinical navigation. |

---

## 3. End-to-End Data Pipeline Flow

```
[ VitalDB Surgical Dataset / Simulator (monitor_sim.py) ]
                        │
                        ▼ (Sub-second vital packets: HR, SBP, DBP, SpO2, Temp, EtCO2)
         [ Apache Kafka: vitals.raw (6 Partitions) ]
           ├── Partition 0 -> OR-1 (Coronary Bypass)
           ├── Partition 1 -> OR-2 (Knee Arthroplasty - Hypotension SBP 70.0)
           ├── Partition 2 -> OR-3 (Craniotomy)
           ├── Partition 3 -> OR-4 (Laparoscopy)
           ├── Partition 4 -> OR-5 (Cardiac Valve)
           └── Partition 5 -> OR-6 (Trauma Repair)
                        │
         ┌──────────────┴──────────────┐
         ▼                             ▼
[ Apache Flink Engine ]     [ Cassandra Telemetry Sink ]
  - Sliding Window Check      - Table: latest_vitals_by_or
  - Anomaly Deduplication     - Table: patient_outliers (TWCS)
  - Escalation Timers (<5ms P95 write latency)
         │                             │
         └──────────────┬──────────────┘
                        ▼
           [ FastAPI Async WebSocket Manager ]
                        │  (Broadcasts live telemetry + 60s active outliers)
                        ▼
         [ React 18 Frontend Dashboard ]
   ├── 1. Platform Overview (Architecture & Live Container Health)
   ├── 2. Command Center (OR Wall, Waveforms Grid, Bed Board, Alerts)
   ├── 3. Medication Check (Indian Prescription & Allergy BLOCK)
   └── 4. Activity Logs (Immutable Audit Trail + 24h/7d/30d JSON Export)
```

---

## 4. Deep-Dive: The 4 Big Data Tools & Code Implementations

### Tool 1: Apache Kafka (Streaming Ingestion)
- **Why Kafka?** Decouples high-frequency vital sensors from databases. If Cassandra or MongoDB restarts, Kafka buffers data so zero packets are lost.
- **Why 6 Partitions?** 
  There are 6 operating rooms. By creating 6 partitions in the `vitals.raw` topic and setting the Kafka message key to `or_id` (e.g. `"OR-2"`), Kafka guarantees that all readings for OR-2 are processed in strict chronological order by the same partition consumer.
- **Producer Config:** `acks=1`, `linger.ms=10`, `batch.size=16384`.

### Tool 2: Apache Flink (Stream Processing & Alert Fatigue Reduction)
- **Why Flink over Spark Streaming?**
  Spark Streaming uses micro-batching (typically 500ms–1000ms latency). Flink is a true event-driven stream processor processing event-by-event with sub-10ms latency.
- **Deduplication Logic:** If a patient's SpO₂ drops below 85%, Flink emits an alert immediately. If it remains low over the next 5 minutes, Flink suppresses repeated duplicate alarms (preventing alert fatigue) while starting a 10-minute escalation countdown timer.

### Tool 3: Apache Cassandra (Time-Series Outliers & TWCS Compaction)
- **Why Cassandra?** Append-only NoSQL architecture delivers write throughput exceeding 100,000 writes/second.
- **Why TWCS (Time Window Compaction Strategy)?**
  Sensor telemetry arrives continuously stamped with current time and is never updated in place. TWCS groups data into daily SSTables (e.g. 1 day window). Once that day passes, Cassandra never needs to re-compact or merge old SSTables, eliminating compaction I/O storms and disk thrashing.
- **Outliers Schema (`vitalstream.patient_outliers`):**
  ```sql
  CREATE TABLE vitalstream.patient_outliers (
      patient_id text,
      bucket_date date,
      ts_utc_ms bigint,
      or_id text,
      metric text,
      value double,
      unit text,
      rule text,
      expected_low double,
      expected_high double,
      z_score double,
      severity text,
      PRIMARY KEY ((patient_id, bucket_date), ts_utc_ms, metric)
  ) WITH CLUSTERING ORDER BY (ts_utc_ms DESC, metric ASC)
    AND compaction = {'class': 'TimeWindowCompactionStrategy', 'compaction_window_unit': 'DAYS', 'compaction_window_size': 1};
  ```

### Tool 4: MongoDB (ACID Bed Concurrency & Drug Allergy Guard)
- **Why MongoDB instead of Cassandra for Beds & Orders?**
  Cassandra follows the BASE model (Eventual Consistency) — two parallel writes can overwrite each other. In a hospital, two nurses cannot book the same recovery bed (Double-booking race condition). MongoDB provides strict single-document ACID transactions with WiredTiger document-level locking.
- **Atomic Bed Locking Code (`backend/app/api/beds.py`):**
  ```python
  bed = await db.beds.find_one_and_update(
      {"bed_id": req.bed_id, "status": "available"},
      {"$set": {
          "status": "occupied",
          "case_id": req.case_id,
          "reserved_by": req.reserved_by,
          "updated_at": datetime.utcnow()
      }},
      return_document=ReturnDocument.AFTER
  )
  if not bed:
      raise HTTPException(409, "Bed is already reserved or occupied.")
  ```
- **Pharmacological Allergy Engine (`backend/app/allergy_checker.py`):**
  Does NOT compare raw names. It resolves brand names to salts:
  - `Augmentin 625 Duo` -> Amoxicillin 500mg + Clavulanic Acid 125mg.
  - Amoxicillin belongs to `penicillin` class.
  - If patient Sunita Verma has allergy `["penicillin", "aspirin"]`:
    - `Augmentin 625 Duo` -> **BLOCK** (HTTP 422, submit button disabled).
    - `Combiflam` (Ibuprofen) -> **BLOCK** (NSAID/Aspirin class).
    - `Pan 40` (Pantoprazole) -> **CLEARED** (PPI class, no overlap).
    - `Cefazolin 1g Inj` (Cephalosporin) -> **CAUTION** (Known 5–10% cross-reactivity warning, clinician override required).

---

## 5. UI Ergonomics & Color Semantics

| Color | Hex | Meaning & Clinical Function |
| :--- | :--- | :--- |
| **Danger Red** | `#DC2626` | **Emergency Outlier Breach / Blocked Order:** Isolated exclusively to violating metrics (SBP 70.0 mmHg) and allergy BLOCK banners. |
| **Emerald Green** | `#10B981` | **Normal / Cleared:** `WebSocket Live` connection pulse dot and verified prescription clearances. |
| **Clinical Amber** | `#F59E0B` | **Caution / Review:** Cross-reactivity warnings requiring clinician sign-off. |
| **Clinical Blue** | `#2563EB` | **Focus & Action:** Active navigation tab (`Command Center`), system branding, and primary action buttons. |
| **Neutral White/Slate** | `#FFFFFF` | **Calm Baseline:** Card backgrounds remain white to prevent visual fatigue. |

---

## 6. Top 15 Tough Viva Questions & Model Answers

### Q1: Why didn't you use a single database for the whole project?
> **Answer:** Healthcare data has two opposite requirements. Sensor vitals arrive at 518k readings/day and require high write throughput and scalability (Cassandra BASE model). Conversely, bed reservations and drug orders require strict transactional integrity (MongoDB ACID model). Forcing both into one database causes either high latency during bed transactions or write bottlenecks during sensor bursts.

### Q2: Why Cassandra TWCS instead of STCS (Size-Tiered) or LCS (Leveled)?
> **Answer:** Size-Tiered (STCS) creates write amplification when merging large SSTables, and Leveled (LCS) has high compaction overhead. Telemetry data has a natural time-series lifecycle: once a day ends, yesterday's vitals are never updated. TWCS groups data into 1-day SSTables. Once the day completes, Cassandra freezes the file, eliminating compaction overhead and guaranteeing sub-5ms latency.

### Q3: What happens if two nurses book the same recovery bed at the exact same millisecond?
> **Answer:** We execute an atomic `findOneAndUpdate({"bed_id": id, "status": "available"}, {"$set": {"status": "occupied"}})` in MongoDB. MongoDB's WiredTiger engine locks the document at the thread level. The first request flips the status from `available` to `occupied` and succeeds. The second request immediately fails the filter match (`status` is no longer `available`), returns `None`, and triggers an HTTP 409 Conflict error.

### Q4: How does your system prevent Alarm Fatigue?
> **Answer:** Alarm fatigue occurs when doctors tune out alarms because every monitor is flashing red. VitalStream maintains a clean physiological baseline: 5 out of 6 rooms (OR-1, 3, 4, 5, 6) operate within normal limits with calm blue trendlines. Only OR-2 demonstrates an acute breach (SBP 70.0 mmHg). The red color is isolated to the SBP chip and the big number, immediately directing clinical attention without causing sensory panic.

### Q5: How does the allergy checker handle brand names vs chemical salts?
> **Answer:** A patient is not allergic to "Augmentin" — they are allergic to "Penicillin". VitalStream maintains a 42-row Indian drug catalog. When a doctor selects "Augmentin 625 Duo", the backend parses its composition into Amoxicillin (500mg) and Clavulanic Acid (125mg). It maps Amoxicillin to the `penicillin` class. Cross-referencing against the patient's allergy profile immediately intercepts and blocks the order with HTTP 422 before it can ever be committed to the database.

### Q6: What is the 60-second active outlier window (Decision D1)?
> **Answer:** Physiological crises are not single-millisecond blips. If a patient's BP drops to 70 mmHg, even if the next reading recovers slightly, clinicians need to see that an acute breach just occurred. VitalStream keeps an outlier visible in the active ticker and OR card for 60 seconds after the last violating reading, after which the room automatically returns to normal status.

### Q7: Why use uPlot instead of Chart.js or Recharts?
> **Answer:** Standard SVG or canvas libraries like Chart.js degrade in performance when rendering 6 multi-stream waveforms with hundreds of data points, dropping below 20 FPS and causing browser stutter. uPlot is an ultra-fast HTML5 canvas library (<40KB) that draws 150,000 data points in 25ms, delivering smooth 60 FPS rendering without memory leaks.

### Q8: What is the format of Indian prescriptions in your system?
> **Answer:** It complies with ICMR/CDSCO conventions: Dosage form (`Tab.`, `Inj.`, `Cap.`), dose & unit (`500mg`, `1g`), route (`Oral`, `IV`), Indian frequency pattern (`OD` 1-0-0, `BD` 1-0-1, `TDS` 1-1-1, `STAT`), food timing (`after food` / `before food`), duration in days, computed total quantity, and reference MRP in INR.

### Q9: How do you prevent duplicate order submissions on double-click?
> **Answer:** The frontend disables the submit button while pending and generates a UUID idempotency key (`idemp_...`) sent in the `Idempotency-Key` header. The backend checks if an order with that key already exists in MongoDB; if found, it returns the existing order rather than inserting a duplicate.

### Q10: How does the JSON audit export work?
> **Answer:** The Activity Logs tab offers pre-set export options for Past 24 Hours, Past Week (7 Days), and Last 30 Days. Each download embeds hospital metadata, export timestamp, record count, and a SHA-256 compliance hash for regulatory HIPAA/CDSCO verification.

### Q11: How is the application secured against OWASP Web Vulnerabilities & DoS Attacks?
> **Answer:** VitalStream enforces a multi-layer security perimeter:
> 1. **OWASP Secure Headers:** All API responses inject `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN` (anti-clickjacking), `Strict-Transport-Security` (enforced TLS), and restrictive Content Security Policy (CSP).
> 2. **Sliding-Window Rate Limiting:** A custom token-bucket middleware throttles requests (240 req/min for general reads, 60 req/min for clinical writes like bed bookings and orders) returning HTTP 429 with `Retry-After`.
> 3. **Non-Root Container Execution:** Production Dockerfiles run under unprivileged user `appuser` (UID 10001) to prevent container breakout exploits.
> 4. **Sanitized Error Masking:** Global exception handling catches unhandled exceptions, logs full stack traces securely on the server with a unique `error_id`, and returns a generic sanitized response, preventing database connection strings or internal schema leakage.

### Q12: How does the system ensure HIPAA / CDSCO Audit Trail Integrity?
> **Answer:** Under HIPAA § 164.312(b), medical software must maintain immutable audit trails. VitalStream uses HMAC-SHA256 signature chaining. Every critical event (medication block, bed reservation, alert acknowledgement) is cryptographically signed using a secure master key. If any actor or attacker modifies the audit record in the database, the computed HMAC fails validation.

### Q13: How is the system deployed in a containerized production environment?
> **Answer:** VitalStream utilizes a complete multi-container Docker Compose stack:
> - **Frontend:** Multi-stage build with Node 20 builder and Nginx 1.25 Alpine runner. Nginx handles gzip compression, static caching, and acts as a reverse proxy for `/api/` and WebSocket `/ws`.
> - **Backend:** Multi-stage Python 3.11-slim container running high-performance Uvicorn with `--proxy-headers` behind Nginx.
> - **Storage Tier:** MongoDB 7.0 (ACID state), Apache Cassandra 4.1 (Time-series TWCS), Apache Kafka 3.6 (6-partition telemetry bus), and Apache Flink 1.18 (Stream processing).

### Q14: How does WebSocket communication handle reverse proxying in Nginx?
> **Answer:** Standard HTTP reverse proxies drop persistent connections. In `frontend/nginx.conf`, the `/ws` location block specifies `proxy_http_version 1.1;`, `proxy_set_header Upgrade $http_upgrade;`, and `proxy_set_header Connection "upgrade";` with an extended timeout of 86400s (24 hours), enabling seamless bi-directional streaming of high-frequency surgical vitals.

### Q15: What is the disaster recovery and data retention strategy?
> **Answer:** All Docker containers mount persistent host volumes (`./data/mongodb`, `./data/cassandra`, `./data/kafka`). Kafka retains 24 hours of raw data (`retention.ms=86400000`). Cassandra partitions data into immutable daily TWCS SSTables, allowing point-in-time recovery and zero data loss on restart.

---

## 7. Production Deployment & Security Architecture Reference

### Docker Stack Services
```
[ Client Browser / OR Displays ]
               │
               ▼ (Port 80 / 5173)
┌────────────────────────────────────────┐
│  vs_frontend (Nginx 1.25 Alpine)       │
│  - Serves React 18 Production Bundle   │
│  - Gzip Compression & OWASP Headers    │
│  - Reverse Proxy: /api/ -> :8000       │
│  - Reverse Proxy: /ws   -> :8000       │
└──────────────────┬─────────────────────┘
                   │
                   ▼ (Port 8000)
┌────────────────────────────────────────┐
│  vs_backend (FastAPI + Uvicorn)        │
│  - Non-Root appuser (UID 10001)        │
│  - Rate Limiter (240/60 req/min)       │
│  - HMAC-SHA256 Audit Integrity         │
│  - Health Probe: /health               │
└─────┬──────────────┬─────────────┬─────┘
      │              │             │
      ▼              ▼             ▼
[ vs_mongodb ] [ vs_kafka ] [ vs_cassandra ]
   Port 27017    Port 9092     Port 9042
```

### One-Click Launch Commands:
- **Windows PowerShell:** `powershell -ExecutionPolicy Bypass -File scripts/deploy.ps1`
- **Linux / Cloud:** `bash scripts/deploy.sh`
- **Manual Docker Compose:** `docker compose up --build -d`

