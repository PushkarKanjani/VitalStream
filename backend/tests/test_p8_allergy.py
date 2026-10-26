"""Test P8: Allergy check by composition and class against backend endpoints."""
import sys
import requests

BASE_URL = "http://127.0.0.1:8000"

def test_allergy_checks():
    patient_id = "vdb-patient-101" # Sunita Verma (penicillin, aspirin)

    cases = [
        {"med": "Augmentin 625 Duo", "expected": "BLOCK"},
        {"med": "Combiflam", "expected": "BLOCK"},
        {"med": "Pan 40", "expected": "CLEARED"},
        {"med": "Cefazolin 1g Inj", "expected": "CAUTION"},
    ]

    print("Running P8 Allergy Evaluation Verification...")
    for c in cases:
        resp = requests.post(
            f"{BASE_URL}/api/orders/check",
            json={"patient_id": patient_id, "medication": c["med"]}
        )
        assert resp.status_code == 200, f"Check failed for {c['med']}: {resp.status_code} {resp.text}"
        data = resp.json()
        outcome = data.get("outcome")
        reason = data.get("reason")
        print(f"  [{outcome}] {c['med']} -> {reason}")
        assert outcome == c["expected"], f"Expected {c['expected']} for {c['med']}, got {outcome}"

    # Also test actual order submission: BLOCK should raise 422
    block_order = requests.post(
        f"{BASE_URL}/api/orders/",
        json={
            "case_id": "CASE-001",
            "patient_id": patient_id,
            "medication": "Augmentin 625 Duo",
            "dose_mg": 625.0,
            "route": "Oral",
            "ordered_by": "Dr. Verification"
        }
    )
    assert block_order.status_code == 422, f"Expected 422 for blocked drug, got {block_order.status_code}"
    print("  [OK] Order submission for Augmentin returned 422 as expected.")

    # CAUTION should succeed with allergy_status == "CAUTION"
    caution_order = requests.post(
        f"{BASE_URL}/api/orders/",
        json={
            "case_id": "CASE-001",
            "patient_id": patient_id,
            "medication": "Cefazolin 1g Inj",
            "dose_mg": 1000.0,
            "route": "IV",
            "ordered_by": "Dr. Verification"
        }
    )
    assert caution_order.status_code == 201, f"Expected 201 for caution drug, got {caution_order.status_code}: {caution_order.text}"
    c_data = caution_order.json()
    assert c_data.get("allergy_status") == "CAUTION", f"Expected CAUTION status, got {c_data.get('allergy_status')}"
    print(f"  [OK] Order submission for Cefazolin created with CAUTION status. Rx: {c_data.get('rx_line')}")

    # CLEARED should succeed with allergy_status == "CLEARED"
    clear_order = requests.post(
        f"{BASE_URL}/api/orders/",
        json={
            "case_id": "CASE-001",
            "patient_id": patient_id,
            "medication": "Pan 40",
            "dose_mg": 40.0,
            "route": "Oral",
            "ordered_by": "Dr. Verification"
        }
    )
    assert clear_order.status_code == 201, f"Expected 201 for cleared drug, got {clear_order.status_code}"
    cl_data = clear_order.json()
    assert cl_data.get("allergy_status") == "CLEARED", f"Expected CLEARED status, got {cl_data.get('allergy_status')}"
    print(f"  [OK] Order submission for Pan 40 created with CLEARED status. Rx: {cl_data.get('rx_line')}")

    print("\nALL P8 BACKEND CHECKS PASSED: Exit code 0")

if __name__ == "__main__":
    test_allergy_checks()
