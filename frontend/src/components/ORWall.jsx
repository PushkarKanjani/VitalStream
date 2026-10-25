import { useCases } from '../context/CasesContext'
import { Activity, ShieldAlert, Heart, User, Sparkles, ExternalLink } from 'lucide-react'

function classify(field, value) {
  if (value == null) return null
  if (field === 'hr')      return value > 120 || value < 45 ? 'danger' : value > 100 ? 'warn' : null
  if (field === 'syst_bp') return value < 90  || value > 160 ? 'danger' : value > 140 ? 'warn' : null
  if (field === 'o2_sat')  return value < 90  ? 'danger' : value < 95 ? 'warn' : null
  if (field === 'temp_c')  return value > 39  ? 'danger' : value > 38.5 ? 'warn' : null
  return null
}

function VitalChip({ label, value, unit, field }) {
  const level = classify(field, value)
  const display = value != null ? (typeof value === 'number' ? value.toFixed(field === 'o2_sat' ? 1 : 0) : value) : '—'

  const bg    = level === 'danger' ? '#FEF2F2' : level === 'warn' ? '#FFFBEB' : '#F8FAFC'
  const color = level === 'danger' ? '#DC2626' : level === 'warn' ? '#D97706' : '#0F172A'
  const border = level === 'danger' ? '#FECACA' : level === 'warn' ? '#FDE68A' : '#E2E8F0'

  return (
    <div 
      className="p-2 rounded-lg border flex-1 min-w-[70px] transition-colors"
      style={{ background: bg, borderColor: border }}
    >
      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{label}</div>
      <div className="flex items-baseline gap-1">
        <span
          className="text-lg font-bold font-mono tracking-tight"
          style={{ color }}
        >
          {display}
        </span>
        {value != null && <span className="text-[10px] text-slate-400 font-medium">{unit}</span>}
      </div>
    </div>
  )
}

function ORCard({ orId, onSelect }) {
  const { state } = useCases()
  const vitals   = state.vitals[orId] || {}
  const caseInfo = state.cases[orId]
  const hasAlert = state.alerts.some(a => a.or_id === orId && !a.acknowledged)

  const status = hasAlert ? 'alert' : caseInfo?.status === 'active' ? 'active' : 'idle'

  return (
    <div
      onClick={() => onSelect(orId)}
      className="app-card app-card-interactive p-4 relative overflow-hidden group border transition-all"
      style={{
        borderColor: status === 'alert' ? '#FECACA' : status === 'active' ? '#BFDBFE' : '#E2E8F0',
      }}
    >
      {/* Top Subtle Stripe */}
      <div 
        className="absolute top-0 left-0 right-0 h-1" 
        style={{
          background: status === 'alert' ? '#EF4444' : status === 'active' ? '#2563EB' : '#CBD5E1'
        }}
      />

      {/* Header Row */}
      <div className="flex items-center justify-between mb-3 mt-1">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{
            background: status === 'alert' ? '#EF4444' : status === 'active' ? '#10B981' : '#94A3B8'
          }} />
          <span className="font-extrabold text-sm text-slate-900 font-mono tracking-tight">
            {orId}
          </span>
        </div>

        {hasAlert && (
          <span className="status-pill status-pill-danger">
            ⚠ Alert
          </span>
        )}
        {!hasAlert && status === 'active' && (
          <span className="status-pill status-pill-info">
            In Surgery
          </span>
        )}
        {status === 'idle' && (
          <span className="text-[11px] text-slate-400 font-medium">Idle</span>
        )}
      </div>

      {/* Case Demographics */}
      <div className="mb-3.5 pb-3 border-b border-slate-100 min-h-[42px] flex items-center justify-between">
        {caseInfo ? (
          <div>
            <div className="text-xs font-bold text-slate-800 line-clamp-1">
              {caseInfo.procedure_type || 'General Surgical Procedure'}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Dr. {caseInfo.surgeon_name || 'Staff Surgeon'}
            </div>
          </div>
        ) : (
          <div className="text-xs text-slate-400 italic">No scheduled case active</div>
        )}

        <ExternalLink className="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-600 transition-colors shrink-0 ml-2" />
      </div>

      {/* Real-time vitals row */}
      <div className="flex gap-2 flex-wrap">
        <VitalChip label="HR"   value={vitals.hr}      unit="bpm"  field="hr" />
        <VitalChip label="SBP"  value={vitals.syst_bp} unit="mmHg" field="syst_bp" />
        <VitalChip label="SpO₂" value={vitals.o2_sat}  unit="%"    field="o2_sat" />
        <VitalChip label="Temp" value={vitals.temp_c}  unit="°C"   field="temp_c" />
      </div>

      {/* Footer click hint */}
      <div className="mt-3 pt-2 text-[10px] text-slate-400 text-right group-hover:text-blue-600 font-medium transition-colors">
        Click to inspect dossier →
      </div>
    </div>
  )
}

const OR_IDS = ['OR-1', 'OR-2', 'OR-3', 'OR-4', 'OR-5', 'OR-6']

export default function ORWall({ onSelectOr }) {
  const { state } = useCases()
  const activeCount = OR_IDS.filter(id => state.cases[id]?.status === 'active').length
  const alertCount  = state.alerts.filter(a => !a.acknowledged).length

  return (
    <section>
      {/* Wall Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <span>Operating Room Suite</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
              6 Active Suites
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time intraoperative telemetry and vital status
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-xs font-semibold text-blue-700">
            <span>{activeCount} In Procedure</span>
          </div>
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold ${
            alertCount > 0 
              ? 'bg-rose-50 border-rose-200 text-rose-700' 
              : 'bg-emerald-50 border-emerald-200 text-emerald-700'
          }`}>
            <span>{alertCount} Critical Alerts</span>
          </div>
        </div>
      </div>

      {/* OR Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {OR_IDS.map(id => (
          <ORCard 
            key={id} 
            orId={id} 
            onSelect={onSelectOr} 
          />
        ))}
      </div>
    </section>
  )
}
