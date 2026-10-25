# VitalStream — 5-Minute Clinical Command Center Demo Script

**Presenter:** Pushkar Kanjani (Roll: 23BIT153)  
**Project:** VitalStream — Real-Time Perioperative Clinical Command Center on a Big Data Lakehouse  
**Repository:** [https://github.com/PushkarKanjani/VitalStream](https://github.com/PushkarKanjani/VitalStream)

---

## 🕒 Demo Timeline (5 Minutes)

| Time | Segment | What to Show | Key Talking Points |
|------|---------|--------------|-------------------|
| **0:00 - 1:00** | Architecture & Stack Overview | Pipeline Health pills & Docker status | Distributed Big Data stack: Kafka 3.6, Flink 1.18, Cassandra 4.1, MongoDB 7.0, FastAPI |
| **1:00 - 2:00** | OR Wall (6-Bed Live Telemetry) | React OR Wall grid (OR-1 to OR-6) | Real-time hemodynamics (HR, BP, SpO2, Temp), active surgical cases & primary surgeons |
| **2:00 - 3:00** | ACID Bed Reservation & Double-Booking Prevention | Recovery Bed Board & `POST /api/beds/reserve` | Atomic `findOneAndUpdate` condition prevents race conditions & double-booking (409 Conflict) |
| **3:00 - 4:00** | Clinical Safety: Allergy Check | Medication Order `POST /api/orders` | Pre-administration allergy screening blocks offending drugs (422 Unprocessable Entity) |
| **4:00 - 5:00** | Alert Queue & WebSocket ACK Flow | Alert Queue & `POST /api/alerts/{id}/acknowledge` | Real-time alert lifecycle, sub-second WebSocket sync, audit trail |

---

## 🧪 Step-by-Step Viva Execution Commands

### 1. Pre-Flight Verification: Health Check
Run in browser or terminal:
```bash
curl http://localhost:5000/health
curl http://localhost:5000/api/metrics/health
```
**Expected Response:**
```json
{
  "status": "ok",
  "service": "vitalstream-api"
}
```

---

### 2. ACID Bed Reservation Demo (Atomic MongoDB Operations)

#### Step 2a: Reserve an available recovery bed (REC-1)
```bash
curl -X POST http://localhost:5000/api/beds/reserve \
  -H "Content-Type: application/json" \
  -d '{"bed_id": "REC-1", "case_id": "CASE-001", "reserved_by": "Dr. Sarah Chen"}'
```
**Expected Output (200 OK):**
```json
{
  "message": "Bed REC-1 reserved for case CASE-001",
  "bed": {
    "bed_id": "REC-1",
    "type": "recovery",
    "status": "occupied",
    "case_id": "CASE-001",
    "reserved_by": "Dr. Sarah Chen"
  }
}
```

#### Step 2b: Attempt Concurrent Double-Booking on REC-1
```bash
curl -X POST http://localhost:5000/api/beds/reserve \
  -H "Content-Type: application/json" \
  -d '{"bed_id": "REC-1", "case_id": "CASE-002", "reserved_by": "Dr. Marcus Vance"}'
```
**Expected Output (409 Conflict):**
```json
{
  "detail": "Bed REC-1 is already occupied (case CASE-001). Double-booking prevented."
}
```
> **Talking Point:** Explain that MongoDB's atomic `findOneAndUpdate` with `{status: 'available'}` filter guarantees ACID isolation at single-document level without requiring heavy distributed multi-document locks.

---

### 3. Clinical Safety: Allergy Block Demo

#### Step 3a: Attempt to order Amoxicillin for Penicillin-Allergic Patient (P-101)
```bash
curl -X POST http://localhost:5000/api/orders \
  -H "Content-Type: application/json" \
  -d '{"case_id": "CASE-001", "patient_id": "P-101", "medication": "amoxicillin", "dose_mg": 500, "route": "IV", "ordered_by": "Dr. Sarah Chen"}'
```
**Expected Output (422 Unprocessable Entity):**
```json
{
  "detail": "ORDER BLOCKED — Patient P-101 is allergic to 'penicillin'. Medication 'amoxicillin' cannot be administered."
}
```
> **Talking Point:** Pre-administration safety rule dynamically cross-references patient allergy profile against known cross-reactivity drug classes (`ALLERGY_DRUG_MAP`) before allowing order insertion.

#### Step 3b: Place a Safe Medication Order (Cefazolin)
```bash
curl -X POST http://localhost:5000/api/orders \
  -H "Content-Type: application/json" \
  -d '{"case_id": "CASE-001", "patient_id": "P-101", "medication": "cefazolin", "dose_mg": 2000, "route": "IV", "ordered_by": "Dr. Sarah Chen"}'
```
**Expected Output (201 Created):**
```json
{
  "order_id": "...",
  "case_id": "CASE-001",
  "patient_id": "P-101",
  "medication": "cefazolin",
  "dose_mg": 2000,
  "route": "IV",
  "allergy_check_passed": true,
  "status": "pending"
}
```

---

### 4. Alert Acknowledgment Demo

#### Step 4a: View Active Unacknowledged Alerts
```bash
curl http://localhost:5000/api/alerts/unacknowledged
```

#### Step 4b: Acknowledge Critical Alert (ALT-101)
```bash
curl -X POST http://localhost:5000/api/alerts/ALT-101/acknowledge \
  -H "Content-Type: application/json" \
  -d '{"acknowledged_by": "Dr. Alan Mercer (Anesthesiologist)"}'
```
**Expected Output (200 OK):**
```json
{
  "message": "Alert ALT-101 acknowledged by Dr. Alan Mercer (Anesthesiologist)"
}
```
> **Talking Point:** Acknowledged alerts record clinician ID and UTC timestamp for medical audit trails. Unacknowledged alerts past 10 minutes are automatically flagged for charge-nurse escalation by Flink streaming windowing.

---

### 5. Release Bed for Next Patient
```bash
curl -X POST http://localhost:5000/api/beds/release/REC-1
```
**Expected Output (200 OK):**
```json
{
  "message": "Bed REC-1 released"
}
```

---

## 🎯 Summary of Key Questions for the Evaluator

1. **Why MongoDB for cases, beds, and orders instead of relational SQL?**
   - Semi-structured clinical documents (varying surgical attributes, dynamic allergy lists).
   - High-performance atomic writes (`findOneAndUpdate`) for instantaneous bed reservations.
   - Built-in TTL indexes for telemetry and alert retention.

2. **How does VitalStream handle distributed consistency?**
   - Time-series vitals in Cassandra: partition key `(patient_id, reading_date)` with TWCS (Time Window Compaction Strategy) for high write throughput.
   - Operational state in MongoDB: ACID atomic operations per document.
   - Kafka topics decouple high-frequency 100Hz physiological telemetry from REST query traffic.
