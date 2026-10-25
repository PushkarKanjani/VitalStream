# VitalStream — Team Handoff & 1-2 Hour Sprint Guide

> **Project:** VitalStream — Perioperative Clinical Command Center  
> **Repository:** [https://github.com/PushkarKanjani/VitalStream](https://github.com/PushkarKanjani/VitalStream)  
> **Code Review Level:** Senior Big Data Architecture & Distributed Systems

---

## 1. System Architecture & Ownership Split

```
 VitalDB API / Simulator (Member 2)
              │
              ▼
   Kafka: vitals.raw [6 partitions keyed by or_id] (Member 2)
         │                               │
         ▼                               ▼
  Kafka Consumer (Member 2)       Apache Flink 1.18 (Member 3)
         │                        ├─ Job 1: alert_detection.py (Stateful 30s)
         ▼                        └─ Job 2: escalation_timer.py (10m Timer)
   Apache Cassandra 4.1                          │
  (Time-Series Data, Member 4)                   ▼
         ▲                         Kafka: alerts.raised
         │                                       │
         └─────────────┬─────────────────────────┘
                       │
                       ▼
       FastAPI + MongoDB 7.0 + WebSocket (Pushkar - Branch 2A)
       ├─ ACID Bed Locking (findOneAndUpdate)
       ├─ Drug-Allergy Safety Validation Engine
       ├─ Real-Time WebSocket Heartbeat & Push
       └─ Minimal Pastel Clinical Dashboard (React 18 + uPlot)
```

### Component Responsibility Matrix

| Member | Branch | Domain Ownership | Key Code Files | Target Sprint Duration |
|---|---|---|---|---|
| **Pushkar Kanjani** (Lead) | `main` | **MongoDB + FastAPI + Dashboard** | `backend/app/*`, `frontend/*`, `scripts/seed_demo_data.py` | **COMPLETED & PUSHED** |
| **Sachi Shah** (Member 2) | `member-2-kafka` | **Kafka Producer / VitalDB Sim + Cassandra Consumer** | `simulator/monitor_sim.py`, `backend/consumer/consumer_cassandra.py` | **45 - 60 mins** |
| **Yug Thakkar** (Member 3) | `member-3-flink` | **PyFlink Alert Detection + Escalation Timer** | `flink/jobs/alert_detection.py`, `flink/jobs/escalation_timer.py` | **45 - 60 mins** |
| **Hemang Shreemali** (Member 4) | `member-4-cassandra` | **Cassandra Schema Optimization + Load Testing SLA** | `scripts/init_cassandra.cql`, `scripts/load_test.py` | **30 - 45 mins** |

---

## 2. Shared Infrastructure Status

All foundational services run via Docker Compose in the repository root:
```bash
docker-compose up -d
```
Verified services & ports:
- **Apache Kafka:** `localhost:9093` (External), `kafka:9092` (Internal Docker network)
- **Zookeeper:** `localhost:2181`
- **Apache Flink JobManager:** `http://localhost:8081` (RPC: `jobmanager:6123`)
- **Apache Flink TaskManager:** `taskmanager:6122`
- **Apache Cassandra 4.1:** `localhost:9042` (Internal/External)
- **MongoDB 7.0:** `mongodb://vsadmin:vspass2024@localhost:27017/vitalstream?authSource=admin`
- **FastAPI Backend:** `http://localhost:8000` (Swagger docs: `/docs`)
- **Frontend Dashboard:** `http://localhost:5173`

---

## 3. How Other Members Should Work with Antigravity (AG)

Each member can complete their assigned module in under **1 to 2 hours** by following this 4-step workflow:

1. **Pull the Latest Code:**
   ```bash
   git pull origin main
   ```
2. **Open the Project in Antigravity IDE.**
3. **Copy the Specific Master Prompt** for their module from the corresponding guide:
   - Member 2: [MEMBER_2_KAFKA_CASSANDRA_GUIDE.md](./MEMBER_2_KAFKA_CASSANDRA_GUIDE.md)
   - Member 3: [MEMBER_3_FLINK_STREAMING_GUIDE.md](./MEMBER_3_FLINK_STREAMING_GUIDE.md)
   - Member 4: [MEMBER_4_CASSANDRA_PERF_GUIDE.md](./MEMBER_4_CASSANDRA_PERF_GUIDE.md)
4. **Feed the Prompt to their AG Instance:**
   - The master prompts instruct their AG to perform pre-flight environment checks, execute local unit/integration tests, optimize performance, verify zero regressions against Pushkar's backend, and generate their viva defense notes.

---

## 4. Ground Rules for Code Reviews

1. **Zero Breaking Changes on Shared Contracts:**
   - Do **not** alter MongoDB collection schemas (`cases`, `beds`, `orders`, `alerts`, `patients`) or existing FastAPI endpoints (`/api/beds/*`, `/api/orders/*`, `/api/alerts/*`).
   - All Kafka topic names and JSON message envelopes must follow the contract:
     ```json
     {
       "patient_id": "string",
       "or_id": "OR-1..6",
       "case_id": "string",
       "timestamp": "ISO-8601 UTC string",
       "source": "vitaldb",
       "hr": 75.0,
       "syst_bp": 120.0,
       "dias_bp": 80.0,
       "o2_sat": 98.5,
       "temp_c": 37.0,
       "etco2": 38.0
     }
     ```
2. **Clean Light Clinical UI Preservation:**
   - The React frontend has been redesigned into an Apple-style minimal, light, calm clinical UI with pastel tones and zero dark neon contrast. Do not revert or overwrite the CSS styling.
3. **Execution Verification Required:**
   - Every member must run their respective verification command before marking their task complete.

---

## 5. Team Sprint Timeline (1 to 2 Hours Total)

| Minute | Phase | Action |
|---|---|---|
| **00 - 15** | Setup & Pull | Pull latest `main`, start Docker containers, seed baseline data (`python scripts/seed_demo_data.py`). |
| **15 - 45** | AG Automated Execution | Feed Member-specific Master Prompt to Antigravity; AG runs diagnostics and refines the code. |
| **45 - 65** | Integration Validation | Run producer (`monitor_sim.py`), consumer (`consumer_cassandra.py`), and load test (`load_test.py`). |
| **65 - 85** | Viva Prep & Code Walkthrough | Review viva Q&A in `docs/CODE_REVIEW_AND_VIVA_DEFENSE.md` and practice the 5-minute live demo. |
| **85 - 90** | Git Push | Commit and push to your team branches. |
