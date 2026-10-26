/**
 * OutlierTicker — scrolling marquee banner that shows Cassandra-flagged anomalies
 * in real time, styled like a hospital emergency ticker.
 */
import { useEffect, useState } from 'react'
import { useCases } from '../context/CasesContext'
import { METRIC_RULES } from '../config/outlierRules'
import { formatUtcTime } from '../utils/timeFormat'

const SEVERITY_COLORS = {
  CRITICAL: { bg: '#FEF2F2', border: '#FCA5A5', text: '#DC2626', dot: '#EF4444' },
  WARNING:  { bg: '#FFFBEB', border: '#FCD34D', text: '#D97706', dot: '#F59E0B' },
}

const METRIC_LABELS = {
  hr:       'HR',
  syst_bp:  'SBP',
  dias_bp:  'DBP',
  o2_sat:   'SpO₂',
  temp_c:   'Temp',
  etco2:    'EtCO₂',
}

function TickerItem({ entry, nowMs }) {
  const c = SEVERITY_COLORS[entry.severity] || SEVERITY_COLORS.CRITICAL
  const metric = METRIC_LABELS[entry.metric] || entry.metric?.toUpperCase() || 'VITAL'
  const unit = entry.unit || METRIC_RULES[entry.metric]?.unit || ''
  const rawNum = entry.value != null ? entry.value : entry.val
  const valStr = rawNum != null ? (typeof rawNum === 'number' ? rawNum.toFixed(1) : rawNum) : ''
  
  // Format with shared time-format util using UTC timestamp
  const timeInfo = formatUtcTime(entry.ts_utc_ms || entry.ts)

  // Required format: OR-2 | SBP 70.0 mmHg | CRITICAL | 12s ago
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '3px 12px 3px 8px',
        marginRight: 24,
        background: c.bg,
        border: `1px solid ${c.border}`,
        borderRadius: 6,
        whiteSpace: 'nowrap',
        fontSize: '0.72rem',
        fontWeight: 600,
        color: c.text,
        flexShrink: 0,
      }}
    >
      <span style={{
        width: 7, height: 7, borderRadius: '50%',
        background: c.dot, display: 'inline-block', flexShrink: 0
      }} />
      <span style={{ fontFamily: 'monospace', fontWeight: 800 }}>{entry.or_id}</span>
      <span style={{ opacity: 0.5 }}>|</span>
      <span style={{ fontFamily: 'monospace' }}>
        {metric} {valStr} {unit}
      </span>
      <span style={{ opacity: 0.5 }}>|</span>
      <span style={{ fontWeight: 700 }}>{entry.severity || 'CRITICAL'}</span>
      <span style={{ opacity: 0.5 }}>|</span>
      <span style={{ opacity: 0.85, fontFamily: 'monospace', fontSize: '0.68rem' }}>
        {timeInfo.relativeAgo}
      </span>
    </span>
  )
}

export default function OutlierTicker() {
  const { state } = useCases()
  // P5: Source = active outliers only
  const activeList = state.activeOutliers || []

  // Timer to keep relative time ("ago") updating smoothly every second
  const [nowMs, setNowMs] = useState(Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  if (!activeList || activeList.length === 0) {
    return (
      <div style={{
        background: '#F8FAFC',
        borderTop: '1px solid #E2E8F0',
        borderBottom: '1px solid #E2E8F0',
        padding: '5px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        fontSize: '0.72rem',
        color: '#94A3B8',
        fontWeight: 500,
        overflow: 'hidden',
      }}>
        <span style={{ flexShrink: 0, fontWeight: 700, color: '#64748B', fontSize: '0.68rem', letterSpacing: '0.05em' }}>
          🔍 CASSANDRA OUTLIERS
        </span>
        <span>No active clinical outliers detected — all vitals within normal expected bounds</span>
      </div>
    )
  }

  // Duplicate items for seamless continuous marquee loop
  const items = [...activeList, ...activeList]

  return (
    <div style={{
      background: 'linear-gradient(90deg, #0F172A 0%, #1E293B 100%)',
      borderTop: '1px solid #334155',
      borderBottom: '1px solid #334155',
      padding: '5px 0',
      display: 'flex',
      alignItems: 'center',
      overflow: 'hidden',
      position: 'relative',
    }}>
      {/* Label */}
      <div style={{
        flexShrink: 0,
        padding: '0 14px',
        fontSize: '0.65rem',
        fontWeight: 800,
        color: '#F87171',
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        borderRight: '1px solid #334155',
        marginRight: 12,
        whiteSpace: 'nowrap',
        zIndex: 2,
        background: 'linear-gradient(90deg, #0F172A 80%, transparent)',
      }}>
        🚨 CASSANDRA<br />
        <span style={{ color: '#94A3B8', fontWeight: 600 }}>OUTLIERS</span>
      </div>

      {/* Scrolling strip with pause on hover */}
      <div
        className="ticker-track"
        style={{
          animation: `ticker-scroll ${Math.max(25, activeList.length * 6)}s linear infinite`,
          cursor: 'pointer',
        }}
        title="Hover to pause ticker"
      >
        {items.map((entry, i) => (
          <TickerItem key={`${entry.or_id}-${entry.metric}-${i}`} entry={entry} nowMs={nowMs} />
        ))}
      </div>

      {/* Right fade */}
      <div style={{
        position: 'absolute',
        right: 0,
        top: 0,
        bottom: 0,
        width: 60,
        background: 'linear-gradient(90deg, transparent, #1E293B)',
        pointerEvents: 'none',
        zIndex: 2,
      }} />
    </div>
  )
}
