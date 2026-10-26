"""
Comprehensive Verification for P8, P9, P10, P11
- P8: Allergy check by composition and class (BLOCK, CAUTION, CLEARED)
- P9: Indian prescription form fields & drug catalog search
- P10: Order list display bug fix (no empty '()') & Idempotency deduplication
- P11: Save order in structured Indian format in MongoDB
"""
import sys
import uuid
import requests
from pymongo import MongoClient

BASE_URL = "http://127.0.0.1:8000"
MONGO_URI = "mongodb://vsadmin:vspass2024@localhost:27017/vitalstream?authSource=admin"

def verify():
    print("=" * 60)
    print("STARTING END-TO-END VERIFICATION: P8, P9, P10, P11")
    print("=" * 60)

    # ── P8: ALLERGY CHECK VERIFICATION ──
    patient_id = "vdb-patient-101" # Sunita Verma: penicillin, aspirin
    print("\n[P8] Testing Pharmacological Allergy Checking...")
    
    # 1. Augmentin -> BLOCK
    r1 = requests.post(f"{BASE_URL}/api/orders/check", json={"patient_id": patient_id, "medication": "Augmentin 625 Duo"})
    assert r1.status_code == 200, f"Check failed: {r1.text}"
    d1 = r1.json()
    assert d1["outcome"] == "BLOCK", f"Expected BLOCK, got {d1['outcome']}"
    print(f"  [OK] Augmentin 625 Duo -> BLOCK ({d1['reason']})")

    # 2. Combiflam -> BLOCK
    r2 = requests.post(f"{BASE_URL}/api/orders/check", json={"patient_id": patient_id, "medication": "Combiflam"})
    d2 = r2.json()
    assert d2["outcome"] == "BLOCK", f"Expected BLOCK, got {d2['outcome']}"
    print(f"  [OK] Combiflam -> BLOCK ({d2['reason']})")

    # 3. Pan 40 -> CLEARED
    r3 = requests.post(f"{BASE_URL}/api/orders/check", json={"patient_id": patient_id, "medication": "Pan 40"})
    d3 = r3.json()
    assert d3["outcome"] == "CLEARED", f"Expected CLEARED, got {d3['outcome']}"
    print(f"  [OK] Pan 40 -> CLEARED ({d3['reason']})")

    # 4. Cefazolin -> CAUTION
    r4 = requests.post(f"{BASE_URL}/api/orders/check", json={"patient_id": patient_id, "medication": "Cefazolin 1g Inj"})
    d4 = r4.json()
    assert d4["outcome"] == "CAUTION", f"Expected CAUTION, got {d4['outcome']}"
    print(f"  [OK] Cefazolin 1g Inj -> CAUTION ({d4['reason']})")

    # Blocked order attempt must fail with HTTP 422
    rb = requests.post(f"{BASE_URL}/api/orders/", json={
        "case_id": "CASE-001",
        "patient_id": patient_id,
        "medication": "Augmentin 625 Duo",
        "dose_mg": 625.0,
        "route": "Oral"
    })
    assert rb.status_code == 422, f"Expected 422, got {rb.status_code}"
    print(f"  [OK] Order submission for Augmentin was blocked with HTTP 422.")
    print("--> P8 PASS")

    # ── P9: INDIAN PRESCRIPTION FORM & CATALOG SEARCH ──
    print("\n[P9] Testing Indian Drug Catalog Search & Rx Formatting...")
    s_resp = requests.get(f"{BASE_URL}/api/drugs/search?q=pantoprazole")
    assert s_resp.status_code == 200
    s_drugs = s_resp.json()
    assert len(s_drugs) > 0, "No drugs found for pantoprazole"
    print(f"  [OK] Salt search 'pantoprazole' found {len(s_drugs)} matches: {[d['brand'] for d in s_drugs]}")

    rules_resp = requests.get(f"{BASE_URL}/api/orders/allergy-rules")
    assert rules_resp.status_code == 200
    rules = rules_resp.json()
    assert "penicillin" in rules and "aspirin" in rules
    print(f"  [OK] GET /api/orders/allergy-rules returned {len(rules)} clinical rules.")
    print("--> P9 PASS")

    # ── P10: FIX ORDER LIST DISPLAY & DEDUPLICATION ──
    print("\n[P10] Testing Order List Display Bug Fix & Idempotency...")
    # Fetch existing case orders and verify no string contains '()'
    case_resp = requests.get(f"{BASE_URL}/api/orders/case/CASE-001")
    assert case_resp.status_code == 200
    orders_list = case_resp.json()
    for ord_item in orders_list:
        rx = ord_item.get("rx_line", "")
        med = ord_item.get("medication", "")
        assert " ()" not in rx and " ()" not in med, f"Found empty parentheses in order: {ord_item}"
    print(f"  [OK] Verified {len(orders_list)} orders in CASE-001: none contain empty '()'.")

    # Test Idempotency: Submit same order twice with same Idempotency-Key
    test_key = f"test_idemp_{uuid.uuid4().hex[:10]}"
    order_payload = {
        "case_id": "CASE-001",
        "patient_id": patient_id,
        "medication": "Pan 40",
        "brand": "Pan 40",
        "form": "Tab.",
        "dose": 40.0,
        "unit": "mg",
        "frequency": "OD",
        "pattern": "1-0-0",
        "food_timing": "before food",
        "duration_days": 7,
        "route": "Oral",
        "qty": 7,
        "mrp_inr": 155.0,
        "ordered_by": "Dr. Test P10",
        "rx_line": "Tab. Pan 40 40mg | Oral | OD (1-0-0) x 7 days (before food)",
        "idempotency_key": test_key
    }
    
    sub1 = requests.post(f"{BASE_URL}/api/orders/", json=order_payload, headers={"Idempotency-Key": test_key})
    assert sub1.status_code == 201
    ord1_id = sub1.json()["order_id"]

    sub2 = requests.post(f"{BASE_URL}/api/orders/", json=order_payload, headers={"Idempotency-Key": test_key})
    assert sub2.status_code == 200 or sub2.status_code == 201
    ord2_id = sub2.json()["order_id"]
    assert ord1_id == ord2_id, f"Deduplication failed: generated two different order IDs {ord1_id} and {ord2_id}"
    print(f"  [OK] Idempotency deduplication verified: duplicate submission returned same order {ord1_id}.")
    print("--> P10 PASS")

    # ── P11: SAVE ORDER IN INDIAN FORMAT (MONGODB CHECK) ──
    print("\n[P11] Testing MongoDB Storage of Indian Prescription Fields...")
    client = MongoClient(MONGO_URI)
    db = client.vitalstream
    saved_doc = db.orders.find_one({"order_id": ord1_id}, {"_id": 0})
    assert saved_doc is not None, f"Order {ord1_id} not found in MongoDB orders collection"
    
    required_fields = ["brand", "form", "dose", "unit", "frequency", "pattern", "duration_days", "route", "qty", "mrp_inr", "rx_line", "allergy_status"]
    for f in required_fields:
        assert f in saved_doc, f"Missing required field {f} in MongoDB document: {saved_doc}"
        print(f"  [OK] Field '{f}': {saved_doc[f]}")

    print(f"  [OK] Rendered rx_line in DB: '{saved_doc['rx_line']}'")
    client.close()
    print("--> P11 PASS")

    print("\n" + "=" * 60)
    print("ALL VERIFICATIONS (P8, P9, P10, P11) COMPLETED AND PASSED!")
    print("=" * 60)

if __name__ == "__main__":
    verify()
