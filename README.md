# VitalStream 🏥

**Perioperative Clinical Command Center — Real-Time OR Monitoring**

> Live vital signs · Flink alert detection · ACID bed reservation · VitalDB dataset

---

## Tech Stack

| Layer | Tool | Role |
|-------|------|------|
| **Stream** | Apache Kafka 3.6 | 6 OR partitions, 4 topics |
| **Processing** | Apache Flink 1.18 | Alert detection, escalation |
| **Time-series** | Apache Cassandra 4.1 | 518k vitals/day |
| **Documents** | MongoDB 7.0 | Cases, beds, orders, alerts |
| **API** | FastAPI + WebSocket | REST + live push |
| **Frontend** | React 18 + Vite + uPlot | 6-bed OR grid |
| **Data** | VitalDB (6,388 real cases) | Real intraoperative recordings |

---

## Architecture

```
VitalDB API
    │
    ▼
[Simulator] ──► Kafka (vitals.raw × 6 partitions)
                     │
            ┌────────┴────────────┐
            ▼                     ▼
       [Flink]               [Consumer]
    Alert detection        Kafka → Cassandra
    Escalation timer         (time-series)
            │                     │
            ▼                     ▼
       MongoDB                Cassandra
  (alerts, cases,          (vitals_by_patient_day
   beds, orders)            vitals_by_or_day)
            │
            ▼
       FastAPI + WebSocket
            │
            ▼
       React Dashboard
   ┌────────────────────┐
   │  6-bed OR grid     │
   │  Alert queue       │
   │  Vital waveform    │
   │  Bed board         │
   └────────────────────┘
```

---

## Quick Start

### Prerequisites
- Docker Desktop running
- Python 3.11+
- Node 20+

### 1. Clone & configure
```bash
git clone https://github.com/PushkarKanjani/VitalStream.git
cd VitalStream
cp .env.example .env
```

### 2. Start all services (~1-2 min on first run)
```bash
docker-compose up -d
```

### 3. Initialize Cassandra schema (after Cassandra is healthy)
```bash
docker exec vs_cassandra cqlsh -f /scripts/init_cassandra.cql
```

### 4. Start backend API
```bash
cd backend
python -m venv .venv && .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### 5. Seed demo data & start simulator
```bash
# Seed initial beds, patients, and operating cases
python scripts/seed_demo_data.py

# Stream live VitalDB surgery vitals into Kafka (6 ORs)
python simulator/monitor_sim.py --ors 6 --speed 10
```

### 6. Start frontend
```bash
cd frontend
npm install
npm run dev
# Open http://localhost:5173
```

---

## Team & Project Ownership

| Member | Role | Component Ownership | Dedicated Guide |
|---|---|---|---|
| **Pushkar Kanjani** | Member 1 (Lead) | **MongoDB + FastAPI + React Dashboard**<br>ACID Bed Locks, Allergy Safety Engine, WebSockets | [Member 1 Guide](docs/TEAM_HANDOFF_GUIDE.md) |
| **Sachi Shah** | Member 2 | **Kafka Streaming & Cassandra Consumer**<br>VitalDB Real-Time Stream (`vitals.raw`), Batch Ingestion | [Sachi's Guide](docs/MEMBER_2_KAFKA_CASSANDRA_GUIDE.md) |
| **Yug Thakkar** | Member 3 | **Apache Flink Real-Time Alerts**<br>Anomaly Detection, 5-min Deduplication, 10-min Timers | [Yug's Guide](docs/MEMBER_3_FLINK_STREAMING_GUIDE.md) |
| **Hemang Shreemali** | Member 4 | **Cassandra Time-Series Storage & SLA Testing**<br>TWCS Compaction, High-Throughput SLA Benchmark (<5ms) | [Hemang's Guide](docs/MEMBER_4_CASSANDRA_PERF_GUIDE.md) |

---

## Ports & Endpoints

| Service | URL / Port | Role |
|---|---|---|
| **Frontend Dashboard** | `http://localhost:5173` | React 18 Light Minimal Command Center |
| **FastAPI Backend & Docs** | `http://localhost:8000` (`/docs`) | REST APIs + WebSocket Hub (`/ws`) |
| **Flink Dashboard** | `http://localhost:8081` | Flink 1.18 JobManager & Stream Metrics |
| **Kafdrop (Kafka UI)** | `http://localhost:9000` | Inspect Kafka Topics & Partitions |
| **MongoDB 7.0** | `localhost:27017` | Document Store & ACID Transactions |
| **Apache Cassandra 4.1** | `localhost:9042` | Time-Series Vital Telemetry Storage |

