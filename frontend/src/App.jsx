import { useEffect, useState } from 'react'
import { CasesProvider, useCases } from './context/CasesContext'
import { useWebSocket }            from './hooks/useWebSocket'
import ORWall        from './components/ORWall'
import AlertQueue    from './components/AlertQueue'
import BedBoard      from './components/BedBoard'
import PipelineHealth from './components/PipelineHealth'
import VitalWaveform from './components/VitalWaveform'
import './index.css'

function AppInner() {
  const { handleWsMessage, dispatch } = useCases()
  const [tab, setTab] = useState('overview')
  const [wsConnected, setWsConnected] = useState(false)

  useWebSocket((msg) => {
    setWsConnected(true)
    handleWsMessage(msg)
  })

  // Load initial data on mount
  useEffect(() => {
    fetch('/api/beds/').then(r => r.json()).then(beds => {
      const byId = Object.fromEntries(beds.map(b => [b.bed_id, b]))
      dispatch({ type: 'SET_INITIAL_BEDS', payload: byId })
    }).catch(console.error)

    fetch('/api/alerts/unacknowledged').then(r => r.json()).then(alerts => {
      dispatch({ type: 'SET_INITIAL_ALERTS', payload: alerts })
    }).catch(console.error)
  }, [])

  const TABS = ['overview', 'waveforms', 'beds', 'pipeline']

  return (
    <div className="min-h-screen bg-vs-bg">
      {/* ── Navbar ────────────────────────────────────────────────────────── */}
      <header className="border-b border-vs-border bg-vs-surface/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-screen-xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-vs-red font-bold text-sm font-mono">●</span>
            <span className="font-semibold text-vs-text">VitalStream</span>
            <span className="text-xs text-vs-muted border border-vs-border rounded px-2 py-0.5">v1.0</span>
          </div>

          <nav className="flex gap-1">
            {TABS.map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-1.5 rounded text-sm capitalize transition-colors
                  ${tab === t
                    ? 'bg-vs-blue/20 text-vs-blue'
                    : 'text-vs-muted hover:text-vs-text'}`}
              >
                {t}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2 text-xs">
            <span className={`status-dot ${wsConnected ? 'active' : 'alert'}`} />
            <span className="text-vs-muted">{wsConnected ? 'Live' : 'Connecting…'}</span>
          </div>
        </div>
      </header>

      {/* ── Main content ──────────────────────────────────────────────────── */}
      <main className="max-w-screen-xl mx-auto px-6 py-6">
        {tab === 'overview' && (
          <div className="grid grid-cols-3 gap-6">
            {/* Left 2/3 — OR grid */}
            <div className="col-span-2 space-y-6">
              <ORWall />
              <AlertQueue />
            </div>
            {/* Right 1/3 — sidebar */}
            <div className="space-y-6">
              <PipelineHealth />
            </div>
          </div>
        )}

        {tab === 'waveforms' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-vs-text">Live Vital Waveforms</h2>
            <div className="grid grid-cols-2 gap-4">
              {['OR-1','OR-2','OR-3','OR-4','OR-5','OR-6'].map(or => (
                <VitalWaveform key={`${or}-hr`} orId={or} field="hr" />
              ))}
            </div>
          </div>
        )}

        {tab === 'beds' && (
          <div className="max-w-2xl">
            <BedBoard />
          </div>
        )}

        {tab === 'pipeline' && (
          <div className="max-w-xl">
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
