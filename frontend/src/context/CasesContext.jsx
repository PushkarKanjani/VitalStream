import { createContext, useContext, useReducer, useCallback } from 'react'

const CasesContext = createContext(null)

const initialState = {
  cases: {},        // keyed by or_id
  beds: {},         // keyed by bed_id
  alerts: [],       // unacknowledged alerts
  vitals: {},       // latest vitals keyed by or_id
}

function reducer(state, action) {
  switch (action.type) {
    case 'CASE_CHANGE': {
      const c = action.payload
      return { ...state, cases: { ...state.cases, [c.or_id]: c } }
    }
    case 'BED_CHANGE': {
      const b = action.payload
      return { ...state, beds: { ...state.beds, [b.bed_id]: b } }
    }
    case 'ALERT_CHANGE': {
      const a = action.payload
      if (a.acknowledged) {
        // Remove from unacked list
        return { ...state, alerts: state.alerts.filter(x => x.alert_id !== a.alert_id) }
      }
      // Add or update
      const exists = state.alerts.find(x => x.alert_id === a.alert_id)
      if (exists) return state
      return { ...state, alerts: [a, ...state.alerts].slice(0, 100) }
    }
    case 'VITALS_UPDATE': {
      const v = action.payload
      return { ...state, vitals: { ...state.vitals, [v.or_id]: v } }
    }
    case 'SET_INITIAL_BEDS':
      return { ...state, beds: action.payload }
    case 'SET_INITIAL_ALERTS':
      return { ...state, alerts: action.payload }
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
  return useContext(CasesContext)
}
