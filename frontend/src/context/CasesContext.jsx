import { createContext, useContext, useReducer, useCallback } from 'react'

const CasesContext = createContext(null)

const HISTORY_LEN = 20  // rolling HR history for 20-value window

const initialState = {
  cases: {},         // keyed by or_id
  beds: {},          // keyed by bed_id
  alerts: [],        // all unacknowledged alerts
  vitals: {},        // latest vitals keyed by or_id
  vitalsHistory: {}, // rolling array of last HISTORY_LEN HR values per or_id
  outlierLog: [],    // last 100 outlier events [{ts, or_id, metric, val, reason, severity}]
  selectedOrId: null,
  auditLogs: [
    {
      id: 'AUD-001',
      timestamp: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
      action: 'SYSTEM_BOOT',
      entity: 'Cluster Orchestration',
      actor: 'System Daemon',
      status: 'success',
      detail: 'Kafka (6 partitions), Cassandra, MongoDB WiredTiger, and Flink connected.'
    },
    {
      id: 'AUD-002',
      timestamp: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
      action: 'BED_ALLOCATION',
      entity: 'Bed REC-1',
      actor: 'Charge Nurse Sarah',
      status: 'success',
      detail: 'ACID findOneAndUpdate reservation committed for CASE-001.'
    },
    {
      id: 'AUD-003',
      timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
      action: 'ALLERGY_GUARD_INTERCEPT',
      entity: 'Medication Order',
      actor: 'Dr. Evans',
      status: 'blocked',
      detail: 'Blocked Amoxicillin order — patient record documents severe Penicillin allergy.'
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
    case 'VITALS_UPDATE': {
      const v = action.payload
      const orId = v.or_id
      // Rolling HR history for sparklines
      const prev = state.vitalsHistory[orId] || []
      const nextHist = [...prev, v.hr != null ? v.hr : null].slice(-HISTORY_LEN)
      // Append to outlier log if flagged
      let outlierLog = state.outlierLog
      if (v.is_outlier && v.outlier_reason) {
        outlierLog = [
          {
            ts: v.timestamp || new Date().toISOString(),
            or_id: orId,
            metric: v.metric || 'hr',
            val: v.val,
            reason: v.outlier_reason,
            severity: v.severity || 'CRITICAL',
          },
          ...outlierLog,
        ].slice(0, 100)
      }
      return {
        ...state,
        vitals: { ...state.vitals, [orId]: v },
        vitalsHistory: { ...state.vitalsHistory, [orId]: nextHist },
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
    if (msg.event === 'case_change')  dispatch({ type: 'CASE_CHANGE',  payload: msg.data })
    if (msg.event === 'bed_change')   dispatch({ type: 'BED_CHANGE',   payload: msg.data })
    if (msg.event === 'alert_change') dispatch({ type: 'ALERT_CHANGE', payload: msg.data })
    if (msg.event === 'vitals')       dispatch({ type: 'VITALS_UPDATE', payload: msg.data })
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
