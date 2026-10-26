"""
VitalStream — Pharmacological Allergy & Cross-Reactivity Engine
Resolves brand -> all salts in combination -> drug classes.
Evaluates against patient allergies producing 3 outcomes:
- BLOCK: Same class (e.g. Augmentin has amoxicillin -> penicillin)
- CAUTION (clinician review): Known cross-reactive class (e.g. cephalosporins for penicillin allergy)
- CLEARED: No overlap
"""

import re
from typing import Dict, List, Any, Optional

ALLERGY_CLASS_RULES = {
    "penicillin": {
        "label": "Penicillin",
        "blocked_classes": ["penicillin"],
        "caution_classes": ["cephalosporin", "carbapenem"],
        "blocked_drugs_desc": "Blocks Amoxicillin, Ampicillin, Piperacillin, and combinations (Augmentin, Moxikind-CV, Pipzo).",
        "caution_drugs_desc": "Caution for Cephalosporins (Cefazolin, Ceftriaxone, Cefixime) & Carbapenems (Meronem).",
    },
    "aspirin": {
        "label": "Aspirin & NSAIDs",
        "blocked_classes": ["aspirin", "nsaid", "salicylate"],
        "caution_classes": [],
        "blocked_drugs_desc": "Blocks Aspirin (Ecosprin), Ibuprofen (Combiflam, Brufen), Aceclofenac (Zerodol), Diclofenac (Voveran), Mefenamic Acid (Meftal).",
        "caution_drugs_desc": "Review required for other non-steroidal anti-inflammatory agents.",
    },
    "sulfa": {
        "label": "Sulfa / Sulfonamide",
        "blocked_classes": ["sulfa", "sulfonamide"],
        "caution_classes": [],
        "blocked_drugs_desc": "Blocks Sulfamethoxazole, Bactrim, Septran.",
        "caution_drugs_desc": "",
    },
    "codeine": {
        "label": "Codeine & Opioids",
        "blocked_classes": ["codeine", "opioid"],
        "caution_classes": [],
        "blocked_drugs_desc": "Blocks Codeine, Morphine, Tramadol (Tramazac), Hydrocodone, Oxycodone.",
        "caution_drugs_desc": "",
    },
    "latex": {
        "label": "Latex Contact",
        "blocked_classes": [],
        "caution_classes": [],
        "blocked_drugs_desc": "Medical equipment / surgical glove precaution — no direct pharmacologic drug blocks.",
        "caution_drugs_desc": "",
    },
    "contrast": {
        "label": "Iodine / Contrast",
        "blocked_classes": ["contrast", "iodine"],
        "caution_classes": [],
        "blocked_drugs_desc": "Blocks iodinated radiopaque contrast agents & povidone-iodine.",
        "caution_drugs_desc": "",
    },
}

GENERIC_SALT_MAP: Dict[str, List[str]] = {
    "amoxicillin": ["penicillin"],
    "ampicillin": ["penicillin"],
    "piperacillin": ["penicillin"],
    "clavulanic acid": ["beta_lactamase_inhibitor"],
    "tazobactam": ["beta_lactamase_inhibitor"],
    "sulbactam": ["beta_lactamase_inhibitor"],
    "ibuprofen": ["nsaid"],
    "aspirin": ["aspirin", "nsaid", "salicylate"],
    "aceclofenac": ["nsaid"],
    "diclofenac": ["nsaid"],
    "mefenamic acid": ["nsaid"],
    "paracetamol": ["analgesic", "antipyretic"],
    "cefazolin": ["cephalosporin"],
    "ceftriaxone": ["cephalosporin"],
    "cefixime": ["cephalosporin"],
    "cephalexin": ["cephalosporin"],
    "cefoperazone": ["cephalosporin"],
    "meropenem": ["carbapenem"],
    "tramadol": ["opioid"],
    "morphine": ["opioid"],
    "pantoprazole": ["ppi"],
    "omeprazole": ["ppi"],
    "ranitidine": ["h2_blocker"],
    "ondansetron": ["antiemetic"],
    "domperidone": ["antiemetic"],
    "azithromycin": ["macrolide"],
    "ciprofloxacin": ["fluoroquinolone"],
    "levofloxacin": ["fluoroquinolone"],
    "metronidazole": ["nitroimidazole"],
    "promethazine": ["antihistamine", "antiemetic"],
}


