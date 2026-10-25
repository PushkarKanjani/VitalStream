import { useEffect, useState } from 'react'
import { CasesProvider, useCases } from './context/CasesContext'
import { useWebSocket }            from './hooks/useWebSocket'
import ORWall        from './components/ORWall'
import AlertQueue    from './components/AlertQueue'
import BedBoard      from './components/BedBoard'
import PipelineHealth from './components/PipelineHealth'
import VitalWaveform from './components/VitalWaveform'
import './index.css'

const TABS = [
  { id: 'overview',  label: 'OR Overview',  icon: '◻' },
  { id: 'alerts',    label: 'Alerts',        icon: '⚑' },
  { id: 'beds',      label: 'Bed Board',     icon: '⊞' },
  { id: 'waveforms', label: 'Waveforms',     icon: '∿' },
  { id: 'pipeline',  label: 'Pipeline',      icon: '⊛' },
]

function AppInner() {
  const { handleWsMessage, dispatch, state } = useCases()
  const [tab, setTab] = useState('overview')
  const [wsConnected, setWsConnected] = useState(false)
  const [wsError, setWsError] = useState(false)

  useWebSocket((msg) => {
    setWsConnected(true)
    setWsError(false)
    handleWsMessage(msg)
  })

  // Load initial data on mount
  useEffect(() => {
    fetch('/api/beds/').then(r => r.json()).then(beds => {
      const byId = Object.fromEntries(beds.map(b => [b.bed_id, b]))
      dispatch({ type: 'SET_INITIAL_BEDS', payload: byId })
    }).catch(() => {})

    fetch('/api/alerts/unacknowledged').then(r => r.json()).then(alerts => {
      dispatch({ type: 'SET_INITIAL_ALERTS', payload: alerts })
    }).catch(() => {})

    fetch('/api/cases/active').then(r => r.json()).then(cases => {
      const byOr = Object.fromEntries(cases.map(c => [c.or_id, c]))
      dispatch({ type: 'SET_INITIAL_CASES', payload: byOr })
    }).catch(() => {})
  }, [])

  const unackedCount = state.alerts.filter(a => !a.acknowledged).length

  return (
    <div className="min-h-screen" style={{ background: '#F7F8FA' }}>

      {/* ── Top header ─────────────────────────────────────────────────── */}
      <header style={{
        background: '#FFFFFF',
        borderBottom: '1px solid #E4E7EE',
        position: 'sticky',
        top: 0,
        zIndex: 40,
      }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 24px' }}>

          {/* Brand row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: 'linear-gradient(135deg,#2563EB,#6B46C1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ color: '#fff', fontSize: 14, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace' }}>VS</span>
              </div>
              <div>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1A1D27', lineHeight: 1.1 }}>VitalStream</div>
                <div style={{ fontSize: '0.65rem', color: '#8890A4', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Perioperative Command Center</div>
              </div>
            </div>

            {/* Status indicators */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              {unackedCount > 0 && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: '#FDF0F2', border: '1px solid #F5C5CC',
                  borderRadius: 20, padding: '4px 10px',
                  cursor: 'pointer',
                }} onClick={() => setTab('alerts')}>
                  <span style={{ fontSize: 9, color: '#C7344C', animation: 'pulseAlert 1.4s infinite' }}>●</span>
                  <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#C7344C' }}>{unackedCount} Alert{unackedCount > 1 ? 's' : ''}</span>
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className={`status-dot ${wsConnected ? 'live' : 'idle'}`} />
                <span style={{ fontSize: '0.75rem', color: '#8890A4' }}>
                  {wsConnected ? 'Live' : 'Connecting…'}
                </span>
              </div>
            </div>
          </div>

          {/* Tab nav */}
          <nav style={{ display: 'flex', gap: 2, paddingBottom: 0 }}>
            {TABS.map(t => {
              const active = tab === t.id
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '8px 14px',
                    border: 'none',
                    borderBottom: active ? '2px solid #2563EB' : '2px solid transparent',
                    background: 'transparent',
                    cursor: 'pointer',
                    fontSize: '0.82rem',
                    fontWeight: active ? 600 : 400,
                    color: active ? '#2563EB' : '#8890A4',
                    transition: 'color 0.15s',
                    marginBottom: -1,
                    fontFamily: 'Inter, sans-serif',
                    position: 'relative',
                  }}
                >
                  <span style={{ fontSize: 10 }}>{t.icon}</span>
                  {t.label}
                  {t.id === 'alerts' && unackedCount > 0 && (
                    <span style={{
                      background: '#C7344C', color: '#fff',
                      borderRadius: 10, padding: '1px 5px',
                      fontSize: '0.62rem', fontWeight: 700,
                      marginLeft: 2,
                    }}>{unackedCount}</span>
                  )}
                </button>
              )
            })}
          </nav>
        </div>
      </header>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <main style={{ maxWidth: 1400, margin: '0 auto', padding: '24px' }}>

        {tab === 'overview' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <ORWall />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <AlertQueue compact />
              <PipelineHealth compact />
            </div>
          </div>
        )}

        {tab === 'alerts' && (
          <div style={{ maxWidth: 720 }}>
            <AlertQueue />
          </div>
        )}

        {tab === 'beds' && (
          <div style={{ maxWidth: 780 }}>
            <BedBoard />
          </div>
        )}

        {tab === 'waveforms' && (
          <div>
            <h2 style={{ fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#8890A4', marginBottom: 16 }}>
              Live Vital Waveforms — All ORs
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
              {['OR-1','OR-2','OR-3','OR-4','OR-5','OR-6'].map(or => (
                <VitalWaveform key={`${or}-hr`} orId={or} field="hr" />
              ))}
            </div>
          </div>
        )}

        {tab === 'pipeline' && (
          <div style={{ maxWidth: 640 }}>
            <PipelineHealth />
          </div>
        )}
      </main>
    </div>
  )
}

export default function App() {
  return (
    <CasesProvider>
      <AppInner />
    </CasesProvider>
  )
}
