"""Seed preset patients into MongoDB for clinical and medication tests."""
import asyncio
import os
import sys
from pymongo import MongoClient

MONGO_URI = os.getenv("MONGO_URI", "mongodb://vsadmin:vspass2024@localhost:27017/vitalstream?authSource=admin")

def seed():
    client = MongoClient(MONGO_URI)
    db = client.vitalstream
    pts = [
        {'patient_id': 'vdb-patient-101', 'name': 'Sunita Verma', 'age': 62, 'gender': 'F', 'blood_type': 'A+', 'allergies': ['penicillin', 'aspirin'], 'weight_kg': 64.0, 'height_cm': 162.0, 'chronic_conditions': ['Hypertension']},
        {'patient_id': 'vdb-patient-102', 'name': 'Rajesh Malhotra', 'age': 48, 'gender': 'M', 'blood_type': 'O+', 'allergies': ['sulfa'], 'weight_kg': 78.0, 'height_cm': 175.0, 'chronic_conditions': []},
        {'patient_id': 'vdb-patient-103', 'name': 'Pooja Iyer', 'age': 34, 'gender': 'F', 'blood_type': 'B+', 'allergies': ['latex'], 'weight_kg': 58.0, 'height_cm': 165.0, 'chronic_conditions': ['Asthma']},
        {'patient_id': 'vdb-patient-104', 'name': 'Ramesh Patel', 'age': 71, 'gender': 'M', 'blood_type': 'AB+', 'allergies': ['contrast'], 'weight_kg': 82.0, 'height_cm': 170.0, 'chronic_conditions': ['CAD']},
        {'patient_id': 'vdb-patient-105', 'name': 'Priyanka Desai', 'age': 29, 'gender': 'F', 'blood_type': 'O-', 'allergies': [], 'weight_kg': 60.0, 'height_cm': 168.0, 'chronic_conditions': []},
        {'patient_id': 'vdb-patient-106', 'name': 'Vikram Nair', 'age': 55, 'gender': 'M', 'blood_type': 'A-', 'allergies': ['codeine'], 'weight_kg': 85.0, 'height_cm': 178.0, 'chronic_conditions': ['T2D']},
    ]
    for p in pts:
        db.patients.update_one({'patient_id': p['patient_id']}, {'$set': p}, upsert=True)
    print(f"[OK] Seeded {len(pts)} preset patients into MongoDB.")
    client.close()

if __name__ == "__main__":
    seed()
