import { useState, useEffect, useMemo } from 'react'
import {
  Pill,
  ShieldAlert,
  CheckCircle2,
  AlertOctagon,
  AlertTriangle,
  Stethoscope,
  Search,
  Sparkles,
  Calendar,
  Clock,
  DollarSign,
  ChevronDown
} from 'lucide-react'
import { useToast } from '../context/ToastContext'
import { useCases } from '../context/CasesContext'

const PRESET_PATIENTS = [
  { id: 'vdb-patient-101', name: 'Sunita Verma', age: 62, orId: 'OR-1', caseId: 'CASE-001', allergies: ['penicillin', 'aspirin'] },
  { id: 'vdb-patient-102', name: 'Rajesh Malhotra', age: 48, orId: 'OR-2', caseId: 'CASE-002', allergies: ['sulfa'] },
  { id: 'vdb-patient-103', name: 'Pooja Iyer', age: 34, orId: 'OR-3', caseId: 'CASE-003', allergies: ['latex'] },
  { id: 'vdb-patient-104', name: 'Ramesh Patel', age: 71, orId: 'OR-4', caseId: 'CASE-004', allergies: ['contrast'] },
  { id: 'vdb-patient-105', name: 'Priyanka Desai', age: 29, orId: 'OR-5', caseId: 'CASE-005', allergies: [] },
  { id: 'vdb-patient-106', name: 'Vikram Nair', age: 55, orId: 'OR-6', caseId: 'CASE-006', allergies: ['codeine'] },
]

const QUICK_INDIAN_DRUGS = [
  { brand: 'Augmentin 625 Duo', form: 'Tab.', composition: 'Amoxicillin 500mg + Clavulanic 125mg', route: 'Oral', defaultDose: 1, unit: 'Tab', freq: 'BD', pattern: '1-0-1', timing: 'after food', days: 5, mrp: 204.0 },
  { brand: 'Combiflam', form: 'Tab.', composition: 'Ibuprofen 400mg + Paracetamol 325mg', route: 'Oral', defaultDose: 1, unit: 'Tab', freq: 'BD', pattern: '1-0-1', timing: 'after food', days: 3, mrp: 46.5 },
  { brand: 'Pan 40', form: 'Tab.', composition: 'Pantoprazole 40mg', route: 'Oral', defaultDose: 40, unit: 'mg', freq: 'OD', pattern: '1-0-0', timing: 'before food', days: 7, mrp: 155.0 },
  { brand: 'Cefazolin 1g Inj', form: 'Inj.', composition: 'Cefazolin 1000mg', route: 'IV', defaultDose: 1, unit: 'g', freq: 'STAT', pattern: 'STAT', timing: 'after food', days: 1, mrp: 78.5 },
  { brand: 'Ecosprin 75', form: 'Tab.', composition: 'Aspirin 75mg', route: 'Oral', defaultDose: 75, unit: 'mg', freq: 'OD', pattern: '1-0-0', timing: 'after food', days: 10, mrp: 9.8 },
  { brand: 'Monocef 1g Inj', form: 'Inj.', composition: 'Ceftriaxone 1000mg', route: 'IV', defaultDose: 1, unit: 'g', freq: 'BD', pattern: '1-0-1', timing: 'after food', days: 3, mrp: 64.0 },
]

const FREQUENCY_OPTIONS = [
  { code: 'BD', pattern: '1-0-1', label: 'BD (1-0-1) — Twice daily (Morning & Night)', dosesPerDay: 2 },
  { code: 'OD', pattern: '1-0-0', label: 'OD (1-0-0) — Once daily (Morning)', dosesPerDay: 1 },
  { code: 'TDS', pattern: '1-1-1', label: 'TDS (1-1-1) — Thrice daily (Morning, Noon, Night)', dosesPerDay: 3 },
  { code: 'QID', pattern: '1-1-1-1', label: 'QID (1-1-1-1) — 4 times daily', dosesPerDay: 4 },
  { code: 'HS', pattern: '0-0-1', label: 'HS (0-0-1) — At bedtime', dosesPerDay: 1 },
  { code: 'SOS', pattern: 'SOS', label: 'SOS — As needed', dosesPerDay: 1 },
  { code: 'STAT', pattern: 'STAT', label: 'STAT — Immediately once', dosesPerDay: 1 },
]

