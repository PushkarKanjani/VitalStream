#!/usr/bin/env python3
"""
VitalStream — Seed Realistic Demo Data
Seeds:
- 6 Patients with demographic & clinical allergy profiles
- 6 Active Surgical Cases (OR-1 to OR-6)
- Bed occupancy updates
- 3 Realistic Active Alerts (Tachycardia, Hypotension, Desaturation)
- Medication Orders
- Cassandra baseline readings in latest_vitals_by_or
"""

import os
from datetime import datetime
from pymongo import MongoClient

MONGO_URI = os.getenv("MONGO_URI", "mongodb://vsadmin:vspass2024@localhost:27017/vitalstream?authSource=admin")

def seed():
    print(f"Connecting to MongoDB: {MONGO_URI}...")
    client = MongoClient(MONGO_URI)
    db = client.vitalstream

    # ── 1. PATIENTS ─────────────────────────────────────────────────────────────
    patients = [
        {
            "patient_id": "P-101",
            "name": "James Wilson",
            "age": 58,
            "gender": "M",
            "blood_type": "A+",
            "allergies": ["penicillin", "amoxicillin"],
            "chronic_conditions": ["Hypertension", "Type 2 Diabetes"],
            "weight_kg": 84.5,
            "height_cm": 178,
            "created_at": datetime.utcnow()
        },
        {
            "patient_id": "P-102",
            "name": "Sarah Jenkins",
            "age": 42,
            "gender": "F",
            "blood_type": "O+",
            "allergies": ["latex", "sulfa"],
            "chronic_conditions": ["Asthma"],
            "weight_kg": 62.0,
            "height_cm": 165,
            "created_at": datetime.utcnow()
        },
        {
            "patient_id": "P-103",
            "name": "Robert Chang",
            "age": 67,
            "gender": "M",
            "blood_type": "B+",
            "allergies": ["aspirin"],
            "chronic_conditions": ["Coronary Artery Disease"],
            "weight_kg": 76.2,
            "height_cm": 172,
            "created_at": datetime.utcnow()
        },
        {
            "patient_id": "P-104",
            "name": "Emily Davis",
            "age": 31,
            "gender": "F",
            "blood_type": "A-",
            "allergies": [],
            "chronic_conditions": [],
            "weight_kg": 58.5,
            "height_cm": 168,
            "created_at": datetime.utcnow()
        },
        {
            "patient_id": "P-105",
            "name": "Michael Brown",
            "age": 73,
            "gender": "M",
            "blood_type": "AB+",
            "allergies": ["iodine"],
            "chronic_conditions": ["Chronic Kidney Disease", "Atrial Fibrillation"],
            "weight_kg": 91.0,
            "height_cm": 182,
            "created_at": datetime.utcnow()
        },
        {
            "patient_id": "P-106",
            "name": "Maria Rodriguez",
            "age": 50,
            "gender": "F",
            "blood_type": "O-",
            "allergies": ["codeine"],
            "chronic_conditions": ["Rheumatoid Arthritis"],
            "weight_kg": 68.0,
            "height_cm": 162,
            "created_at": datetime.utcnow()
        }
    ]

    for p in patients:
        db.patients.update_one({"patient_id": p["patient_id"]}, {"$set": p}, upsert=True)
    print(f"[OK] Seeded {len(patients)} patients.")

    # ── 2. CASES (OR-1 to OR-6) ─────────────────────────────────────────────────
    cases = [
        {
            "case_id": "CASE-001",
            "patient_id": "P-101",
            "or_id": "OR-1",
            "procedure_name": "Coronary Artery Bypass Graft (CABG)",
            "primary_surgeon": "Dr. Sarah Chen",
            "anesthesiologist": "Dr. Alan Mercer",
            "status": "active",
            "scheduled_start": datetime.utcnow(),
            "actual_start": datetime.utcnow(),
            "notes": "Cardiopulmonary bypass initiated. Monitor ST segments."
        },
        {
            "case_id": "CASE-002",
            "patient_id": "P-102",
            "or_id": "OR-2",
            "procedure_name": "Laparoscopic Cholecystectomy",
            "primary_surgeon": "Dr. Marcus Vance",
            "anesthesiologist": "Dr. Clara Oswald",
            "status": "active",
            "scheduled_start": datetime.utcnow(),
            "actual_start": datetime.utcnow(),
            "notes": "Pneumoperitoneum established. Stable hemodynamics."
        },
        {
            "case_id": "CASE-003",
            "patient_id": "P-103",
            "or_id": "OR-3",
            "procedure_name": "Total Hip Arthroplasty",
            "primary_surgeon": "Dr. Elena Rostova",
            "anesthesiologist": "Dr. Kevin Zhang",
            "status": "active",
            "scheduled_start": datetime.utcnow(),
            "actual_start": datetime.utcnow(),
            "notes": "Spinal anesthesia administered. Monitoring MAP."
        },
        {
            "case_id": "CASE-004",
            "patient_id": "P-104",
            "or_id": "OR-4",
            "procedure_name": "Craniotomy for Subdural Hematoma",
            "primary_surgeon": "Dr. David Kim",
            "anesthesiologist": "Dr. Rachel Green",
            "status": "active",
            "scheduled_start": datetime.utcnow(),
            "actual_start": datetime.utcnow(),
            "notes": "Intracranial pressure monitoring active."
        },
        {
            "case_id": "CASE-005",
            "patient_id": "P-105",
            "or_id": "OR-5",
            "procedure_name": "Emergency Exploratory Laparotomy",
            "primary_surgeon": "Dr. Robert Thorne",
            "anesthesiologist": "Dr. Lisa Cuddy",
            "status": "active",
            "scheduled_start": datetime.utcnow(),
            "actual_start": datetime.utcnow(),
            "notes": "Bowel perforation repair. Arterial line placed."
        },
        {
            "case_id": "CASE-006",
            "patient_id": "P-106",
            "or_id": "OR-6",
            "procedure_name": "Video-Assisted Thoracoscopic Surgery (VATS)",
            "primary_surgeon": "Dr. Aisha Patel",
            "anesthesiologist": "Dr. John Watson",
            "status": "active",
            "scheduled_start": datetime.utcnow(),
            "actual_start": datetime.utcnow(),
            "notes": "One-lung ventilation established."
        }
    ]

    for c in cases:
        db.cases.update_one({"case_id": c["case_id"]}, {"$set": c}, upsert=True)
    print(f"[OK] Seeded {len(cases)} active surgical cases.")

    # ── 3. UPDATE BEDS ──────────────────────────────────────────────────────────
    for c in cases:
        db.beds.update_one(
            {"bed_id": c["or_id"]},
            {
                "$set": {
                    "status": "occupied",
                    "case_id": c["case_id"],
                    "reserved_by": c["primary_surgeon"],
                    "reserved_at": datetime.utcnow()
                }
            }
        )
    print("[OK] Updated OR beds 1-6 as occupied.")

    # ── 4. SEED DEMO ALERTS ─────────────────────────────────────────────────────
    alerts = [
        {
            "alert_id": "ALT-101",
            "case_id": "CASE-001",
            "or_id": "OR-1",
            "patient_id": "P-101",
            "parameter": "HR",
            "value": 142.0,
            "threshold": 120.0,
            "severity": "critical",
            "message": "CRITICAL: Tachycardia alert — HR 142 bpm exceeds safety threshold (120 bpm)",
            "acknowledged": False,
            "acknowledged_by": None,
            "ack_time": None,
            "created_at": datetime.utcnow()
        },
        {
            "alert_id": "ALT-102",
            "case_id": "CASE-003",
            "or_id": "OR-3",
            "patient_id": "P-103",
            "parameter": "Systolic BP",
            "value": 82.0,
            "threshold": 90.0,
            "severity": "warning",
            "message": "WARNING: Intraoperative Hypotension — Systolic BP 82 mmHg (target > 90)",
            "acknowledged": False,
            "acknowledged_by": None,
            "ack_time": None,
            "created_at": datetime.utcnow()
        },
        {
            "alert_id": "ALT-103",
            "case_id": "CASE-005",
            "or_id": "OR-5",
            "patient_id": "P-105",
            "parameter": "SpO2",
            "value": 88.5,
            "threshold": 92.0,
            "severity": "critical",
            "message": "CRITICAL: Severe Hypoxemia — SpO2 88.5% below clinical limit (92%)",
            "acknowledged": False,
            "acknowledged_by": None,
            "ack_time": None,
            "created_at": datetime.utcnow()
        }
    ]

    for a in alerts:
        db.alerts.update_one({"alert_id": a["alert_id"]}, {"$set": a}, upsert=True)
    print(f"[OK] Seeded {len(alerts)} realistic alerts.")

    # ── 5. SEED SAMPLE ORDERS ───────────────────────────────────────────────────
    orders = [
        {
            "order_id": "ORD-101",
            "case_id": "CASE-001",
            "patient_id": "P-101",
            "medication": "cefazolin",
            "dose_mg": 2000.0,
            "route": "IV",
            "ordered_by": "Dr. Sarah Chen",
            "allergy_check_passed": True,
            "status": "pending",
            "created_at": datetime.utcnow(),
            "administered_at": None
        },
        {
            "order_id": "ORD-102",
            "case_id": "CASE-002",
            "patient_id": "P-102",
            "medication": "fentanyl",
            "dose_mg": 100.0,
            "route": "IV",
            "ordered_by": "Dr. Marcus Vance",
            "allergy_check_passed": True,
            "status": "administered",
            "created_at": datetime.utcnow(),
            "administered_at": datetime.utcnow()
        }
    ]

    for o in orders:
        db.orders.update_one({"order_id": o["order_id"]}, {"$set": o}, upsert=True)
    print(f"[OK] Seeded {len(orders)} clinical orders.")
    client.close()
    print("\n[SUCCESS] All demo data seeded successfully into MongoDB.")

if __name__ == "__main__":
    seed()
