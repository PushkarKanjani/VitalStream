"""Seed authentic Gandhinagar hospital surgical cases into MongoDB."""

import pymongo
from datetime import datetime

MONGO_URI = "mongodb://vsadmin:vspass2024@localhost:27017/vitalstream?authSource=admin"

def seed_cases():
    client = pymongo.MongoClient(MONGO_URI)
    db = client["vitalstream"]

    cases = [
        {
            "case_id": "CASE-001",
            "patient_id": "vdb-patient-101",
            "or_id": "OR-1",
            "procedure_name": "Coronary Artery Bypass Graft (CABG)",
            "procedure_type": "Coronary Artery Bypass Graft (CABG)",
            "primary_surgeon": "Dr. Aditi Sharma (Chief Surgeon)",
            "surgeon_name": "Aditi Sharma",
            "anesthesiologist": "Dr. Amit Sen",
            "status": "active",
            "scheduled_start": datetime.utcnow(),
            "actual_start": datetime.utcnow(),
            "notes": "Cardiopulmonary bypass initiated. Monitored by Dr. Aditi Sharma."
        },
        {
            "case_id": "CASE-002",
            "patient_id": "vdb-patient-102",
            "or_id": "OR-2",
            "procedure_name": "Laparoscopic Cholecystectomy",
            "procedure_type": "Laparoscopic Cholecystectomy",
            "primary_surgeon": "Dr. Rajesh Kulkarni (Chief Surgeon)",
            "surgeon_name": "Rajesh Kulkarni",
            "anesthesiologist": "Dr. Neha Trivedi",
            "status": "active",
            "scheduled_start": datetime.utcnow(),
            "actual_start": datetime.utcnow(),
            "notes": "Pneumoperitoneum established. Stable hemodynamics."
        },
        {
            "case_id": "CASE-003",
            "patient_id": "vdb-patient-103",
            "or_id": "OR-3",
            "procedure_name": "Total Hip Arthroplasty",
            "procedure_type": "Total Hip Arthroplasty",
            "primary_surgeon": "Dr. Anjali Mehta (Chief Surgeon)",
            "surgeon_name": "Anjali Mehta",
            "anesthesiologist": "Dr. Parth Joshi",
            "status": "active",
            "scheduled_start": datetime.utcnow(),
            "actual_start": datetime.utcnow(),
            "notes": "Spinal anesthesia administered. Monitoring MAP."
        },
        {
            "case_id": "CASE-004",
            "patient_id": "vdb-patient-104",
            "or_id": "OR-4",
            "procedure_name": "Craniotomy for Subdural Hematoma",
            "procedure_type": "Craniotomy for Subdural Hematoma",
            "primary_surgeon": "Dr. Rohan Gupta (Chief Surgeon)",
            "surgeon_name": "Rohan Gupta",
            "anesthesiologist": "Dr. Meera Pandya",
            "status": "active",
            "scheduled_start": datetime.utcnow(),
            "actual_start": datetime.utcnow(),
            "notes": "Intracranial pressure monitoring active."
        },
        {
            "case_id": "CASE-005",
            "patient_id": "vdb-patient-105",
            "or_id": "OR-5",
            "procedure_name": "Emergency Exploratory Laparotomy",
            "procedure_type": "Emergency Exploratory Laparotomy",
            "primary_surgeon": "Dr. Vivek Menon (Chief Surgeon)",
            "surgeon_name": "Vivek Menon",
            "anesthesiologist": "Dr. Krunal Bhatt",
            "status": "active",
            "scheduled_start": datetime.utcnow(),
            "actual_start": datetime.utcnow(),
            "notes": "Bowel perforation repair. Arterial line placed."
        },
        {
            "case_id": "CASE-006",
            "patient_id": "vdb-patient-106",
            "or_id": "OR-6",
            "procedure_name": "Video-Assisted Thoracoscopic Surgery (VATS)",
            "procedure_type": "Video-Assisted Thoracoscopic Surgery (VATS)",
            "primary_surgeon": "Dr. Suresh Nambiar (Chief Surgeon)",
            "surgeon_name": "Suresh Nambiar",
            "anesthesiologist": "Dr. Harshil Shah",
            "status": "active",
            "scheduled_start": datetime.utcnow(),
            "actual_start": datetime.utcnow(),
            "notes": "One-lung ventilation established."
        }
    ]

    for c in cases:
        db.cases.update_one({"case_id": c["case_id"]}, {"$set": c}, upsert=True)

    print(f"[OK] Successfully updated {len(cases)} cases in MongoDB with Chief Surgeons.")

if __name__ == "__main__":
    seed_cases()
