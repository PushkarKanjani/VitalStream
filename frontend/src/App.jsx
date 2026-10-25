import { useEffect, useState } from 'react'
import { CasesProvider, useCases } from './context/CasesContext'
import { ToastProvider, useToast } from './context/ToastContext'
import { useWebSocket } from './hooks/useWebSocket'

import Navbar from './components/Navbar'
import LandingPage from './components/LandingPage'
import ORWall from './components/ORWall'
import AlertQueue from './components/AlertQueue'
import BedBoard from './components/BedBoard'
import PipelineHealth from './components/PipelineHealth'
import VitalWaveform from './components/VitalWaveform'
import MedicationConsole from './components/MedicationConsole'
import AuditReports from './components/AuditReports'
import CaseDetailsDrawer from './components/CaseDetailsDrawer'

import './index.css'

function AppContent() {
  const { handleWsMessage, dispatch, state } = useCases()
  const { addToast } = useToast()

  const [currentView, setCurrentView] = useState('landing') // 'landing' | 'command' | 'meds' | 'audit' | 'cluster'
  const [commandSubTab, setCommandSubTab] = useState('overview') // 'overview' | 'waveforms' | 'beds' | 'alerts'
  const [wsConnected, setWsConnected] = useState(false)
  const [selectedOrForDrawer, setSelectedOrForDrawer] = useState(null)

  // Real-time WebSocket connection
  useWebSocket((msg) => {
    if (!wsConnected) {
      setWsConnected(true)
      addToast({
        type: 'info',
        title: 'Telemetry Stream Synced',
        message: 'Live connection to Kafka & MongoDB Change Streams established.',
        duration: 3000
      })
    }
    handleWsMessage(msg)
  })

  // Load baseline data on startup
  useEffect(() => {
    // Beds
    fetch('/api/beds/')
      .then(r => r.json())
      .then(beds => {
        if (Array.isArray(beds)) {
          const byId = Object.fromEntries(beds.map(b => [b.bed_id, b]))
          dispatch({ type: 'SET_INITIAL_BEDS', payload: byId })
        }
      })
      .catch(() => {})

    // Alerts
    fetch('/api/alerts/unacknowledged')
      .then(r => r.json())
      .then(alerts => {
        if (Array.isArray(alerts)) {
          dispatch({ type: 'SET_INITIAL_ALERTS', payload: alerts })
        }
      })
      .catch(() => {})

    // Active Cases
    fetch('/api/cases/active')
      .then(r => r.json())
      .then(cases => {
        if (Array.isArray(cases)) {
          const byOr = Object.fromEntries(cases.map(c => [c.or_id, c]))
          dispatch({ type: 'SET_INITIAL_CASES', payload: byOr })
        }
      })
      .catch(() => {})
  }, [dispatch])

  return (
    <div className="min-h-screen bg-[#FAFBFD] text-slate-900 flex flex-col font-sans">
      
      {/* ── Global Production Header ───────────────────────────────────────── */}
      <Navbar
        currentView={currentView}
        onViewChange={(v) => setCurrentView(v)}
        wsConnected={wsConnected}
      />

      {/* ── Main Application Body ─────────────────────────────────────────── */}
      <main className="flex-1">
        
        {/* VIEW 1: Platform Overview / Landing Presentation */}
        {currentView === 'landing' && (
          <LandingPage
            onLaunchCommandCenter={() => setCurrentView('command')}
          />
        )}

        {/* VIEW 2: Clinical Command Center Suite */}
        {currentView === 'command' && (
          <div className="max-w-7xl mx-auto px-6 py-6 animate-enter">
            
            {/* Command Suite Sub-Navigation */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-6">
              <div>
                <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
                  Operating Room Command Center
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Live operating room vitals, active alerts, and recovery bed status
                </p>
              </div>

              <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200 text-xs">
                {[
                  { id: 'overview',  label: 'Overview' },
                  { id: 'waveforms', label: 'Waveforms' },
                  { id: 'beds',      label: 'Recovery Beds' },
                  { id: 'alerts',    label: 'Alerts' },
                ].map(sub => (
                  <button
                    key={sub.id}
                    onClick={() => setCommandSubTab(sub.id)}
                    className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                      commandSubTab === sub.id 
                        ? 'bg-white text-slate-900 shadow-sm' 
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {sub.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Sub-view: Overview Layout (OR Wall + Alert Queue & Bed Board Sidebar) */}
            {commandSubTab === 'overview' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left 8 Columns: OR Suite Wall */}
                <div className="lg:col-span-8 space-y-6">
                  <ORWall 
                    onSelectOr={(orId) => setSelectedOrForDrawer(orId)} 
                  />
                  <div className="pt-2">
                    <VitalWaveform orId="OR-1" field="hr" />
                  </div>
                </div>

                {/* Right 4 Columns: Side Quick Panels */}
                <div className="lg:col-span-4 space-y-6">
                  <AlertQueue compact />
                  <BedBoard />
                </div>
              </div>
            )}

            {/* Sub-view: High-Res Waveforms Grid */}
            {commandSubTab === 'waveforms' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {['OR-1','OR-2','OR-3','OR-4','OR-5','OR-6'].map(or => (
                    <VitalWaveform key={`${or}-hr`} orId={or} field="hr" />
                  ))}
                </div>
              </div>
            )}

            {/* Sub-view: Dedicated Bed Allocation Board */}
            {commandSubTab === 'beds' && (
              <div className="max-w-4xl mx-auto">
                <BedBoard />
              </div>
            )}

            {/* Sub-view: Dedicated Alert Incident Queue */}
            {commandSubTab === 'alerts' && (
              <div className="max-w-3xl mx-auto">
                <AlertQueue />
              </div>
            )}

          </div>
        )}

        {/* VIEW 3: Pharmacological Safety Console */}
        {currentView === 'meds' && (
          <div className="animate-enter">
            <MedicationConsole />
          </div>
        )}

        {/* VIEW 4: Clinical Governance & Safety Audit Trail */}
        {currentView === 'audit' && (
          <div className="animate-enter">
            <AuditReports />
          </div>
        )}

        {/* VIEW 5: Cluster Architecture & Pipeline Health */}
        {currentView === 'cluster' && (
          <div className="max-w-4xl mx-auto px-6 py-8 animate-enter">
            <PipelineHealth />
          </div>
        )}

      </main>

      {/* ── Slide-over Case Details Dossier Drawer ─────────────────────────── */}
      {selectedOrForDrawer && (
        <CaseDetailsDrawer
          orId={selectedOrForDrawer}
          onClose={() => setSelectedOrForDrawer(null)}
          onOpenMedConsole={() => setCurrentView('meds')}
        />
      )}

    </div>
  )
}

export default function App() {
  return (
    <ToastProvider>
      <CasesProvider>
        <AppContent />
      </CasesProvider>
    </ToastProvider>
  )
}
