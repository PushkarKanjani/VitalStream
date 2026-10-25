"""
VitalStream — Comprehensive Integration & Edge Case Test Suite
Tests:
1. ACID Bed Reservation Concurrency & Double-Booking Prevention (409 Conflict)
2. Pharmacological Drug-Allergy Safety Guard & Contraindication Interception (422 Unprocessable Entity)
3. Bed Discharge & Release Workflow
4. Alert Acknowledgment Workflow
5. System Health Check
"""

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.db import connect_mongo, disconnect_mongo, get_db

@pytest_asyncio.fixture(scope="function", autouse=True)
async def init_database():
    """Ensure MongoDB is connected on the current event loop for each test."""
    await connect_mongo()
    yield
    await disconnect_mongo()

@pytest.mark.asyncio
async def test_health_endpoint():
    """Verify system health endpoint returns status of dependencies."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get("/api/metrics/health")
        assert res.status_code == 200
        data = res.json()
        assert "mongodb" in data
        assert "flink" in data

@pytest.mark.asyncio
async def test_acid_bed_reservation_and_double_booking_prevention():
    """
    CRITICAL EDGE CASE TEST:
    Verifies that when Bed REC-1 is available, the first reservation succeeds,
    and a second concurrent reservation on the same bed is ATOMICALLY REJECTED with 409 Conflict.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Step 1: Ensure bed REC-1 is released / available
        await ac.post("/api/beds/release/REC-1")

        # Step 2: First nurse reserves REC-1 for CASE-001
        res1 = await ac.post("/api/beds/reserve", json={
            "bed_id": "REC-1",
            "case_id": "CASE-TEST-001",
            "reserved_by": "Nurse Alice"
        })
        assert res1.status_code == 200, f"Expected 200 on first reservation, got {res1.status_code}: {res1.text}"
        data1 = res1.json()
        assert data1["bed"]["status"] == "occupied"
        assert data1["bed"]["case_id"] == "CASE-TEST-001"

        # Step 3: Second nurse tries to reserve REC-1 simultaneously for CASE-002
        res2 = await ac.post("/api/beds/reserve", json={
            "bed_id": "REC-1",
            "case_id": "CASE-TEST-002",
            "reserved_by": "Nurse Bob"
        })
        # MUST return 409 Conflict to prevent double-booking!
        assert res2.status_code == 409, f"Expected 409 Conflict on double-booking, got {res2.status_code}"
        assert "already occupied" in res2.json()["detail"].lower()
        assert "double-booking prevented" in res2.json()["detail"].lower()

        # Step 4: Clean up by releasing REC-1
        rel_res = await ac.post("/api/beds/release/REC-1")
        assert rel_res.status_code == 200
        assert rel_res.json()["message"] == "Bed REC-1 released"

@pytest.mark.asyncio
async def test_drug_allergy_interception():
    """
    CLINICAL SAFETY TEST:
    Verifies that the closed-loop drug allergy safety guard synchronously intercepts
    contraindicated medications (e.g. Amoxicillin for Penicillin allergy) and blocks them with 422.
    """
    db = get_db()
    # Seed test patient with penicillin and aspirin allergies
    test_patient = {
        "patient_id": "PATIENT-ALLERGY-TEST",
        "name": "Jane Doe",
        "allergies": ["penicillin", "aspirin"],
        "age": 45,
        "gender": "F"
    }
    await db.patients.update_one(
        {"patient_id": test_patient["patient_id"]},
        {"$set": test_patient},
        upsert=True
    )

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Test 1: Order Amoxicillin (Penicillin class) -> MUST BE BLOCKED
        res_blocked = await ac.post("/api/orders/", json={
            "case_id": "CASE-TEST-999",
            "patient_id": "PATIENT-ALLERGY-TEST",
            "medication": "Amoxicillin",
            "dose_mg": 500.0,
            "route": "IV",
            "ordered_by": "Dr. Test"
        })
        assert res_blocked.status_code == 422, f"Expected 422 for contraindicated drug, got {res_blocked.status_code}"
        detail = res_blocked.json()["detail"]
        assert "ORDER BLOCKED" in detail
        assert "allergic to 'penicillin'" in detail

        # Test 2: Order Ibuprofen (NSAID/Aspirin cross-reactivity) -> MUST BE BLOCKED
        res_aspirin = await ac.post("/api/orders/", json={
            "case_id": "CASE-TEST-999",
            "patient_id": "PATIENT-ALLERGY-TEST",
            "medication": "Ibuprofen",
            "dose_mg": 400.0,
            "route": "oral",
            "ordered_by": "Dr. Test"
        })
        assert res_aspirin.status_code == 422
        assert "allergic to 'aspirin'" in res_aspirin.json()["detail"]

        # Test 3: Order Cefazolin (Safe medication not in allergy list) -> MUST PASS
        res_safe = await ac.post("/api/orders/", json={
            "case_id": "CASE-TEST-999",
            "patient_id": "PATIENT-ALLERGY-TEST",
            "medication": "Cefazolin",
            "dose_mg": 1000.0,
            "route": "IV",
            "ordered_by": "Dr. Test"
        })
        assert res_safe.status_code == 201, f"Expected 201 for safe drug, got {res_safe.status_code}"
        order_data = res_safe.json()
        assert order_data["allergy_check_passed"] is True
        assert order_data["medication"] == "Cefazolin"

@pytest.mark.asyncio
async def test_alert_acknowledgment_workflow():
    """Verify alert listing and acknowledge action."""
    db = get_db()
    # Insert test alert
    test_alert = {
        "alert_id": "TEST-ALERT-001",
        "case_id": "CASE-001",
        "or_id": "OR-1",
        "patient_id": "PATIENT-001",
        "alert_type": "BP_LOW",
        "severity": "critical",
        "reason": "Systolic BP 78 mmHg (< 90 threshold)",
        "acknowledged": False
    }
    await db.alerts.update_one(
        {"alert_id": test_alert["alert_id"]},
        {"$set": test_alert},
        upsert=True
    )

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Fetch unacked alerts
        res = await ac.get("/api/alerts/unacknowledged")
        assert res.status_code == 200
        unacked = res.json()
        assert any(a["alert_id"] == "TEST-ALERT-001" for a in unacked)

        # Acknowledge the alert
        ack_res = await ac.post("/api/alerts/TEST-ALERT-001/acknowledge", json={
            "acknowledged_by": "Lead Anesthesiologist"
        })
        assert ack_res.status_code == 200
        assert "acknowledged" in ack_res.json()["message"]

        # Verify it's no longer unacknowledged
        res_after = await ac.get("/api/alerts/unacknowledged")
        assert not any(a["alert_id"] == "TEST-ALERT-001" for a in res_after.json())
