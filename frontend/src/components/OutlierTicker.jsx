/**
 * OutlierTicker — scrolling marquee banner that shows Cassandra-flagged anomalies
 * in real time, styled like a hospital emergency ticker.
 */
import { useCases } from '../context/CasesContext'

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

function TickerItem({ entry }) {
  const c = SEVERITY_COLORS[entry.severity] || SEVERITY_COLORS.WARNING
  const metric = METRIC_LABELS[entry.metric] || entry.metric?.toUpperCase() || 'VITAL'
  const time = new Date(entry.ts).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  })

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '2px 12px 2px 8px',
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
      <span style={{ opacity: 0.7, fontFamily: 'monospace', fontSize: '0.68rem' }}>{time}</span>
      <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{entry.or_id}</span>
      <span>·</span>
      <span>{metric}</span>
      {entry.val != null && (
        <span style={{ fontFamily: 'monospace' }}>{Number(entry.val).toFixed(1)}</span>
      )}
      <span style={{ fontWeight: 400, opacity: 0.85, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }}>
        — {entry.severity}
      </span>
    </span>
  )
}

export default function OutlierTicker() {
  const { state } = useCases()
  const log = state.outlierLog

  if (!log || log.length === 0) {
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
        <span>No anomalies detected — all vitals within clinical thresholds</span>
      </div>
    )
  }

  // Duplicate items for seamless loop
  const items = [...log, ...log]

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
          animation: `ticker-scroll ${Math.max(25, log.length * 6)}s linear infinite`,
          cursor: 'pointer',
        }}
        title="Hover to pause ticker"
      >
        {items.map((entry, i) => (
          <TickerItem key={i} entry={entry} />
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
