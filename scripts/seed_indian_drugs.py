#!/usr/bin/env python3
"""
scripts/seed_indian_drugs.py — Seed 40 Curated Indian Medicines into MongoDB drug_catalog
Schema:
{
  brand: str,
  form: ("Tab." | "Cap." | "Inj." | "Syp." | "Oint." | "Drops" | "Susp."),
  salts: [ { name: str, strength_value: float, strength_unit: str } ],
  manufacturer: str,
  mrp_inr: float,
  mrp_label: "reference MRP (snapshot)",
  pack: str,
  drug_classes: [str, ...],
  route_default: ("Oral" | "IV" | "IM" | "SC" | "Topical" | "Inhalation")
}
Creates text indexes on brand and salts.name.
"""

import sys
import os
from pymongo import MongoClient, TEXT

# UTF-8 stdout
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

MONGO_URI = os.getenv("MONGO_URI", "mongodb://vsadmin:vspass2024@localhost:27017/vitalstream?authSource=admin")
DB_NAME = os.getenv("MONGO_DB", "vitalstream")

DRUGS_SEED = [
    # 1. Augmentin 625 Duo
    {
        "brand": "Augmentin 625 Duo",
        "form": "Tab.",
        "salts": [
            {"name": "amoxicillin", "strength_value": 500.0, "strength_unit": "mg"},
            {"name": "clavulanic acid", "strength_value": 125.0, "strength_unit": "mg"}
        ],
        "manufacturer": "GlaxoSmithKline Pharmaceuticals Ltd",
        "mrp_inr": 204.50,
        "mrp_label": "reference MRP (snapshot)",
        "pack": "10 Tablets",
        "drug_classes": ["penicillin", "beta_lactamase_inhibitor"],
        "route_default": "Oral"
    },
    # 2. Augmentin 1000 Duo
    {
        "brand": "Augmentin 1000 Duo",
        "form": "Tab.",
        "salts": [
            {"name": "amoxicillin", "strength_value": 875.0, "strength_unit": "mg"},
            {"name": "clavulanic acid", "strength_value": 125.0, "strength_unit": "mg"}
        ],
        "manufacturer": "GlaxoSmithKline Pharmaceuticals Ltd",
        "mrp_inr": 298.00,
        "mrp_label": "reference MRP (snapshot)",
        "pack": "10 Tablets",
        "drug_classes": ["penicillin", "beta_lactamase_inhibitor"],
        "route_default": "Oral"
    },
    # 3. Augmentin 1.2g Inj
    {
        "brand": "Augmentin 1.2g Inj",
        "form": "Inj.",
        "salts": [
            {"name": "amoxicillin", "strength_value": 1000.0, "strength_unit": "mg"},
            {"name": "clavulanic acid", "strength_value": 200.0, "strength_unit": "mg"}
        ],
        "manufacturer": "GlaxoSmithKline Pharmaceuticals Ltd",
        "mrp_inr": 145.20,
        "mrp_label": "reference MRP (snapshot)",
        "pack": "1 Vial",
        "drug_classes": ["penicillin", "beta_lactamase_inhibitor"],
        "route_default": "IV"
    },
    # 4. Dolo 650
    {
        "brand": "Dolo 650",
        "form": "Tab.",
        "salts": [
            {"name": "paracetamol", "strength_value": 650.0, "strength_unit": "mg"}
        ],
        "manufacturer": "Micro Labs Ltd",
        "mrp_inr": 34.00,
        "mrp_label": "reference MRP (snapshot)",
        "pack": "15 Tablets",
        "drug_classes": ["analgesic", "antipyretic"],
        "route_default": "Oral"
    },
    # 5. Combiflam
    {
        "brand": "Combiflam",
        "form": "Tab.",
        "salts": [
            {"name": "ibuprofen", "strength_value": 400.0, "strength_unit": "mg"},
            {"name": "paracetamol", "strength_value": 325.0, "strength_unit": "mg"}
        ],
        "manufacturer": "Sanofi India Ltd",
        "mrp_inr": 48.50,
        "mrp_label": "reference MRP (snapshot)",
        "pack": "20 Tablets",
        "drug_classes": ["nsaid", "analgesic"],
        "route_default": "Oral"
    },
    # 6. Pan 40
    {
        "brand": "Pan 40",
        "form": "Tab.",
        "salts": [
            {"name": "pantoprazole", "strength_value": 40.0, "strength_unit": "mg"}
        ],
        "manufacturer": "Alkem Laboratories Ltd",
        "mrp_inr": 155.00,
        "mrp_label": "reference MRP (snapshot)",
        "pack": "15 Tablets",
        "drug_classes": ["ppi"],
        "route_default": "Oral"
    },
    # 7. Pan D
    {
        "brand": "Pan D",
        "form": "Cap.",
        "salts": [
            {"name": "pantoprazole", "strength_value": 40.0, "strength_unit": "mg"},
            {"name": "domperidone", "strength_value": 30.0, "strength_unit": "mg"}
        ],
        "manufacturer": "Alkem Laboratories Ltd",
        "mrp_inr": 199.00,
        "mrp_label": "reference MRP (snapshot)",
        "pack": "15 Capsules",
        "drug_classes": ["ppi", "antiemetic"],
        "route_default": "Oral"
    },
    # 8. Pantocid 40
    {
        "brand": "Pantocid 40",
        "form": "Tab.",
        "salts": [
            {"name": "pantoprazole", "strength_value": 40.0, "strength_unit": "mg"}
        ],
        "manufacturer": "Sun Pharmaceutical Industries Ltd",
        "mrp_inr": 160.00,
        "mrp_label": "reference MRP (snapshot)",
        "pack": "15 Tablets",
        "drug_classes": ["ppi"],
        "route_default": "Oral"
    },
    # 9. Pantocid 40 Inj
    {
        "brand": "Pantocid 40 Inj",
        "form": "Inj.",
        "salts": [
            {"name": "pantoprazole", "strength_value": 40.0, "strength_unit": "mg"}
        ],
        "manufacturer": "Sun Pharmaceutical Industries Ltd",
        "mrp_inr": 54.00,
        "mrp_label": "reference MRP (snapshot)",
        "pack": "1 Vial",
        "drug_classes": ["ppi"],
        "route_default": "IV"
    },
    # 10. Taxim-O 200
    {
        "brand": "Taxim-O 200",
        "form": "Tab.",
        "salts": [
            {"name": "cefixime", "strength_value": 200.0, "strength_unit": "mg"}
        ],
        "manufacturer": "Alkem Laboratories Ltd",
        "mrp_inr": 172.00,
        "mrp_label": "reference MRP (snapshot)",
        "pack": "10 Tablets",
        "drug_classes": ["cephalosporin"],
        "route_default": "Oral"
    },
    # 11. Zerodol-SP
    {
        "brand": "Zerodol-SP",
        "form": "Tab.",
        "salts": [
            {"name": "aceclofenac", "strength_value": 100.0, "strength_unit": "mg"},
            {"name": "paracetamol", "strength_value": 325.0, "strength_unit": "mg"},
            {"name": "serratiopeptidase", "strength_value": 15.0, "strength_unit": "mg"}
        ],
        "manufacturer": "Ipca Laboratories Ltd",
        "mrp_inr": 115.00,
        "mrp_label": "reference MRP (snapshot)",
        "pack": "10 Tablets",
        "drug_classes": ["nsaid", "analgesic"],
        "route_default": "Oral"
    },
    # 12. Zerodol-P
    {
        "brand": "Zerodol-P",
        "form": "Tab.",
        "salts": [
            {"name": "aceclofenac", "strength_value": 100.0, "strength_unit": "mg"},
            {"name": "paracetamol", "strength_value": 325.0, "strength_unit": "mg"}
        ],
        "manufacturer": "Ipca Laboratories Ltd",
        "mrp_inr": 68.00,
        "mrp_label": "reference MRP (snapshot)",
        "pack": "10 Tablets",
        "drug_classes": ["nsaid", "analgesic"],
        "route_default": "Oral"
    },
    # 13. Voveran 50
    {
        "brand": "Voveran 50",
        "form": "Tab.",
        "salts": [
            {"name": "diclofenac", "strength_value": 50.0, "strength_unit": "mg"}
        ],
        "manufacturer": "Novartis India Ltd",
        "mrp_inr": 82.00,
        "mrp_label": "reference MRP (snapshot)",
        "pack": "15 Tablets",
        "drug_classes": ["nsaid"],
        "route_default": "Oral"
    },
    # 14. Voveran SR 100
    {
        "brand": "Voveran SR 100",
        "form": "Tab.",
        "salts": [
            {"name": "diclofenac", "strength_value": 100.0, "strength_unit": "mg"}
        ],
        "manufacturer": "Novartis India Ltd",
        "mrp_inr": 140.00,
        "mrp_label": "reference MRP (snapshot)",
        "pack": "15 Tablets",
        "drug_classes": ["nsaid"],
        "route_default": "Oral"
    },
    # 15. Voveran 1ml Inj
    {
        "brand": "Voveran 1ml Inj",
        "form": "Inj.",
        "salts": [
            {"name": "diclofenac", "strength_value": 75.0, "strength_unit": "mg"}
        ],
        "manufacturer": "Novartis India Ltd",
        "mrp_inr": 28.50,
        "mrp_label": "reference MRP (snapshot)",
        "pack": "1 Ampoule",
        "drug_classes": ["nsaid"],
        "route_default": "IM"
    },
    # 16. Monocef 1g Inj
    {
        "brand": "Monocef 1g Inj",
        "form": "Inj.",
        "salts": [
            {"name": "ceftriaxone", "strength_value": 1000.0, "strength_unit": "mg"}
        ],
        "manufacturer": "Aristo Pharmaceuticals Pvt Ltd",
        "mrp_inr": 62.00,
        "mrp_label": "reference MRP (snapshot)",
        "pack": "1 Vial",
        "drug_classes": ["cephalosporin"],
        "route_default": "IV"
    },
    # 17. Monocef 500mg Inj
    {
        "brand": "Monocef 500mg Inj",
        "form": "Inj.",
        "salts": [
            {"name": "ceftriaxone", "strength_value": 500.0, "strength_unit": "mg"}
        ],
        "manufacturer": "Aristo Pharmaceuticals Pvt Ltd",
        "mrp_inr": 48.00,
        "mrp_label": "reference MRP (snapshot)",
        "pack": "1 Vial",
        "drug_classes": ["cephalosporin"],
        "route_default": "IV"
    },
    # 18. Azithral 500
    {
        "brand": "Azithral 500",
        "form": "Tab.",
        "salts": [
            {"name": "azithromycin", "strength_value": 500.0, "strength_unit": "mg"}
        ],
        "manufacturer": "Alembic Pharmaceuticals Ltd",
        "mrp_inr": 132.00,
        "mrp_label": "reference MRP (snapshot)",
        "pack": "5 Tablets",
        "drug_classes": ["macrolide"],
        "route_default": "Oral"
    },
    # 19. Ecosprin 75
    {
        "brand": "Ecosprin 75",
        "form": "Tab.",
        "salts": [
            {"name": "aspirin", "strength_value": 75.0, "strength_unit": "mg"}
        ],
        "manufacturer": "USV Pvt Ltd",
        "mrp_inr": 5.80,
        "mrp_label": "reference MRP (snapshot)",
        "pack": "14 Tablets",
        "drug_classes": ["aspirin", "nsaid", "salicylate", "antiplatelet"],
        "route_default": "Oral"
    },
    # 20. Ecosprin 150
    {
        "brand": "Ecosprin 150",
        "form": "Tab.",
        "salts": [
            {"name": "aspirin", "strength_value": 150.0, "strength_unit": "mg"}
        ],
        "manufacturer": "USV Pvt Ltd",
        "mrp_inr": 9.20,
        "mrp_label": "reference MRP (snapshot)",
        "pack": "14 Tablets",
        "drug_classes": ["aspirin", "nsaid", "salicylate", "antiplatelet"],
        "route_default": "Oral"
    },
    # 21. Calpol 500
    {
        "brand": "Calpol 500",
        "form": "Tab.",
        "salts": [
            {"name": "paracetamol", "strength_value": 500.0, "strength_unit": "mg"}
        ],
        "manufacturer": "GlaxoSmithKline Pharmaceuticals Ltd",
        "mrp_inr": 18.50,
        "mrp_label": "reference MRP (snapshot)",
        "pack": "15 Tablets",
        "drug_classes": ["analgesic", "antipyretic"],
        "route_default": "Oral"
    },
    # 22. Calpol 650
    {
        "brand": "Calpol 650",
        "form": "Tab.",
        "salts": [
            {"name": "paracetamol", "strength_value": 650.0, "strength_unit": "mg"}
        ],
        "manufacturer": "GlaxoSmithKline Pharmaceuticals Ltd",
        "mrp_inr": 31.00,
        "mrp_label": "reference MRP (snapshot)",
        "pack": "15 Tablets",
        "drug_classes": ["analgesic", "antipyretic"],
        "route_default": "Oral"
    },
    # 23. Cefazolin 1g Inj
    {
        "brand": "Cefazolin 1g Inj",
        "form": "Inj.",
        "salts": [
            {"name": "cefazolin", "strength_value": 1.0, "strength_unit": "g"}
        ],
        "manufacturer": "Cipla Ltd",
        "mrp_inr": 95.00,
        "mrp_label": "reference MRP (snapshot)",
        "pack": "1 Vial",
        "drug_classes": ["cephalosporin"],
        "route_default": "IV"
    },
    # 24. Cefazolin 500mg Inj
    {
        "brand": "Cefazolin 500mg Inj",
        "form": "Inj.",
        "salts": [
            {"name": "cefazolin", "strength_value": 500.0, "strength_unit": "mg"}
        ],
        "manufacturer": "Cipla Ltd",
        "mrp_inr": 58.00,
        "mrp_label": "reference MRP (snapshot)",
        "pack": "1 Vial",
        "drug_classes": ["cephalosporin"],
        "route_default": "IV"
    },
    # 25. Moxikind-CV 625
    {
        "brand": "Moxikind-CV 625",
        "form": "Tab.",
        "salts": [
            {"name": "amoxicillin", "strength_value": 500.0, "strength_unit": "mg"},
            {"name": "clavulanic acid", "strength_value": 125.0, "strength_unit": "mg"}
        ],
        "manufacturer": "Mankind Pharma Ltd",
        "mrp_inr": 182.00,
        "mrp_label": "reference MRP (snapshot)",
        "pack": "10 Tablets",
        "drug_classes": ["penicillin", "beta_lactamase_inhibitor"],
        "route_default": "Oral"
    },
    # 26. Meftal-Spas
    {
        "brand": "Meftal-Spas",
        "form": "Tab.",
        "salts": [
            {"name": "mefenamic acid", "strength_value": 250.0, "strength_unit": "mg"},
            {"name": "dicyclomine", "strength_value": 10.0, "strength_unit": "mg"}
        ],
        "manufacturer": "Blue Cross Laboratories Ltd",
        "mrp_inr": 50.00,
        "mrp_label": "reference MRP (snapshot)",
        "pack": "10 Tablets",
        "drug_classes": ["nsaid", "antispasmodic"],
        "route_default": "Oral"
    },
    # 27. Brufen 400
    {
        "brand": "Brufen 400",
        "form": "Tab.",
        "salts": [
            {"name": "ibuprofen", "strength_value": 400.0, "strength_unit": "mg"}
        ],
        "manufacturer": "Abbott India Ltd",
        "mrp_inr": 17.50,
        "mrp_label": "reference MRP (snapshot)",
        "pack": "15 Tablets",
        "drug_classes": ["nsaid"],
        "route_default": "Oral"
    },
    # 28. Omez 20
    {
        "brand": "Omez 20",
        "form": "Cap.",
        "salts": [
            {"name": "omeprazole", "strength_value": 20.0, "strength_unit": "mg"}
        ],
        "manufacturer": "Dr. Reddy's Laboratories Ltd",
        "mrp_inr": 62.00,
        "mrp_label": "reference MRP (snapshot)",
        "pack": "20 Capsules",
        "drug_classes": ["ppi"],
        "route_default": "Oral"
    },
    # 29. Rantac 150
    {
        "brand": "Rantac 150",
        "form": "Tab.",
        "salts": [
            {"name": "ranitidine", "strength_value": 150.0, "strength_unit": "mg"}
        ],
        "manufacturer": "JB Chemicals and Pharmaceuticals Ltd",
        "mrp_inr": 38.00,
        "mrp_label": "reference MRP (snapshot)",
        "pack": "30 Tablets",
        "drug_classes": ["h2_blocker"],
        "route_default": "Oral"
    },
    # 30. Rantac Inj
    {
        "brand": "Rantac Inj",
        "form": "Inj.",
        "salts": [
            {"name": "ranitidine", "strength_value": 50.0, "strength_unit": "mg"}
        ],
        "manufacturer": "JB Chemicals and Pharmaceuticals Ltd",
        "mrp_inr": 12.00,
        "mrp_label": "reference MRP (snapshot)",
        "pack": "2 ml Ampoule",
        "drug_classes": ["h2_blocker"],
        "route_default": "IV"
    },
    # 31. Emeset 4
    {
        "brand": "Emeset 4",
        "form": "Tab.",
        "salts": [
            {"name": "ondansetron", "strength_value": 4.0, "strength_unit": "mg"}
        ],
        "manufacturer": "Cipla Ltd",
        "mrp_inr": 54.00,
        "mrp_label": "reference MRP (snapshot)",
        "pack": "10 Tablets",
        "drug_classes": ["antiemetic"],
        "route_default": "Oral"
    },
    # 32. Emeset 2ml Inj
    {
        "brand": "Emeset 2ml Inj",
        "form": "Inj.",
        "salts": [
            {"name": "ondansetron", "strength_value": 4.0, "strength_unit": "mg"}
        ],
        "manufacturer": "Cipla Ltd",
        "mrp_inr": 14.50,
        "mrp_label": "reference MRP (snapshot)",
        "pack": "1 Ampoule",
        "drug_classes": ["antiemetic"],
        "route_default": "IV"
    },
    # 33. Tramazac 50
    {
        "brand": "Tramazac 50",
        "form": "Cap.",
        "salts": [
            {"name": "tramadol", "strength_value": 50.0, "strength_unit": "mg"}
        ],
        "manufacturer": "Zydus Lifesciences Ltd",
        "mrp_inr": 72.00,
        "mrp_label": "reference MRP (snapshot)",
        "pack": "10 Capsules",
        "drug_classes": ["opioid"],
        "route_default": "Oral"
    },
    # 34. Tramazac 2ml Inj
    {
        "brand": "Tramazac 2ml Inj",
        "form": "Inj.",
        "salts": [
            {"name": "tramadol", "strength_value": 100.0, "strength_unit": "mg"}
        ],
        "manufacturer": "Zydus Lifesciences Ltd",
        "mrp_inr": 26.00,
        "mrp_label": "reference MRP (snapshot)",
        "pack": "1 Ampoule",
        "drug_classes": ["opioid"],
        "route_default": "IV"
    },
    # 35. Pipzo 4.5g Inj
    {
        "brand": "Pipzo 4.5g Inj",
        "form": "Inj.",
        "salts": [
            {"name": "piperacillin", "strength_value": 4000.0, "strength_unit": "mg"},
            {"name": "tazobactam", "strength_value": 500.0, "strength_unit": "mg"}
        ],
        "manufacturer": "Sun Pharmaceutical Industries Ltd",
        "mrp_inr": 485.00,
        "mrp_label": "reference MRP (snapshot)",
        "pack": "1 Vial",
        "drug_classes": ["penicillin", "beta_lactamase_inhibitor"],
        "route_default": "IV"
    },
    # 36. Magnex 1.5g Inj
    {
        "brand": "Magnex 1.5g Inj",
        "form": "Inj.",
        "salts": [
            {"name": "cefoperazone", "strength_value": 1000.0, "strength_unit": "mg"},
            {"name": "sulbactam", "strength_value": 500.0, "strength_unit": "mg"}
        ],
        "manufacturer": "Pfizer Ltd",
        "mrp_inr": 420.00,
        "mrp_label": "reference MRP (snapshot)",
        "pack": "1 Vial",
        "drug_classes": ["cephalosporin", "beta_lactamase_inhibitor"],
        "route_default": "IV"
    },
    # 37. Meronem 1g Inj
    {
        "brand": "Meronem 1g Inj",
        "form": "Inj.",
        "salts": [
            {"name": "meropenem", "strength_value": 1.0, "strength_unit": "g"}
        ],
        "manufacturer": "Pfizer Ltd",
        "mrp_inr": 2450.00,
        "mrp_label": "reference MRP (snapshot)",
        "pack": "1 Vial",
        "drug_classes": ["carbapenem"],
        "route_default": "IV"
    },
    # 38. Ciplox 500
    {
        "brand": "Ciplox 500",
        "form": "Tab.",
        "salts": [
            {"name": "ciprofloxacin", "strength_value": 500.0, "strength_unit": "mg"}
        ],
        "manufacturer": "Cipla Ltd",
        "mrp_inr": 42.00,
        "mrp_label": "reference MRP (snapshot)",
        "pack": "10 Tablets",
        "drug_classes": ["fluoroquinolone"],
        "route_default": "Oral"
    },
    # 39. Levomac 500
    {
        "brand": "Levomac 500",
        "form": "Tab.",
        "salts": [
            {"name": "levofloxacin", "strength_value": 500.0, "strength_unit": "mg"}
        ],
        "manufacturer": "Macleods Pharmaceuticals Ltd",
        "mrp_inr": 98.00,
        "mrp_label": "reference MRP (snapshot)",
        "pack": "10 Tablets",
        "drug_classes": ["fluoroquinolone"],
        "route_default": "Oral"
    },
    # 40. Sporidex 500
    {
        "brand": "Sporidex 500",
        "form": "Cap.",
        "salts": [
            {"name": "cephalexin", "strength_value": 500.0, "strength_unit": "mg"}
        ],
        "manufacturer": "Sun Pharmaceutical Industries Ltd",
        "mrp_inr": 210.00,
        "mrp_label": "reference MRP (snapshot)",
        "pack": "10 Capsules",
        "drug_classes": ["cephalosporin"],
        "route_default": "Oral"
    },
    # 41. Flagyl 400
    {
        "brand": "Flagyl 400",
        "form": "Tab.",
        "salts": [
            {"name": "metronidazole", "strength_value": 400.0, "strength_unit": "mg"}
        ],
        "manufacturer": "Abbott India Ltd",
        "mrp_inr": 24.50,
        "mrp_label": "reference MRP (snapshot)",
        "pack": "15 Tablets",
        "drug_classes": ["nitroimidazole"],
        "route_default": "Oral"
    },
    # 42. Avomine 25
    {
        "brand": "Avomine 25",
        "form": "Tab.",
        "salts": [
            {"name": "promethazine", "strength_value": 25.0, "strength_unit": "mg"}
        ],
        "manufacturer": "Abbott India Ltd",
        "mrp_inr": 53.00,
        "mrp_label": "reference MRP (snapshot)",
        "pack": "10 Tablets",
        "drug_classes": ["antihistamine", "antiemetic"],
        "route_default": "Oral"
    }
]

def seed_drug_catalog():
    print(f"Connecting to MongoDB at {MONGO_URI}...")
    client = MongoClient(MONGO_URI)
    db = client[DB_NAME]
    catalog = db["drug_catalog"]

    print(f"Dropping previous drug_catalog collection if any...")
    catalog.drop()

    print(f"Inserting {len(DRUGS_SEED)} Indian medicines into 'drug_catalog'...")
    res = catalog.insert_many(DRUGS_SEED)
    print(f"  [OK] Successfully inserted {len(res.inserted_ids)} records.")

    print(f"Creating compound text index on 'brand' and 'salts.name'...")
    catalog.create_index([("brand", TEXT), ("salts.name", TEXT)], name="brand_salts_text_idx")
    catalog.create_index([("brand", 1)])
    catalog.create_index([("salts.name", 1)])
    print("  [OK] Text and field indexes created.")

    client.close()
    print("Seed complete.")

if __name__ == "__main__":
    seed_drug_catalog()
