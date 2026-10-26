import { useCases } from '../context/CasesContext'
import { METRIC_RULES, classifyMetric } from '../config/outlierRules'
import { Activity, ShieldAlert, Heart, ExternalLink } from 'lucide-react'

function VitalChip({ label, value, unit, field, isOutlier }) {
  const classification = classifyMetric(field, value)
  const isDanger = isOutlier || classification?.level === 'danger'
  const isWarn = classification?.level === 'warn'

  const display = value != null ? (typeof value === 'number' ? value.toFixed(field === 'o2_sat' || field === 'temp_c' ? 1 : 0) : value) : '—'

  const bg    = isDanger ? '#FEF2F2' : isWarn ? '#FFFBEB' : '#F8FAFC'
  const color = isDanger ? '#DC2626' : isWarn ? '#D97706' : '#0F172A'
  const border = isDanger ? '#FECACA' : isWarn ? '#FDE68A' : '#E2E8F0'

  return (
    <div
      className="p-2 rounded-lg border flex-1 min-w-[70px] transition-colors"
      style={{ background: bg, borderColor: border }}
    >
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</span>
        {isDanger && <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse" />}
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-lg font-bold font-mono tracking-tight" style={{ color }}>
          {display}
        </span>
        {value != null && <span className="text-[10px] text-slate-400 font-medium">{unit}</span>}
      </div>
    </div>
  )
}

/** Tiny inline SVG sparkline for vital history */
function MetricSparkline({ data = [], metric = 'hr', isOutlier = false }) {
  if (!data || data.length < 2) {
    return (
      <div style={{ height: 28, display: 'flex', alignItems: 'center' }}>
        <span style={{ fontSize: '0.65rem', color: '#94A3B8' }}>collecting…</span>
      </div>
    )
  }

  const W = 120, H = 28
  const clean = data.filter(v => v != null)
  if (clean.length < 2) return null

  const min = Math.min(...clean) - 2
  const max = Math.max(...clean) + 2
  const range = max - min || 1

  const pts = clean.map((v, i) => {
    const x = (i / (clean.length - 1)) * W
    const y = H - ((v - min) / range) * H
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })

  const polyline = pts.join(' ')

  const firstX = 0
  const lastX  = W
  const area = `${firstX.toFixed(1)},${H} ${polyline} ${lastX.toFixed(1)},${H}`

  const strokeColor = isOutlier ? '#DC2626' : metric === 'syst_bp' ? '#0284C7' : metric === 'o2_sat' ? '#059669' : '#2563EB'
  const fillColor   = isOutlier ? '#FEF2F2' : metric === 'syst_bp' ? '#F0F9FF' : metric === 'o2_sat' ? '#ECFDF5' : '#EFF6FF'

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
      <polygon points={area} fill={fillColor} opacity="0.6" />
      <polyline
        points={polyline}
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={parseFloat(pts[pts.length - 1].split(',')[0])}
        cy={parseFloat(pts[pts.length - 1].split(',')[1])}
        r="2.2"
        fill={strokeColor}
      />
    </svg>
  )
}

