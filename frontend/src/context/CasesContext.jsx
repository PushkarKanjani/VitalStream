import { createContext, useContext, useReducer, useCallback } from 'react'

const CasesContext = createContext(null)

const HISTORY_LEN = 20  // rolling HR history for 20-value window

const initialState = {
  cases: {
    'OR-1': {
      case_id: 'CASE-001',
      or_id: 'OR-1',
      patient_id: 'vdb-patient-101',
      patient_name: 'Sunita Verma',
      procedure_name: 'Coronary Artery Bypass Graft (CABG)',
      procedure_type: 'Coronary Artery Bypass Graft (CABG)',
      primary_surgeon: 'Dr. Aditi Sharma (Chief Surgeon)',
      surgeon_name: 'Aditi Sharma',
      anesthesiologist: 'Dr. Amit Sen',
      status: 'active'
    },
    'OR-2': {
      case_id: 'CASE-002',
      or_id: 'OR-2',
      patient_id: 'vdb-patient-102',
      patient_name: 'Rajesh Malhotra',
      procedure_name: 'Laparoscopic Cholecystectomy',
      procedure_type: 'Laparoscopic Cholecystectomy',
      primary_surgeon: 'Dr. Rajesh Kulkarni (Chief Surgeon)',
      surgeon_name: 'Rajesh Kulkarni',
      anesthesiologist: 'Dr. Neha Trivedi',
      status: 'active'
    },
    'OR-3': {
      case_id: 'CASE-003',
      or_id: 'OR-3',
      patient_id: 'vdb-patient-103',
      patient_name: 'Pooja Iyer',
      procedure_name: 'Total Hip Arthroplasty',
      procedure_type: 'Total Hip Arthroplasty',
      primary_surgeon: 'Dr. Anjali Mehta (Chief Surgeon)',
      surgeon_name: 'Anjali Mehta',
      anesthesiologist: 'Dr. Parth Joshi',
      status: 'active'
    },
    'OR-4': {
      case_id: 'CASE-004',
      or_id: 'OR-4',
      patient_id: 'vdb-patient-104',
      patient_name: 'Ramesh Patel',
      procedure_name: 'Craniotomy for Subdural Hematoma',
      procedure_type: 'Craniotomy for Subdural Hematoma',
      primary_surgeon: 'Dr. Rohan Gupta (Chief Surgeon)',
      surgeon_name: 'Rohan Gupta',
      anesthesiologist: 'Dr. Meera Pandya',
      status: 'active'
    },
    'OR-5': {
      case_id: 'CASE-005',
      or_id: 'OR-5',
      patient_id: 'vdb-patient-105',
      patient_name: 'Priyanka Desai',
      procedure_name: 'Emergency Exploratory Laparotomy',
      procedure_type: 'Emergency Exploratory Laparotomy',
      primary_surgeon: 'Dr. Vivek Menon (Chief Surgeon)',
      surgeon_name: 'Vivek Menon',
      anesthesiologist: 'Dr. Krunal Bhatt',
      status: 'active'
    },
    'OR-6': {
      case_id: 'CASE-006',
      or_id: 'OR-6',
      patient_id: 'vdb-patient-106',
      patient_name: 'Vikram Nair',
      procedure_name: 'Video-Assisted Thoracoscopic Surgery (VATS)',
      procedure_type: 'Video-Assisted Thoracoscopic Surgery (VATS)',
      primary_surgeon: 'Dr. Suresh Nambiar (Chief Surgeon)',
      surgeon_name: 'Suresh Nambiar',
      anesthesiologist: 'Dr. Harshil Shah',
      status: 'active'
    }
  },
  beds: {},          // keyed by bed_id
  alerts: [],        // all unacknowledged alerts
  vitals: {},        // latest vitals keyed by or_id
  vitalsHistory: {}, // rolling object of per-metric history arrays per or_id
  activeOutliers: [],// true list of currently active outliers (D1 window)
  outlierLog: [],    // historical log of outlier events
  selectedOrId: null,
  auditLogs: [
    // ── Past 24 Hours (Today) ──
    {
      id: 'AUD-101',
      timestamp: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
      action: 'SYSTEM_BOOT',
      entity: 'Cluster Orchestration',
      actor: 'System Daemon',
      status: 'success',
      detail: 'Kafka (6 partitions), Cassandra, MongoDB WiredTiger, and Flink connected.'
    },
    {
      id: 'AUD-102',
      timestamp: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
      action: 'BED_ALLOCATION',
      entity: 'Bed REC-1',
      actor: 'Charge Nurse Sarah',
      status: 'success',
      detail: 'ACID findOneAndUpdate reservation committed for CASE-001.'
    },
    {
      id: 'AUD-103',
      timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
      action: 'ALLERGY_GUARD_INTERCEPT',
      entity: 'Medication Order',
      actor: 'Dr. Aditi Sharma',
      status: 'blocked',
      detail: 'Blocked Augmentin 625 Duo order — Sunita Verma has documented Penicillin allergy.'
    },
    {
      id: 'AUD-104',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
      action: 'MEDICATION_ORDER_COMMITTED',
      entity: 'Tab. Pan 40 40mg',
      actor: 'Dr. Aditi Sharma',
      status: 'success',
      detail: 'Order ORD-104 cleared by allergy check: Tab. Pan 40 40mg | Oral | OD (1-0-0) x 7 days.'
    },
    {
      id: 'AUD-105',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
      action: 'ALERT_ACKNOWLEDGED',
      entity: 'OR-2 SBP Incident',
      actor: 'Dr. Rajesh Kulkarni',
      status: 'success',
      detail: 'Acknowledged SBP 70.0 mmHg hypotensive breach on OR-2. Ephedrine 5mg administered.'
    },
    {
      id: 'AUD-106',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 9).toISOString(),
      action: 'BED_RESERVED',
      entity: 'Bed REC-3',
      actor: 'Dr. Anjali Mehta',
      status: 'success',
      detail: 'Pre-reserved PACU Bed REC-3 for CASE-003 (Hip Arthroplasty post-op).'
    },

    // ── Past Week (2 to 6 days ago) ──
    {
      id: 'AUD-201',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
      action: 'ALLERGY_GUARD_INTERCEPT',
      entity: 'Combiflam Order',
      actor: 'Dr. Rohan Gupta',
      status: 'blocked',
      detail: 'Blocked Combiflam order — Sunita Verma has documented Aspirin/NSAID allergy (Ibuprofen cross-reaction).'
    },
    {
      id: 'AUD-202',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
      action: 'SURGERY_COMPLETED',
      entity: 'CASE-002',
      actor: 'Dr. Vivek Menon',
      status: 'success',
      detail: 'Laparoscopic Cholecystectomy procedure completed successfully. Patient transferred to PACU REC-2.'
    },
    {
      id: 'AUD-203',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 4).toISOString(),
      action: 'BED_RELEASED',
      entity: 'Bed REC-1',
      actor: 'Staff Nurse Pooja',
      status: 'success',
      detail: 'Bed REC-1 cleaning protocol finished. Returned to available state in MongoDB.'
    },
    {
      id: 'AUD-204',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
      action: 'ALERT_ESCALATION',
      entity: 'ALT-103 (SpO2 Falling)',
      actor: 'Flink Stream Timer',
      status: 'escalated',
      detail: 'PyFlink 10-minute unacknowledged alert escalation dispatched to charge anesthesiologist.'
    },
    {
      id: 'AUD-205',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 6).toISOString(),
      action: 'SHIFT_HANDOVER',
      entity: 'Surgical Suite 1-6',
      actor: 'Dr. Suresh Nambiar',
      status: 'success',
      detail: 'Night shift to morning perioperative team clinical handoff signed off.'
    },

    // ── Past Month / Last 30 Days (10 to 28 days ago) ──
    {
      id: 'AUD-301',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 12).toISOString(),
      action: 'PATIENT_ADMITTED',
      entity: 'Pre-op Cohort vdb-101..106',
      actor: 'Admissions Desk',
      status: 'success',
      detail: 'Demographic profiles, allergies, and blood types verified and stored in MongoDB.'
    },
    {
      id: 'AUD-302',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 18).toISOString(),
      action: 'FORMULARY_UPDATE',
      entity: 'Indian Drug Formulary',
      actor: 'Clinical Pharmacist',
      status: 'success',
      detail: 'Seeded 42 curated Indian drug compositions (Augmentin, Combiflam, Pan 40, Cefazolin, etc.).'
    },
    {
      id: 'AUD-303',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 22).toISOString(),
      action: 'ALLERGY_GUARD_INTERCEPT',
      entity: 'Tramadol Order',
      actor: 'Dr. Amit Sen',
      status: 'blocked',
      detail: 'Blocked opioid order — patient Vikram Nair has documented Codeine/Opioid hypersensitivity.'
    },
    {
      id: 'AUD-304',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 26).toISOString(),
      action: 'COMPACTION_CYCLE',
      entity: 'Cassandra Storage Engine',
      actor: 'Cassandra Daemon',
      status: 'success',
      detail: 'TWCS daily SSTable compaction cycle finalized. Sub-5ms P95 write latency verified.'
    },
    {
      id: 'AUD-305',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 28).toISOString(),
      action: 'SECURITY_AUDIT',
      entity: 'HIPAA & Perioperative Policy',
      actor: 'Chief Medical Officer',
      status: 'success',
      detail: 'Monthly clinical governance and immutable audit trail compliance review passed 100%.'
    }
  ]
}