export default function MedicationConsole() {
  const { addToast } = useToast()
  const { dispatch } = useCases()

  const [selectedPatient, setSelectedPatient] = useState(PRESET_PATIENTS[0])
  const [searchQuery, setSearchQuery]         = useState('Augmentin 625 Duo')
  const [selectedDrug, setSelectedDrug]       = useState(null)
  const [searchResults, setSearchResults]     = useState([])
  const [isSearching, setIsSearching]         = useState(false)
  const [showDropdown, setShowDropdown]       = useState(false)

  // Indian Rx Form Fields
  const [formType, setFormType]               = useState('Tab.')
  const [dose, setDose]                       = useState('1')
  const [unit, setUnit]                       = useState('Tab')
  const [frequency, setFrequency]             = useState('BD')
  const [foodTiming, setFoodTiming]           = useState('after food')
  const [durationDays, setDurationDays]       = useState(5)
  const [route, setRoute]                     = useState('Oral')
  const [mrp, setMrp]                         = useState(204.0)

  // Safety & Orders state
  const [allergyCheck, setAllergyCheck]       = useState(null)
  const [isCheckingAllergy, setIsCheckingAllergy] = useState(false)
  const [loading, setLoading]                 = useState(false)
  const [lastResult, setLastResult]           = useState(null)
  const [recentOrders, setRecentOrders]       = useState([])
  const [allergyRules, setAllergyRules]       = useState({})

  // Fetch Clinical Rules once
  useEffect(() => {
    fetch('/api/orders/allergy-rules')
      .then(r => r.json())
      .then(data => setAllergyRules(data || {}))
      .catch(() => {})
  }, [])

  // Fetch Recent Orders for current case
  const fetchCaseOrders = () => {
    fetch(`/api/orders/case/${selectedPatient.caseId}`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setRecentOrders(data)
      })
      .catch(() => {})
  }

  useEffect(() => {
    fetchCaseOrders()
  }, [selectedPatient.caseId])

  // Debounced search against MongoDB drug catalog
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      return
    }
    const timer = setTimeout(() => {
      setIsSearching(true)
      fetch(`/api/drugs/search?q=${encodeURIComponent(searchQuery.trim())}`)
        .then(r => r.json())
        .then(data => {
          if (Array.isArray(data)) setSearchResults(data)
        })
        .catch(() => {})
        .finally(() => setIsSearching(false))
    }, 200)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Real-time Allergy Check whenever patient or drug changes
  useEffect(() => {
    const medName = selectedDrug?.brand || searchQuery.trim()
    if (!medName || !selectedPatient.id) {
      setAllergyCheck(null)
      return
    }

    setIsCheckingAllergy(true)
    fetch('/api/orders/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patient_id: selectedPatient.id,
        medication: medName,
        case_id: selectedPatient.caseId,
      })
    })
      .then(r => r.json())
      .then(data => {
        setAllergyCheck(data)
      })
      .catch(() => {
        setAllergyCheck(null)
      })
      .finally(() => setIsCheckingAllergy(false))
  }, [selectedPatient.id, selectedDrug, searchQuery])

  // Select Drug Helper
  function applyDrugSelection(drug) {
    setSelectedDrug(drug)
    setSearchQuery(drug.brand)
    setShowDropdown(false)

    if (drug.form) setFormType(drug.form)
    if (drug.route_default) setRoute(drug.route_default)
    else if (drug.form === 'Inj.') setRoute('IV')
    else setRoute('Oral')

    if (drug.mrp_inr) setMrp(drug.mrp_inr)

    // Calculate sensible defaults
    if (drug.form === 'Inj.') {
      setUnit('g')
      setDose('1')
      setFrequency('STAT')
      setDurationDays(1)
    } else {
      setUnit('Tab')
      setDose('1')
      setFrequency('BD')
      setDurationDays(5)
    }
  }

  // Initial load selection
  useEffect(() => {
    applyDrugSelection(QUICK_INDIAN_DRUGS[0])
  }, [])

  // Computed Quantity & Formula
  const selectedFreqMeta = useMemo(() => {
    return FREQUENCY_OPTIONS.find(f => f.code === frequency) || FREQUENCY_OPTIONS[0]
  }, [frequency])

  const computedQuantity = useMemo(() => {
    if (frequency === 'STAT' || frequency === 'SOS') return 1
    const days = Math.max(1, parseInt(durationDays) || 1)
    const perDay = selectedFreqMeta.dosesPerDay || 1
    const singleDose = Math.max(1, parseFloat(dose) || 1)
    // If unit is Tab or Cap, multiply by single dose
    return (unit === 'Tab' || unit === 'Cap') ? perDay * days * singleDose : perDay * days
  }, [frequency, durationDays, selectedFreqMeta, dose, unit])

  // Generated Indian Rx Line preview
  const previewRxLine = useMemo(() => {
    const brandName = selectedDrug?.brand || searchQuery.trim() || 'Medication'
    const patternStr = selectedFreqMeta.pattern ? ` (${selectedFreqMeta.pattern})` : ''
    const durStr = (frequency !== 'STAT' && frequency !== 'SOS') ? ` x ${durationDays} days` : ''
    const timingStr = (route === 'Oral' && frequency !== 'STAT') ? ` (${foodTiming})` : ''
    return `${formType} ${brandName} ${dose}${unit} | ${route} | ${frequency}${patternStr}${durStr}${timingStr}`
  }, [selectedDrug, searchQuery, formType, dose, unit, route, frequency, selectedFreqMeta, durationDays, foodTiming])

  // Form Submission with Idempotency
  async function handleOrderSubmit(e) {
    e.preventDefault()
    if (loading) return

    if (allergyCheck?.outcome === 'BLOCK') {
      addToast({
        type: 'error',
        title: 'Safety Contraindication Blocked',
        message: allergyCheck.reason || 'This medicine is strictly contra-indicated for this patient.',
        duration: 5000
      })
      return
    }

    setLoading(true)
    setLastResult(null)

    // Client-side idempotency UUID key to prevent double-submits
    const idempotencyKey = `idemp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    const brandName = selectedDrug?.brand || searchQuery.trim()

    // Calculate approximate dose in mg
    let doseMg = parseFloat(dose) || 500.0
    if (unit === 'g') doseMg = (parseFloat(dose) || 1.0) * 1000.0
    else if (unit === 'mcg') doseMg = (parseFloat(dose) || 500.0) / 1000.0
    else if (unit === 'Tab' && selectedDrug?.salts?.length) {
      doseMg = selectedDrug.salts.reduce((acc, s) => acc + (s.strength_value || 0), 0) || 500.0
    }

    const payload = {
      case_id: selectedPatient.caseId,
      patient_id: selectedPatient.id,
      medication: brandName,
      brand: brandName,
      salts: selectedDrug?.salts || [],
      form: formType,
      dose: parseFloat(dose) || 1.0,
      dose_mg: doseMg,
      unit: unit,
      frequency: frequency,
      pattern: selectedFreqMeta.pattern,
      food_timing: (route === 'Oral' && frequency !== 'STAT') ? foodTiming : undefined,
      duration_days: parseInt(durationDays) || 1,
      route: route,
      qty: computedQuantity,
      mrp_inr: mrp || null,
      ordered_by: 'Attending Clinician',
      rx_line: previewRxLine,
      idempotency_key: idempotencyKey
    }

    try {
      const res = await fetch('/api/orders/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey
        },
        body: JSON.stringify(payload)
      })

      const data = await res.json()

      if (!res.ok) {
        const errorMsg = data.detail || 'Medication order rejected.'
        setLastResult({ success: false, message: errorMsg })
        addToast({
          type: 'error',
          title: 'Contraindication Intercepted',
          message: errorMsg,
          duration: 6000
        })

        dispatch({
          type: 'ADD_AUDIT_LOG',
          payload: {
            id: `ORD-${Date.now().toString().slice(-4)}`,
            timestamp: new Date().toISOString(),
            action: 'ALLERGY_GUARD_INTERCEPT',
            entity: brandName,
            actor: 'Attending Clinician',
            status: 'blocked',
            detail: errorMsg
          }
        })
      } else {
        const isCaution = data.allergy_status === 'CAUTION'
        const successMsg = isCaution 
          ? `Order ${data.order_id} recorded with CAUTION: ${data.rx_line}`
          : `Order ${data.order_id} verified & cleared: ${data.rx_line}`

        setLastResult({
          success: true,
          caution: isCaution,
          message: isCaution ? (data.caution_note || successMsg) : successMsg,
          order: data
        })

        // Refresh orders from server to ensure complete consistency
        fetchCaseOrders()

        addToast({
          type: isCaution ? 'warning' : 'success',
          title: isCaution ? 'Ordered with Clinician Caution' : 'Order Approved & Saved',
          message: data.rx_line,
          duration: 4500
        })

        dispatch({
          type: 'ADD_AUDIT_LOG',
          payload: {
            id: `ORD-${Date.now().toString().slice(-4)}`,
            timestamp: new Date().toISOString(),
            action: isCaution ? 'MEDICATION_ORDER_CAUTION' : 'MEDICATION_ORDER_COMMITTED',
            entity: data.rx_line,
            actor: 'Attending Clinician',
            status: isCaution ? 'caution' : 'success',
            detail: isCaution ? data.caution_note : 'Allergy check passed without contraindications.'
          }
        })
      }
    } catch (err) {
      setLastResult({ success: false, message: 'Network error communicating with order service.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-7xl mx-auto py-6 px-6">
      
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">
          <ShieldAlert className="w-4 h-4" />
          <span>Clinical Safety & Indian Drug Formulary</span>
        </div>
        <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
          Medication & Allergy Safety Console
        </h2>
        <p className="text-xs text-slate-600 mt-1">
          Evaluates brand names against salt compositions and pharmacological classes. Prevents anaphylactic cross-reactions in real time.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Interactive Order Form (7 Cols) */}
        <div className="lg:col-span-7 space-y-5">
          <div className="app-card p-6 bg-white border border-slate-200 shadow-sm">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Pill className="w-4 h-4 text-blue-600" />
                <span>Prescription Order (Indian Standard Format)</span>
              </h3>
              <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
                ICMR / CDSCO Formulary Standard
              </span>
            </div>

            <form onSubmit={handleOrderSubmit} className="space-y-4">
              
              {/* Select Patient */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Target Patient & OR
                </label>
                <select
                  value={selectedPatient.id}
                  onChange={(e) => {
                    const p = PRESET_PATIENTS.find(x => x.id === e.target.value)
                    if (p) {
                      setSelectedPatient(p)
                      setLastResult(null)
                    }
                  }}
                  className="app-input cursor-pointer font-medium text-xs text-slate-800"
                >
                  {PRESET_PATIENTS.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.age}yo) — {p.orId} [{p.caseId}] — Allergies: {p.allergies.length ? p.allergies.join(', ') : 'None'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Patient Allergies Banner */}
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                <div>
                  <div className="font-bold text-slate-800">{selectedPatient.name}</div>
                  <div className="text-[11px] text-slate-500">Case ID: {selectedPatient.caseId} · Room: {selectedPatient.orId}</div>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap justify-end">
                  {selectedPatient.allergies.length > 0 ? (
                    selectedPatient.allergies.map(a => (
                      <span key={a} className="px-2 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-[10px] font-bold uppercase tracking-wide">
                        🚨 {a} Allergy
                      </span>
                    ))
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold">
                      ✓ No Documented Allergies
                    </span>
                  )}
                </div>
              </div>

              {/* Quick Drug Selection Chips */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Frequent Indian Hospital Formulations
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {QUICK_INDIAN_DRUGS.map(d => {
                    const isSelected = (selectedDrug?.brand || searchQuery) === d.brand
                    return (
                      <button
                        type="button"
                        key={d.brand}
                        onClick={() => applyDrugSelection(d)}
                        className={`p-2 rounded-lg text-left text-xs border transition-all ${
                          isSelected
                            ? 'border-blue-600 bg-blue-50/80 text-blue-900 shadow-xs'
                            : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                        }`}
                      >
                        <div className="font-bold truncate flex items-center justify-between">
                          <span>{d.brand}</span>
                          <span className="text-[9px] px-1 py-0.2 bg-slate-100 rounded text-slate-500 font-semibold">{d.form}</span>
                        </div>
                        <div className="text-[10px] text-slate-500 truncate mt-0.5">{d.composition}</div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Drug Autocomplete Input */}
              <div className="relative">
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Brand or Salt Autocomplete Search
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value)
                      setShowDropdown(true)
                    }}
                    onFocus={() => setShowDropdown(true)}
                    placeholder="Search brand (e.g. Augmentin, Pan 40) or salt (e.g. amoxicillin, pantoprazole)..."
                    className="app-input pl-9 pr-8 text-xs font-semibold"
                    required
                  />
                  {isSearching && (
                    <div className="absolute right-3 top-2.5 text-[10px] text-slate-400">Searching…</div>
                  )}
                </div>

                {/* Autocomplete Dropdown */}
                {showDropdown && searchResults.length > 0 && (
                  <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-60 overflow-y-auto divide-y divide-slate-100">
                    {searchResults.map(item => (
                      <button
                        type="button"
                        key={item.brand}
                        onClick={() => applyDrugSelection(item)}
                        className="w-full text-left p-2.5 hover:bg-blue-50/60 transition-colors flex items-center justify-between group"
                      >
                        <div>
                          <div className="text-xs font-bold text-slate-800 group-hover:text-blue-600 flex items-center gap-1.5">
                            <span>{item.brand}</span>
                            <span className="text-[10px] font-medium px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">{item.form || 'Tab.'}</span>
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            {item.salts?.map(s => `${s.name} ${s.strength_value}${s.strength_unit}`).join(' + ')}
                          </div>
                        </div>
                        <div className="text-right">
                          {item.mrp_inr && (
                            <div className="text-[11px] font-bold text-slate-700">₹{item.mrp_inr}</div>
                          )}
                          <div className="text-[9px] text-slate-400 uppercase">{item.route_default || 'Oral'}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* LIVE ALLERGY STATUS BANNER */}
              {allergyCheck && (
                <div className={`p-3 rounded-xl border transition-all ${
                  allergyCheck.outcome === 'BLOCK'
                    ? 'bg-rose-50 border-rose-300 text-rose-900'
                    : allergyCheck.outcome === 'CAUTION'
                    ? 'bg-amber-50 border-amber-300 text-amber-900'
                    : 'bg-emerald-50 border-emerald-300 text-emerald-900'
                }`}>
                  <div className="flex items-start gap-2.5">
                    {allergyCheck.outcome === 'BLOCK' ? (
                      <AlertOctagon className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                    ) : allergyCheck.outcome === 'CAUTION' ? (
                      <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    ) : (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    )}
                    <div className="text-xs">
                      <div className="font-extrabold flex items-center gap-2">
                        <span>
                          {allergyCheck.outcome === 'BLOCK' && '🚨 CONTRAINDICATION BLOCKED (SAME CLASS)'}
                          {allergyCheck.outcome === 'CAUTION' && '⚠️ CAUTION: CROSS-REACTIVITY (CLINICIAN REVIEW REQUIRED)'}
                          {allergyCheck.outcome === 'CLEARED' && '✓ ALLERGY CHECK PASSED (NO OVERLAP)'}
                        </span>
                      </div>
                      <p className="mt-1 leading-relaxed opacity-95">
                        {allergyCheck.reason}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Indian Prescription Fields: Form, Dose, Unit, Route */}
              <div className="grid grid-cols-4 gap-3">
                {/* Form */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Form
                  </label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value)}
                    className="app-input text-xs"
                  >
                    <option value="Tab.">Tab. (Tablet)</option>
                    <option value="Cap.">Cap. (Capsule)</option>
                    <option value="Inj.">Inj. (Injection)</option>
                    <option value="Syp.">Syp. (Syrup)</option>
                    <option value="Oint.">Oint. (Ointment)</option>
                  </select>
                </div>

                {/* Dose Value */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Strength / Dose
                  </label>
                  <input
                    type="text"
                    value={dose}
                    onChange={(e) => setDose(e.target.value)}
                    className="app-input text-xs font-semibold"
                    required
                  />
                </div>

                {/* Unit */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Unit
                  </label>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="app-input text-xs"
                  >
                    <option value="mg">mg</option>
                    <option value="g">g</option>
                    <option value="mcg">mcg</option>
                    <option value="ml">ml</option>
                    <option value="Tab">Tab</option>
                    <option value="Cap">Cap</option>
                    <option value="IU">IU</option>
                  </select>
                </div>

                {/* Route */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Route
                  </label>
                  <select
                    value={route}
                    onChange={(e) => setRoute(e.target.value)}
                    className="app-input text-xs font-semibold"
                  >
                    <option value="Oral">Oral (PO)</option>
                    <option value="IV">IV (Intravenous)</option>
                    <option value="IM">IM (Intramuscular)</option>
                    <option value="SC">SC (Subcutaneous)</option>
                    <option value="Topical">Topical</option>
                    <option value="Inhalation">Inhalation</option>
                  </select>
                </div>
              </div>

              {/* Frequency, Timing, Duration & Quantity */}
              <div className="grid grid-cols-12 gap-3">
                {/* Frequency */}
                <div className={route === 'Oral' && frequency !== 'STAT' ? 'col-span-6' : 'col-span-7'}>
                  <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Frequency (Indian Pattern)
                  </label>
                  <select
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value)}
                    className="app-input text-xs"
                  >
                    {FREQUENCY_OPTIONS.map(f => (
                      <option key={f.code} value={f.code}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Food Timing (Shown for Oral only) */}
                {route === 'Oral' && frequency !== 'STAT' && (
                  <div className="col-span-3">
                    <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Food Timing
                    </label>
                    <select
                      value={foodTiming}
                      onChange={(e) => setFoodTiming(e.target.value)}
                      className="app-input text-xs"
                    >
                      <option value="after food">After food (PC)</option>
                      <option value="before food">Before food (AC)</option>
                      <option value="with food">With food</option>
                    </select>
                  </div>
                )}

                {/* Duration */}
                <div className={route === 'Oral' && frequency !== 'STAT' ? 'col-span-3' : 'col-span-5'}>
                  <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Duration (Days)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="90"
                    value={durationDays}
                    onChange={(e) => setDurationDays(e.target.value)}
                    disabled={frequency === 'STAT'}
                    className="app-input text-xs font-semibold"
                  />
                </div>
              </div>

              {/* Prescription Line Preview & MRP Snapshot */}
              <div className="p-3 rounded-lg bg-blue-50/50 border border-blue-200/70 text-xs">
                <div className="flex items-center justify-between text-[11px] font-bold text-blue-900 mb-1">
                  <span>Prescription Line (Rendered Preview):</span>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-blue-100/80 text-blue-800 text-[10px]">
                      Total Qty: <strong>{computedQuantity}</strong> {unit === 'Tab' || unit === 'Cap' ? unit + 's' : 'doses'}
                    </span>
                    {mrp && (
                      <span className="px-2 py-0.5 rounded bg-amber-100/80 text-amber-800 text-[10px]">
                        Ref. MRP: <strong>₹{mrp}</strong> (snapshot)
                      </span>
                    )}
                  </div>
                </div>
                <div className="font-mono text-xs text-slate-800 font-bold bg-white p-2 rounded border border-blue-100">
                  {previewRxLine}
                </div>
              </div>

              {/* Submit CTA with Safety Guard State */}
              <button
                type="submit"
                disabled={loading || allergyCheck?.outcome === 'BLOCK'}
                className={`w-full py-3 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 ${
                  allergyCheck?.outcome === 'BLOCK'
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300'
                    : allergyCheck?.outcome === 'CAUTION'
                    ? 'bg-amber-600 hover:bg-amber-700 text-white'
                    : 'btn-solid-primary'
                }`}
              >
                {loading ? (
                  <span>Transmitting Medication Order…</span>
                ) : allergyCheck?.outcome === 'BLOCK' ? (
                  <>
                    <AlertOctagon className="w-4 h-4 text-rose-500" />
                    <span>Order Blocked by Allergy Safety Guard</span>
                  </>
                ) : allergyCheck?.outcome === 'CAUTION' ? (
                  <>
                    <AlertTriangle className="w-4 h-4" />
                    <span>Acknowledge Cross-Reactivity Risk & Order</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Check Allergies & Prescribe Medication</span>
                  </>
                )}
              </button>

            </form>

            {/* Execution Result Banner */}
            {lastResult && (
              <div className={`mt-4 p-3.5 rounded-xl border animate-enter ${
                !lastResult.success
                  ? 'bg-rose-50 border-rose-300 text-rose-900'
                  : lastResult.caution
                  ? 'bg-amber-50 border-amber-300 text-amber-900'
                  : 'bg-emerald-50 border-emerald-300 text-emerald-900'
              }`}>
                <div className="flex items-start gap-2.5">
                  {!lastResult.success ? (
                    <AlertOctagon className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  ) : lastResult.caution ? (
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  ) : (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  )}
                  <div className="text-xs">
                    <h4 className="font-bold">
                      {!lastResult.success
                        ? 'Order Intercepted: Severe Allergy Contraindication'
                        : lastResult.caution
                        ? 'Order Transmitted with Clinician Caution'
                        : 'Order Verified & Recorded in Hospital EMR'}
                    </h4>
                    <p className="mt-1 leading-relaxed opacity-90 font-mono text-[11px]">
                      {lastResult.message}
                    </p>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>

        {/* Right Column: Order History & Clinical Rules Guide (5 Cols) */}
        <div className="lg:col-span-5 space-y-5">
          
          {/* Dynamic Clinical Cross-Reactivity Rules Card */}
          <div className="app-card p-5 bg-white border border-slate-200 shadow-sm">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Stethoscope className="w-4 h-4 text-blue-600" />
                <span>Pharmacological Allergy Rules</span>
              </span>
              <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-semibold">
                Class Cross-Reactivity
              </span>
            </h4>
            
            <div className="space-y-2 text-xs">
              {Object.entries(allergyRules).length > 0 ? (
                Object.entries(allergyRules).map(([key, rule]) => {
                  const isPatientAllergic = selectedPatient.allergies.includes(key)
                  return (
                    <div
                      key={key}
                      className={`p-2.5 rounded-lg border transition-all ${
                        isPatientAllergic
                          ? 'bg-rose-50/70 border-rose-200 ring-1 ring-rose-300'
                          : 'bg-slate-50 border-slate-200/80'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`font-bold ${isPatientAllergic ? 'text-rose-700' : 'text-slate-800'}`}>
                          {rule.label || key.toUpperCase()} Allergy:
                        </span>
                        {isPatientAllergic && (
                          <span className="px-1.5 py-0.2 rounded bg-rose-200 text-rose-800 text-[9px] font-bold">
                            PATIENT HAS THIS
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-600 mt-1">
                        {rule.blocked_drugs_desc}
                      </div>
                      {rule.caution_drugs_desc && (
                        <div className="text-[10px] text-amber-700 font-semibold mt-1">
                          ⚠️ {rule.caution_drugs_desc}
                        </div>
                      )}
                    </div>
                  )
                })
              ) : (
                <div className="text-slate-400 text-xs py-2">Loading clinical allergy rules…</div>
              )}
            </div>
          </div>

          {/* Recent Orders for Case (Fixed Display Bug: No empty ()) */}
          <div className="app-card p-5 bg-white border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Case Orders ({recentOrders.length})
              </h4>
              <span className="text-[10px] text-slate-400 font-medium">
                {selectedPatient.caseId} · {selectedPatient.orId}
              </span>
            </div>

            {recentOrders.length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-400">
                No orders registered for {selectedPatient.caseId} yet.
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {recentOrders.map((ord, i) => {
                  const isCaution = ord.allergy_status === 'CAUTION'
                  // Clean display line with no empty ()
                  const displayLine = ord.rx_line || `${ord.form || ''} ${ord.brand || ord.medication} ${ord.dose || ord.dose_mg || ''}${ord.unit || 'mg'} | ${ord.route || 'IV'} | ${ord.frequency || 'STAT'}`.trim()
                  
                  return (
                    <div
                      key={ord.order_id || ord.idempotency_key || i}
                      className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-slate-900 truncate">
                          {displayLine}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-2">
                          <span>By: {ord.ordered_by || 'Attending'}</span>
                          {ord.created_at && (
                            <span>· {new Date(ord.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                          )}
                        </div>
                        {isCaution && ord.caution_note && (
                          <div className="text-[10px] text-amber-700 font-semibold mt-1 truncate">
                            ⚠️ {ord.caution_note}
                          </div>
                        )}
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                        isCaution
                          ? 'bg-amber-100 text-amber-800 border border-amber-200'
                          : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      }`}>
                        {isCaution ? '⚠️ Caution' : '✓ Cleared'}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  )
}
