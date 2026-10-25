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

### 2. Start all services (~45 min first run, Cassandra is slow)
```bash
docker-compose up -d
```

### 3. Initialize Cassandra schema (after ~60s)
```bash
docker exec vs_cassandra cqlsh -f /scripts/init_cassandra.cql
```

### 4. Start backend API
```bash
cd backend
python -m venv .venv && .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 5000
```

### 5. Download VitalDB data & start simulator
```bash
python scripts/vitaldb_downloader.py   # ~5 min download
python simulator/monitor_sim.py --ors 6 --speed 10x
```

### 6. Start frontend
```bash
cd frontend
npm install
npm run dev
# Open http://localhost:5173
```

---

## Team

| Member | Roll No | Component |
|--------|---------|-----------|
| Pushkar Kanjani | 23BIT153 | MongoDB + FastAPI (cases, beds, orders, alerts) |
| Member 2 | 23BIT___ | Kafka producer + Cassandra consumer |
| Member 3 | 23BIT___ | Flink alert detection + escalation |
| Member 4 | 23BIT___ | Time-series DB + load testing |

---

## Ports

| Service | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| FastAPI | http://localhost:5000 |
| Flink UI | http://localhost:8081 |
| Kafdrop (Kafka UI) | http://localhost:9000 |
| MongoDB | localhost:27017 |
| Cassandra | localhost:9042 |