function reducer(state, action) {
  switch (action.type) {
    case 'CASE_CHANGE': {
      const c = action.payload
      return { ...state, cases: { ...state.cases, [c.or_id]: c } }
    }
    case 'SET_INITIAL_CASES':
      return { ...state, cases: action.payload }
    case 'BED_CHANGE': {
      const b = action.payload
      return { ...state, beds: { ...state.beds, [b.bed_id]: b } }
    }
    case 'ALERT_CHANGE': {
      const a = action.payload
      if (a.acknowledged) {
        return { ...state, alerts: state.alerts.filter(x => x.alert_id !== a.alert_id) }
      }
      const exists = state.alerts.find(x => x.alert_id === a.alert_id)
      if (exists) {
        return {
          ...state,
          alerts: state.alerts.map(x => x.alert_id === a.alert_id ? { ...x, ...a } : x),
        }
      }
      return { ...state, alerts: [a, ...state.alerts].slice(0, 100) }
    }
    case 'SET_ACTIVE_OUTLIERS': {
      return { ...state, activeOutliers: action.payload || [] }
    }
    case 'VITALS_UPDATE': {
      const v = action.payload
      const orId = v.or_id
      const prev = state.vitalsHistory[orId] || { hr: [], syst_bp: [], o2_sat: [], temp_c: [] }
      const nextHist = {
        hr: [...(Array.isArray(prev.hr) ? prev.hr : []), v.hr != null ? v.hr : null].slice(-HISTORY_LEN),
        syst_bp: [...(Array.isArray(prev.syst_bp) ? prev.syst_bp : []), v.syst_bp != null ? v.syst_bp : null].slice(-HISTORY_LEN),
        o2_sat: [...(Array.isArray(prev.o2_sat) ? prev.o2_sat : []), v.o2_sat != null ? v.o2_sat : null].slice(-HISTORY_LEN),
        temp_c: [...(Array.isArray(prev.temp_c) ? prev.temp_c : []), v.temp_c != null ? v.temp_c : null].slice(-HISTORY_LEN),
      }

      // Append to outlier history log if flagged
      let outlierLog = state.outlierLog
      if (v.is_outlier && v.outlier_reason) {
        outlierLog = [
          {
            ts: v.timestamp || new Date().toISOString(),
            ts_utc_ms: v.ts_utc_ms || Date.now(),
            or_id: orId,
            metric: v.metric || 'hr',
            val: v.val,
            unit: v.unit || '',
            rule: v.rule || 'THRESHOLD',
            expected_low: v.expected_low,
            expected_high: v.expected_high,
            z_score: v.z_score,
            reason: v.outlier_reason,
            severity: v.severity || 'CRITICAL',
          },
          ...outlierLog,
        ].slice(0, 500)
      }

      const activeOutliers = v.active_outliers !== undefined ? v.active_outliers : state.activeOutliers

      return {
        ...state,
        vitals: { ...state.vitals, [orId]: v },
        vitalsHistory: { ...state.vitalsHistory, [orId]: nextHist },
        activeOutliers,
        outlierLog,
      }
    }
    case 'SET_INITIAL_BEDS':
      return { ...state, beds: action.payload }
    case 'SET_INITIAL_ALERTS':
      return { ...state, alerts: action.payload }
    case 'SET_SELECTED_OR':
      return { ...state, selectedOrId: action.payload }
    case 'ADD_AUDIT_LOG':
      return { ...state, auditLogs: [action.payload, ...state.auditLogs].slice(0, 50) }
    default:
      return state
  }
}

export function CasesProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState)

  const handleWsMessage = useCallback((msg) => {
    if (msg.event === 'case_change')      dispatch({ type: 'CASE_CHANGE',          payload: msg.data })
    if (msg.event === 'bed_change')       dispatch({ type: 'BED_CHANGE',           payload: msg.data })
    if (msg.event === 'alert_change')     dispatch({ type: 'ALERT_CHANGE',         payload: msg.data })
    if (msg.event === 'active_outliers')  dispatch({ type: 'SET_ACTIVE_OUTLIERS',  payload: msg.data })
    if (msg.event === 'vitals')           dispatch({ type: 'VITALS_UPDATE',        payload: msg.data })
  }, [])

  return (
    <CasesContext.Provider value={{ state, dispatch, handleWsMessage }}>
      {children}
    </CasesContext.Provider>
  )
}

export function useCases() {
  const ctx = useContext(CasesContext)
  if (!ctx) throw new Error('useCases must be used within CasesProvider')
  return ctx
}
