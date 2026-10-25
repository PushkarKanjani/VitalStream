import { useState, useEffect } from 'react'
import { Pill, ShieldAlert, CheckCircle2, AlertOctagon, ArrowRight, UserCheck, Stethoscope } from 'lucide-react'
import { useToast } from '../context/ToastContext'
import { useCases } from '../context/CasesContext'

const PRESET_PATIENTS = [
  { id: 'vdb-patient-101', name: 'Eleanor Vance', age: 62, orId: 'OR-1', caseId: 'CASE-001', allergies: ['penicillin', 'aspirin'] },
  { id: 'vdb-patient-102', name: 'Marcus Thorne', age: 48, orId: 'OR-2', caseId: 'CASE-002', allergies: ['sulfa'] },
  { id: 'vdb-patient-103', name: 'Sarah Lin', age: 34, orId: 'OR-3', caseId: 'CASE-003', allergies: ['latex'] },
  { id: 'vdb-patient-104', name: 'Robert Chen', age: 71, orId: 'OR-4', caseId: 'CASE-004', allergies: ['contrast'] },
  { id: 'vdb-patient-105', name: 'Diana Prince', age: 29, orId: 'OR-5', caseId: 'CASE-005', allergies: [] },
  { id: 'vdb-patient-106', name: 'James Wilson', age: 55, orId: 'OR-6', caseId: 'CASE-006', allergies: ['codeine'] },
]

const COMMON_DRUGS = [
  { name: 'Amoxicillin', class: 'Penicillin Antibiotic', risk: 'Blocks if patient has Penicillin allergy' },
  { name: 'Ibuprofen', class: 'NSAID Analgesic', risk: 'Blocks if patient has Aspirin allergy' },
  { name: 'Sulfamethoxazole', class: 'Sulfonamide', risk: 'Blocks if patient has Sulfa allergy' },
  { name: 'Morphine', class: 'Opioid Analgesic', risk: 'Blocks if patient has Codeine allergy' },
  { name: 'Cefazolin', class: '1st Gen Cephalosporin', risk: 'Surgical prophylaxis — standard' },
  { name: 'Fentanyl', class: 'Synthetic Opioid', risk: 'Intraoperative sedation' },
  { name: 'Propofol', class: 'IV Hypnotic', risk: 'Induction agent' },
]

