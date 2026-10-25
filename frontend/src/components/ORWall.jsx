import { useCases } from '../context/CasesContext'

const STATUS_COLOR = {
  active:   'border-vs-blue bg-or-active/10',
  alert:    'border-vs-red bg-or-alert/10',
  idle:     'border-vs-border bg-vs-surface',
  cleaning: 'border-vs-yellow bg-or-cleaning/10',
}

const STATUS_DOT = {
  active:   'active',
  alert:    'alert',
  idle:     'idle',
  cleaning: 'cleaning',
}

function VitalRow({ label, value, unit, warn, danger }) {
  const color = danger ? 'text-vs-red animate-pulse-alert'
               : warn  ? 'text-vs-yellow'
               : 'text-vs-text'
  return (
    <div className="flex items-baseline justify-between py-0.5">
      <span className="vital-label">{label}</span>
      <span className={`vital-value text-lg ${color}`}>
        {value ?? '—'}
        {value && <span className="vital-unit">{unit}</span>}
      </span>
    </div>
  )
}

function ORCard({ orId }) {
  const { state } = useCases()
  const vitals    = state.vitals[orId] || {}
  const caseInfo  = state.cases[orId]
  const bed       = state.beds[orId]

  const hasAlert  = state.alerts.some(a => a.or_id === orId && !a.acknowledged)
  const status    = hasAlert ? 'alert' : caseInfo?.status === 'active' ? 'active' : 'idle'

  return (
    <div className={`glass-card p-4 border-2 transition-all duration-300 ${STATUS_COLOR[status] || STATUS_COLOR.idle}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={`status-dot ${STATUS_DOT[status]}`} />
          <span className="font-semibold text-sm text-vs-text">{orId}</span>
        </div>
        {hasAlert && (
          <span className="alert-badge critical">⚠ Alert</span>
        )}
      </div>

      {/* Patient info */}
      {caseInfo ? (
        <div className="mb-3 pb-3 border-b border-vs-border">
          <p className="text-xs text-vs-muted truncate">{caseInfo.procedure_type}</p>
          <p className="text-xs text-vs-blue truncate">Dr. {caseInfo.surgeon_name}</p>
        </div>
      ) : (
        <div className="mb-3 pb-3 border-b border-vs-border">
          <p className="text-xs text-vs-muted italic">No active case</p>
        </div>
      )}

      {/* Vitals */}
      <div className="space-y-0.5">
        <VitalRow label="HR"   value={vitals.hr?.toFixed(0)}      unit="bpm" warn={vitals.hr > 100} danger={vitals.hr > 120 || vitals.hr < 45} />
        <VitalRow label="SBP"  value={vitals.syst_bp?.toFixed(0)} unit="mmHg" warn={vitals.syst_bp > 140} danger={vitals.syst_bp < 90 || vitals.syst_bp > 160} />
        <VitalRow label="DBP"  value={vitals.dias_bp?.toFixed(0)} unit="mmHg" />
        <VitalRow label="SpO₂" value={vitals.o2_sat?.toFixed(1)}  unit="%" danger={vitals.o2_sat < 90} warn={vitals.o2_sat < 95} />
        <VitalRow label="Temp" value={vitals.temp_c?.toFixed(1)}  unit="°C"  warn={vitals.temp_c > 38.5} />
      </div>
    </div>
  )
}

export default function ORWall() {
  const orIds = ['OR-1', 'OR-2', 'OR-3', 'OR-4', 'OR-5', 'OR-6']

  return (
    <section>
      <h2 className="text-lg font-semibold text-vs-text mb-3 flex items-center gap-2">
        <span>🏥</span> Operating Room Grid
      </h2>
      <div className="grid grid-cols-3 gap-3">
        {orIds.map(id => <ORCard key={id} orId={id} />)}
      </div>
    </section>
  )
}