function ORCard({ orId, onSelect }) {
  const { state } = useCases()
  const vitals     = state.vitals[orId] || {}
  const caseInfo   = state.cases[orId]
  const hasAlert   = state.alerts.some(a => a.or_id === orId && !a.acknowledged)

  // Outliers specifically for this room
  const orActiveOutliers = (state.activeOutliers || []).filter(o => o.or_id === orId)
  const topOutlier = orActiveOutliers[0] || (vitals.is_outlier ? {
    metric: vitals.metric || 'syst_bp',
    value: vitals.val ?? vitals.syst_bp ?? 70.0,
    unit: vitals.unit || 'mmHg',
    rule: vitals.rule || 'THRESHOLD',
    expected_low: vitals.expected_low ?? 75.0,
    expected_high: vitals.expected_high ?? 180.0,
    z_score: vitals.z_score,
    severity: vitals.severity || 'CRITICAL'
  } : null)

  const activeMetric = topOutlier ? topOutlier.metric : 'hr'
  const histSource = state.vitalsHistory[orId]
  const historyData = histSource?.[activeMetric] || (Array.isArray(histSource) ? histSource : [])

  let outlierText = ''
  if (topOutlier) {
    const mLabel = METRIC_RULES[topOutlier.metric]?.label || topOutlier.metric.toUpperCase()
    const valStr = typeof topOutlier.value === 'number' ? topOutlier.value.toFixed(1) : topOutlier.value
    const unitStr = topOutlier.unit || METRIC_RULES[topOutlier.metric]?.unit || ''
    if (topOutlier.rule === 'STATISTICAL') {
      outlierText = `${mLabel} ${valStr} ${unitStr} | z = ${(topOutlier.z_score || 0).toFixed(1)} | STATISTICAL`
    } else if (topOutlier.rule === 'ARTIFACT') {
      outlierText = `${mLabel} ${valStr} ${unitStr} | SENSOR CHECK | ARTIFACT`
    } else {
      const comp = topOutlier.value < topOutlier.expected_low
        ? `below ${topOutlier.expected_low}`
        : `above ${topOutlier.expected_high}`
      outlierText = `${mLabel} ${valStr} ${unitStr} | ${comp} | THRESHOLD`
    }
  }

  // Red card border is ONLY for clinical alerts, not normal or outlier-only rooms
  const status = hasAlert ? 'alert' : caseInfo?.status === 'active' ? 'active' : 'idle'

  const DEFAULT_OR_CASES = {
    'OR-1': { procedure: 'Coronary Artery Bypass Graft (CABG)', surgeon: 'Dr. Aditi Sharma' },
    'OR-2': { procedure: 'Laparoscopic Cholecystectomy', surgeon: 'Dr. Rajesh Kulkarni' },
    'OR-3': { procedure: 'Total Hip Arthroplasty', surgeon: 'Dr. Anjali Mehta' },
    'OR-4': { procedure: 'Craniotomy for Subdural Hematoma', surgeon: 'Dr. Rohan Gupta' },
    'OR-5': { procedure: 'Emergency Exploratory Laparotomy', surgeon: 'Dr. Vivek Menon' },
    'OR-6': { procedure: 'Video-Assisted Thoracoscopic Surgery (VATS)', surgeon: 'Dr. Suresh Nambiar' }
  }
  const defaultInfo = DEFAULT_OR_CASES[orId] || { procedure: 'General Surgical Procedure', surgeon: 'Dr. Aditi Sharma' }
  const rawSurgeon = caseInfo?.primary_surgeon || caseInfo?.surgeon_name || defaultInfo.surgeon
  const cleanSurgeon = rawSurgeon.replace(/^Dr\.\s*/i, '').replace(/\s*\(Chief Surgeon\)/i, '')
  const procName = caseInfo?.procedure_name || caseInfo?.procedure_type || defaultInfo.procedure

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
          <span className="status-pill status-pill-danger">⚠ Alert</span>
        )}
        {!hasAlert && status === 'active' && (
          <span className="status-pill status-pill-info">In Surgery</span>
        )}
        {status === 'idle' && (
          <span className="text-[11px] text-slate-400 font-medium">Idle</span>
        )}
      </div>

      {/* Case Demographics with Chief Surgeon */}
      <div className="mb-3 pb-3 border-b border-slate-100 min-h-[40px] flex items-center justify-between">
        <div>
          <div className="text-xs font-bold text-slate-800 line-clamp-1">
            {procName}
          </div>
          <div className="text-[11px] text-slate-600 mt-0.5 flex items-center gap-1">
            <span className="font-semibold text-blue-600">Chief Surgeon:</span>
            <span className="font-medium text-slate-700">Dr. {cleanSurgeon}</span>
          </div>
        </div>
        <ExternalLink className="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-600 transition-colors shrink-0 ml-2" />
      </div>

      {/* Flagged Outlier Alert Banner */}
      {topOutlier && (
        <div className="mb-2.5 px-2.5 py-1.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-[10px] font-semibold flex items-center justify-between animate-pulse">
          <div className="flex items-center gap-1.5 truncate">
            <span className="shrink-0">🚨</span>
            <span className="truncate">{outlierText}</span>
          </div>
          {orActiveOutliers.length > 1 && (
            <span className="text-[9px] bg-rose-200 text-rose-800 px-1.5 py-0.5 rounded font-bold shrink-0 ml-1">
              +{orActiveOutliers.length - 1} more
            </span>
          )}
        </div>
      )}

      {/* Vital Chips - only outlying chips are styled in danger red */}
      <div className="flex gap-2 flex-wrap">
        <VitalChip
          label="HR"
          value={vitals.hr}
          unit="bpm"
          field="hr"
          isOutlier={orActiveOutliers.some(o => o.metric === 'hr')}
        />
        <VitalChip
          label="SBP"
          value={vitals.syst_bp}
          unit="mmHg"
          field="syst_bp"
          isOutlier={orActiveOutliers.some(o => o.metric === 'syst_bp') || (vitals.is_outlier && (vitals.metric === 'syst_bp' || !vitals.metric))}
        />
        <VitalChip
          label="SpO₂"
          value={vitals.o2_sat}
          unit="%"
          field="o2_sat"
          isOutlier={orActiveOutliers.some(o => o.metric === 'o2_sat')}
        />
        <VitalChip
          label="Temp"
          value={vitals.temp_c}
          unit="°C"
          field="temp_c"
          isOutlier={orActiveOutliers.some(o => o.metric === 'temp_c')}
        />
      </div>

      {/* Sparkline for active/focused metric */}
      <div className="mt-3 pt-2 border-t border-slate-100">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
            {activeMetric === 'syst_bp' ? 'SBP Trend' : activeMetric === 'o2_sat' ? 'SpO₂ Trend' : 'HR Trend'}
          </span>
          <span className="text-[9px] text-slate-400 font-mono">{historyData.length}/20 pts</span>
        </div>
        <MetricSparkline
          data={historyData}
          metric={activeMetric}
          isOutlier={Boolean(topOutlier)}
        />
      </div>

      {/* Footer */}
      <div className="mt-2 text-[10px] text-slate-400 text-right group-hover:text-blue-600 font-medium transition-colors">
        Click to view details →
      </div>
    </div>
  )
}

const OR_IDS = ['OR-1', 'OR-2', 'OR-3', 'OR-4', 'OR-5', 'OR-6']

export default function ORWall({ onSelectOr }) {
  const { state } = useCases()
  const activeCount = OR_IDS.filter(id => state.cases[id]?.status === 'active').length
  const alertCount  = state.alerts.filter(a => !a.acknowledged).length
  const outlierCount = OR_IDS.filter(id => state.vitals[id]?.is_outlier).length

  return (
    <section>
      {/* Wall Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <span>Operating Rooms</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
              6 Rooms
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Live patient vital signs, HR sparklines, and Cassandra anomaly flags
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-xs font-semibold text-blue-700">
            {activeCount} Active
          </div>
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold ${
            alertCount > 0
              ? 'bg-rose-50 border-rose-200 text-rose-700'
              : 'bg-emerald-50 border-emerald-200 text-emerald-700'
          }`}>
            {alertCount} Alerts
          </div>
          {outlierCount > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-xs font-semibold text-amber-700 animate-pulse">
              🚨 {outlierCount} Outlier{outlierCount > 1 ? 's' : ''}
            </div>
          )}
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