async def resolve_drug_info(medication_name: str, db=None) -> Dict[str, Any]:
    """
    Resolves drug from MongoDB drug_catalog, or falls back to generic salt knowledge base.
    """
    med_clean = (medication_name or "").strip()
    if not med_clean:
        return {"brand": "", "salts": [], "drug_classes": [], "form": "Tab."}

    if db is not None:
        try:
            # 1. Exact or case-insensitive brand match
            drug = await db.drug_catalog.find_one(
                {"brand": {"$regex": f"^{re.escape(med_clean)}$", "$options": "i"}},
                {"_id": 0}
            )
            if not drug:
                # 2. Prefix brand match (e.g. 'Augmentin' -> 'Augmentin 625 Duo')
                drug = await db.drug_catalog.find_one(
                    {"brand": {"$regex": f"^{re.escape(med_clean)}", "$options": "i"}},
                    {"_id": 0}
                )
            if not drug:
                # 3. Salt name match
                drug = await db.drug_catalog.find_one(
                    {"salts.name": {"$regex": f"^{re.escape(med_clean)}$", "$options": "i"}},
                    {"_id": 0}
                )
            if drug:
                return drug
        except Exception:
            pass

    # Fallback to local generic mapping
    med_lower = med_clean.lower()
    matched_classes = set()
    matched_salts = []

    for salt, classes in GENERIC_SALT_MAP.items():
        if salt in med_lower or med_lower in salt:
            matched_classes.update(classes)
            matched_salts.append({"name": salt, "strength_value": 500.0, "strength_unit": "mg"})

    if not matched_classes and "cef" in med_lower:
        matched_classes.add("cephalosporin")
        matched_salts.append({"name": med_lower, "strength_value": 1.0, "strength_unit": "g"})

    return {
        "brand": med_clean,
        "form": "Inj." if ("inj" in med_lower or "cefazolin" in med_lower) else "Tab.",
        "salts": matched_salts or [{"name": med_lower, "strength_value": 500.0, "strength_unit": "mg"}],
        "drug_classes": list(matched_classes),
        "route_default": "IV" if ("inj" in med_lower or "cefazolin" in med_lower) else "Oral",
    }


async def evaluate_allergy_safety(
    medication_name: str,
    patient_allergies: List[str],
    db=None
) -> Dict[str, Any]:
    """
    Evaluates medication against patient allergies.
    Returns:
    {
        "outcome": "BLOCK" | "CAUTION" | "CLEARED",
        "reason": str,
        "drug": dict,
        "blocking_allergy": str | None,
        "caution_allergy": str | None,
        "matched_classes": List[str]
    }
    """
    drug_info = await resolve_drug_info(medication_name, db)
    drug_classes = [c.lower() for c in drug_info.get("drug_classes", [])]
    salts = drug_info.get("salts", [])
    brand = drug_info.get("brand", medication_name)

    # If drug_classes was empty, try salt names
    if not drug_classes:
        for s in salts:
            s_name = s.get("name", "").lower()
            if s_name in GENERIC_SALT_MAP:
                drug_classes.extend(GENERIC_SALT_MAP[s_name])
            elif "cef" in s_name:
                drug_classes.append("cephalosporin")

    patient_allergy_set = [a.lower().strip() for a in patient_allergies or []]

    # 1. Check direct BLOCK (Same class)
    for p_all in patient_allergy_set:
        rule = ALLERGY_CLASS_RULES.get(p_all)
        if not rule:
            # Fallback direct name match
            if any(p_all in c for c in drug_classes) or any(p_all in s.get("name", "").lower() for s in salts):
                return {
                    "outcome": "BLOCK",
                    "reason": f"ORDER BLOCKED — Patient has documented {p_all.capitalize()} allergy. {brand} is in the same pharmacological class.",
                    "drug": drug_info,
                    "blocking_allergy": p_all,
                    "caution_allergy": None,
                    "matched_classes": drug_classes,
                }
            continue

        for blocked_cls in rule["blocked_classes"]:
            if blocked_cls in drug_classes:
                # Find which salt triggered it
                trigger_salt = next((s["name"].capitalize() for s in salts if blocked_cls in GENERIC_SALT_MAP.get(s["name"].lower(), []) or blocked_cls in s["name"].lower()), brand)
                return {
                    "outcome": "BLOCK",
                    "reason": f"ORDER BLOCKED — Patient is allergic to {rule['label']}. {brand} contains {trigger_salt} ({blocked_cls.upper()} class).",
                    "drug": drug_info,
                    "blocking_allergy": p_all,
                    "caution_allergy": None,
                    "matched_classes": drug_classes,
                }

    # 2. Check cross-reactive CAUTION (Clinician review)
    for p_all in patient_allergy_set:
        rule = ALLERGY_CLASS_RULES.get(p_all)
        if not rule:
            continue

        for caution_cls in rule["caution_classes"]:
            if caution_cls in drug_classes:
                trigger_salt = next((s["name"].capitalize() for s in salts if caution_cls in GENERIC_SALT_MAP.get(s["name"].lower(), []) or caution_cls in s["name"].lower()), brand)
                return {
                    "outcome": "CAUTION",
                    "reason": f"CAUTION (Clinician Review) — Patient has documented {rule['label']} allergy. {brand} contains {trigger_salt} ({caution_cls.upper()} class) with known cross-reactivity.",
                    "drug": drug_info,
                    "blocking_allergy": None,
                    "caution_allergy": p_all,
                    "matched_classes": drug_classes,
                }

    # 3. CLEARED (No overlap)
    salts_summary = " + ".join(f"{s['name'].capitalize()} {s.get('strength_value', '')}{s.get('strength_unit', '')}" for s in salts) if salts else brand
    return {
        "outcome": "CLEARED",
        "reason": f"Allergy check cleared. No contraindications detected for {brand} ({salts_summary}) against patient allergies.",
        "drug": drug_info,
        "blocking_allergy": None,
        "caution_allergy": None,
        "matched_classes": drug_classes,
    }
