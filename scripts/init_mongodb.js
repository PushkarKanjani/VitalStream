// VitalStream — MongoDB Initialization Script
// Runs automatically inside the container on first boot (via docker-entrypoint-initdb.d)

const db = connect("mongodb://localhost:27017/vitalstream");

// ── 1. PATIENTS ───────────────────────────────────────────────────────────────
db.createCollection("patients");
db.patients.createIndex({ patient_id: 1 }, { unique: true });
db.patients.createIndex({ name: 1 });

// ── 2. CASES (surgery sessions) ───────────────────────────────────────────────
db.createCollection("cases");
db.cases.createIndex({ case_id: 1 }, { unique: true });
db.cases.createIndex({ or_id: 1, status: 1 });
db.cases.createIndex({ patient_id: 1 });

// ── 3. BEDS ───────────────────────────────────────────────────────────────────
db.createCollection("beds");
db.beds.createIndex({ bed_id: 1 }, { unique: true });
db.beds.createIndex({ status: 1 });

// Seed 6 operating rooms + 6 recovery beds
db.beds.insertMany([
  { bed_id: "OR-1", type: "operating_room", status: "available", floor: 3 },
  { bed_id: "OR-2", type: "operating_room", status: "available", floor: 3 },
  { bed_id: "OR-3", type: "operating_room", status: "available", floor: 3 },
  { bed_id: "OR-4", type: "operating_room", status: "available", floor: 3 },
  { bed_id: "OR-5", type: "operating_room", status: "available", floor: 3 },
  { bed_id: "OR-6", type: "operating_room", status: "available", floor: 3 },
  { bed_id: "REC-1", type: "recovery", status: "available", floor: 2 },
  { bed_id: "REC-2", type: "recovery", status: "available", floor: 2 },
  { bed_id: "REC-3", type: "recovery", status: "available", floor: 2 },
  { bed_id: "REC-4", type: "recovery", status: "available", floor: 2 },
  { bed_id: "REC-5", type: "recovery", status: "available", floor: 2 },
  { bed_id: "REC-6", type: "recovery", status: "available", floor: 2 },
]);

// ── 4. ORDERS (medication) ────────────────────────────────────────────────────
db.createCollection("orders");
db.orders.createIndex({ order_id: 1 }, { unique: true });
db.orders.createIndex({ case_id: 1 });
db.orders.createIndex({ patient_id: 1, status: 1 });

// ── 5. ALERTS ─────────────────────────────────────────────────────────────────
db.createCollection("alerts");
db.alerts.createIndex({ alert_id: 1 }, { unique: true });
db.alerts.createIndex({ case_id: 1, acknowledged: 1 });
db.alerts.createIndex({ created_at: 1 }, { expireAfterSeconds: 604800 }); // TTL 7d

// ── 6. ESCALATIONS ────────────────────────────────────────────────────────────
db.createCollection("escalations");
db.escalations.createIndex({ alert_id: 1 });
db.escalations.createIndex({ escalated_at: 1 });

// ── 7. PIPELINE_HEALTH (telemetry) ────────────────────────────────────────────
db.createCollection("pipeline_health");
db.pipeline_health.createIndex({ component: 1, recorded_at: -1 });
db.pipeline_health.createIndex(
  { recorded_at: 1 },
  { expireAfterSeconds: 3600 }   // TTL 1h — keep only last hour of stats
);

print("✓ VitalStream MongoDB collections and indexes created.");
print("✓ 12 beds seeded (OR-1 to OR-6, REC-1 to REC-6).");