export default function MedicationConsole() {
  const { addToast } = useToast()
  const { dispatch } = useCases()

  const [selectedPatient, setSelectedPatient] = useState(PRESET_PATIENTS[0])
  const [selectedMed, setSelectedMed]         = useState(COMMON_DRUGS[0].name)
  const [dosage, setDosage]                   = useState('500')
  const [route, setRoute]                     = useState('IV')
  const [loading, setLoading]                 = useState(false)
  const [lastResult, setLastResult]           = useState(null)
  const [recentOrders, setRecentOrders]       = useState([])

  // Fetch recent orders for patient
  useEffect(() => {
    fetch(`/api/orders/case/${selectedPatient.caseId}`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setRecentOrders(data)
      })
      .catch(() => {})
  }, [selectedPatient.caseId])

  async function handleOrderSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setLastResult(null)

    const payload = {
      case_id: selectedPatient.caseId,
      patient_id: selectedPatient.id,
      medication: selectedMed,
      dose_mg: parseFloat(dosage) || 500.0,
      route: route,
      ordered_by: 'Dr. Pushkar Kanjani',
    }

    try {
      const res = await fetch('/api/orders/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await res.json()

      if (!res.ok) {
        // Allergy Guard Intercepted!
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
            entity: `${selectedMed} (${dosage})`,
            actor: 'Dr. Pushkar Kanjani',
            status: 'blocked',
            detail: errorMsg
          }
        })
      } else {
        // Order Verified & Committed!
        const successMsg = `Order ${data.order_id} verified: ${selectedMed} (${dosage}) cleared by Allergy Guard.`
        setLastResult({ success: true, message: successMsg, order: data })
        setRecentOrders(prev => [data, ...prev])
        addToast({
          type: 'success',
          title: 'Safety Check Passed',
          message: successMsg,
          duration: 4000
        })

        dispatch({
          type: 'ADD_AUDIT_LOG',
          payload: {
            id: `ORD-${Date.now().toString().slice(-4)}`,
            timestamp: new Date().toISOString(),
            action: 'MEDICATION_ORDER_COMMITTED',
            entity: `${selectedMed} (${dosage})`,
            actor: 'Dr. Pushkar Kanjani',
            status: 'success',
            detail: `Allergy check passed. Written to MongoDB orders collection.`
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
    <div className="max-w-6xl mx-auto py-6 px-6">
      
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">
          <ShieldAlert className="w-4 h-4" />
          <span>Branch 2A Core Feature · Clinical Decision Support</span>
        </div>
        <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
          Pharmacological Safety & Allergy Interception Console
        </h2>
        <p className="text-sm text-slate-600 mt-1">
          Tests the live MongoDB allergy validation engine. Synchronously blocks contraindicated medications before order commitment.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Interactive Order Form (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="app-card p-6 bg-white border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Pill className="w-4 h-4 text-blue-600" />
              <span>Prescribe Medication with Real-Time Allergy Guard</span>
            </h3>

            <form onSubmit={handleOrderSubmit} className="space-y-4">
              
              {/* Select Patient */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Target Patient & Case
                </label>
                <select
                  value={selectedPatient.id}
                  onChange={(e) => {
                    const p = PRESET_PATIENTS.find(x => x.id === e.target.value)
                    if (p) setSelectedPatient(p)
                  }}
                  className="app-input cursor-pointer"
                >
                  {PRESET_PATIENTS.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.age}yo) — {p.orId} [{p.caseId}] — Allergies: {p.allergies.length ? p.allergies.join(', ') : 'None'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Patient Dossier Snapshot */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-800">{selectedPatient.name}</div>
                  <div className="text-[11px] text-slate-500">Case ID: {selectedPatient.caseId} · OR: {selectedPatient.orId}</div>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {selectedPatient.allergies.length > 0 ? (
                    selectedPatient.allergies.map(a => (
                      <span key={a} className="px-2 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-[10px] font-bold uppercase">
                        ⚠ {a} Allergy
                      </span>
                    ))
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold">
                      ✓ No Documented Allergies
                    </span>
                  )}
                </div>
              </div>

              {/* Medication Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Medication (Select or Type)
                </label>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  {COMMON_DRUGS.slice(0, 4).map(d => (
                    <button
                      type="button"
                      key={d.name}
                      onClick={() => setSelectedMed(d.name)}
                      className={`p-2.5 rounded-lg text-left text-xs border transition-all ${
                        selectedMed === d.name 
                          ? 'border-blue-600 bg-blue-50/70 text-blue-900 font-bold' 
                          : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                      }`}
                    >
                      <div className="font-semibold">{d.name}</div>
                      <div className="text-[10px] text-slate-500 truncate">{d.class}</div>
                    </button>
                  ))}
                </div>

                <input
                  type="text"
                  value={selectedMed}
                  onChange={(e) => setSelectedMed(e.target.value)}
                  placeholder="Or enter custom medication name..."
                  className="app-input"
                  required
                />
              </div>

              {/* Dosage & Route */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Dosage
                  </label>
                  <input
                    type="text"
                    value={dosage}
                    onChange={(e) => setDosage(e.target.value)}
                    className="app-input"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Route
                  </label>
                  <select
                    value={route}
                    onChange={(e) => setRoute(e.target.value)}
                    className="app-input"
                  >
                    <option value="IV">IV (Intravenous)</option>
                    <option value="oral">Oral</option>
                    <option value="inhaled">Inhaled</option>
                    <option value="topical">Topical</option>
                  </select>
                </div>
              </div>

              {/* Submit CTA */}
              <button
                type="submit"
                disabled={loading}
                className="w-full btn-solid-primary py-3 rounded-xl mt-2 text-sm"
              >
                {loading ? 'Evaluating Contraindications…' : 'Verify & Prescribe Medication'}
              </button>
            </form>

            {/* Last Execution Result Banner */}
            {lastResult && (
              <div className={`mt-5 p-4 rounded-xl border animate-enter ${
                lastResult.success 
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
                  : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}>
                <div className="flex items-start gap-3">
                  {lastResult.success ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertOctagon className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <h4 className="font-bold text-sm">
                      {lastResult.success ? 'Order Approved & Stored in MongoDB' : 'Contraindication Intercepted by Safety Guard'}
                    </h4>
                    <p className="text-xs mt-1 leading-relaxed opacity-90">
                      {lastResult.message}
                    </p>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>

        {/* Right Column: Order History & Clinical Rules Guide (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Clinical Cross-Reactivity Rules Card */}
          <div className="app-card p-5 bg-white border border-slate-200">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Stethoscope className="w-4 h-4 text-blue-600" />
              <span>Active Pharmacological Safety Mappings</span>
            </h4>
            <div className="space-y-2 text-xs">
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80">
                <span className="font-bold text-rose-600">Penicillin Allergy:</span>
                <span className="text-slate-600 ml-1">Blocks Amoxicillin, Ampicillin, Piperacillin, Penicillin.</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80">
                <span className="font-bold text-rose-600">Aspirin Allergy:</span>
                <span className="text-slate-600 ml-1">Blocks Ibuprofen, Naproxen, Ketorolac.</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80">
                <span className="font-bold text-rose-600">Sulfa Allergy:</span>
                <span className="text-slate-600 ml-1">Blocks Sulfamethoxazole, Bactrim.</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80">
                <span className="font-bold text-rose-600">Codeine Allergy:</span>
                <span className="text-slate-600 ml-1">Blocks Morphine, Hydrocodone, Oxycodone.</span>
              </div>
            </div>
          </div>

          {/* Recent Orders for Case */}
          <div className="app-card p-5 bg-white border border-slate-200">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">
              Case Orders ({recentOrders.length})
            </h4>

            {recentOrders.length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-400">
                No orders registered for {selectedPatient.caseId} yet.
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {recentOrders.map((ord, i) => (
                  <div key={ord.order_id || i} className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-900">{ord.medication} ({ord.dosage})</div>
                      <div className="text-[11px] text-slate-500">Route: {ord.route} · By: {ord.ordered_by}</div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                      ✓ Cleared
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  )
}
