import { useCases } from '../context/CasesContext'

// Vital thresholds → "warn" or "danger" or null
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

  const bg    = level === 'danger' ? '#FDF0F2' : level === 'warn' ? '#FDF6E8' : '#F7F8FA'
  const color = level === 'danger' ? '#C7344C' : level === 'warn' ? '#B07A20' : '#1A1D27'

  return (
    <div style={{
      background: bg,
      borderRadius: 8,
      padding: '8px 10px',
      minWidth: 70,
      flex: '1 1 0',
    }}>
      <div className="vital-label">{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
        <span
          className="vital-value"
          style={{
            fontSize: '1.25rem',
            color,
            animation: level === 'danger' ? 'pulseAlert 2s ease-in-out infinite' : 'none',
          }}
        >{display}</span>
        {value != null && <span className="vital-unit">{unit}</span>}
      </div>
    </div>
  )
}

function ORCard({ orId }) {
  const { state } = useCases()
  const vitals   = state.vitals[orId] || {}
  const caseInfo = state.cases[orId]
  const hasAlert = state.alerts.some(a => a.or_id === orId && !a.acknowledged)

  const status = hasAlert ? 'alert' : caseInfo?.status === 'active' ? 'active' : 'idle'

  const borderColor = status === 'alert'  ? '#F5C5CC'
                    : status === 'active' ? '#B4CFFA'
                    : '#E4E7EE'
  const topStripe   = status === 'alert'  ? '#C7344C'
                    : status === 'active' ? '#2563EB'
                    : '#D9DCE5'

  return (
    <div
      className="card card-hover"
      style={{
        border: `1px solid ${borderColor}`,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Colour stripe at top */}
      <div style={{ height: 3, background: topStripe, borderRadius: '10px 10px 0 0' }} />

      <div style={{ padding: '12px 14px' }}>
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span className={`status-dot ${status === 'active' ? 'active' : status === 'alert' ? 'alert' : 'idle'}`} />
            <span style={{ fontWeight: 700, fontSize: '0.82rem', color: '#1A1D27', fontFamily: 'JetBrains Mono, monospace' }}>
              {orId}
            </span>
          </div>
          {hasAlert && <span className="badge badge-critical">Alert</span>}
          {!hasAlert && status === 'active' && <span className="badge badge-info">Active</span>}
          {status === 'idle' && <span style={{ fontSize: '0.68rem', color: '#B0B9CC', fontWeight: 500 }}>Idle</span>}
        </div>

        {/* Case / surgeon info */}
        <div style={{
          marginBottom: 10, paddingBottom: 10,
          borderBottom: '1px solid #EEF0F5',
          minHeight: 32,
        }}>
          {caseInfo ? (
            <>
              <div style={{ fontSize: '0.75rem', fontWeight: 500, color: '#1A1D27', marginBottom: 2 }}>
                {caseInfo.procedure_type || 'Procedure'}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#8890A4' }}>
                Dr. {caseInfo.surgeon_name || 'Unknown'}
              </div>
            </>
          ) : (
            <div style={{ fontSize: '0.72rem', color: '#B0B9CC', fontStyle: 'italic' }}>No active case</div>
          )}
        </div>

        {/* Vitals chips */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <VitalChip label="HR"   value={vitals.hr}      unit="bpm"  field="hr" />
          <VitalChip label="SBP"  value={vitals.syst_bp} unit="mmHg" field="syst_bp" />
          <VitalChip label="SpO₂" value={vitals.o2_sat}  unit="%"    field="o2_sat" />
          <VitalChip label="Temp" value={vitals.temp_c}  unit="°C"   field="temp_c" />
        </div>
      </div>
    </div>
  )
}

const OR_IDS = ['OR-1', 'OR-2', 'OR-3', 'OR-4', 'OR-5', 'OR-6']

export default function ORWall() {
  const { state } = useCases()
  const activeCt  = OR_IDS.filter(id => state.cases[id]?.status === 'active').length
  const alertCt   = state.alerts.filter(a => !a.acknowledged).length

  return (
    <section>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#1A1D27', margin: 0 }}>
            Operating Rooms
          </h2>
          <p style={{ fontSize: '0.72rem', color: '#8890A4', margin: '2px 0 0' }}>
            {activeCt} active · {alertCt} alert{alertCt !== 1 ? 's' : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ textAlign: 'center', background: '#EEF4FF', borderRadius: 8, padding: '6px 12px' }}>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: '#2563EB', fontFamily: 'JetBrains Mono, monospace' }}>{activeCt}</div>
            <div style={{ fontSize: '0.6rem', color: '#8890A4', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Active</div>
          </div>
          <div style={{ textAlign: 'center', background: alertCt > 0 ? '#FDF0F2' : '#F7F8FA', borderRadius: 8, padding: '6px 12px' }}>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: alertCt > 0 ? '#C7344C' : '#B0B9CC', fontFamily: 'JetBrains Mono, monospace' }}>{alertCt}</div>
            <div style={{ fontSize: '0.6rem', color: '#8890A4', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Alerts</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {OR_IDS.map(id => <ORCard key={id} orId={id} />)}
      </div>
    </section>
  )
}
