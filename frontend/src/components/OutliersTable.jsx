/**
 * OutliersTable — Cassandra Outliers sub-tab.
 * Shows:
 *   1. Per-OR outlier heatmap (count grid by OR × metric)
 *   2. Severity breakdown mini bar-chart
 *   3. Full scrollable table of all flagged anomalies
 */
import { useCases } from '../context/CasesContext'
import { AlertTriangle, ShieldAlert, Activity } from 'lucide-react'

const OR_IDS  = ['OR-1','OR-2','OR-3','OR-4','OR-5','OR-6']
const METRICS = ['hr','syst_bp','o2_sat','temp_c','etco2']
const METRIC_LABELS = {
  hr: 'HR', syst_bp: 'SBP', o2_sat: 'SpO₂', temp_c: 'Temp', etco2: 'EtCO₂',
}

const SEV_COLORS = {
  CRITICAL: { bg: '#FEF2F2', text: '#DC2626', border: '#FECACA', bar: '#EF4444' },
  WARNING:  { bg: '#FFFBEB', text: '#D97706', border: '#FDE68A', bar: '#F59E0B' },
}

function HeatCell({ count, max }) {
  if (count === 0) {
    return (
      <td style={{ padding: '6px 8px', textAlign: 'center', color: '#CBD5E1', fontSize: '0.72rem' }}>
        —
      </td>
    )
  }
  const intensity = max > 0 ? count / max : 0
  const bg = `rgba(239,68,68,${0.1 + intensity * 0.75})`
  const textColor = intensity > 0.5 ? '#fff' : '#DC2626'
  return (
    <td style={{
      padding: '6px 8px',
      textAlign: 'center',
      background: bg,
      borderRadius: 4,
      fontWeight: 700,
      fontSize: '0.72rem',
      color: textColor,
      transition: 'background 0.4s',
    }}>
      {count}
    </td>
  )
}

function HeatmapGrid({ log }) {
  // Build count[orId][metric]
  const counts = {}
  OR_IDS.forEach(or => {
    counts[or] = {}
    METRICS.forEach(m => { counts[or][m] = 0 })
  })
  log.forEach(e => {
    if (counts[e.or_id] && e.metric in counts[e.or_id]) {
      counts[e.or_id][e.metric]++
    }
  })

  // Global max for intensity scaling
  let maxVal = 1
  OR_IDS.forEach(or => METRICS.forEach(m => { maxVal = Math.max(maxVal, counts[or][m]) }))

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '3px', marginBottom: 0 }}>
        <thead>
          <tr>
            <th style={{ fontSize: '0.68rem', color: '#94A3B8', fontWeight: 700, padding: '4px 8px', textAlign: 'left' }}>
              OR ↓ / Metric →
            </th>
            {METRICS.map(m => (
              <th key={m} style={{ fontSize: '0.68rem', color: '#64748B', fontWeight: 700, padding: '4px 8px', textAlign: 'center' }}>
                {METRIC_LABELS[m]}
              </th>
            ))}
            <th style={{ fontSize: '0.68rem', color: '#64748B', fontWeight: 700, padding: '4px 8px', textAlign: 'center' }}>
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {OR_IDS.map(or => {
            const rowTotal = METRICS.reduce((s, m) => s + counts[or][m], 0)
            return (
              <tr key={or}>
                <td style={{ fontSize: '0.75rem', fontWeight: 700, fontFamily: 'monospace', color: '#1E293B', padding: '4px 8px' }}>
                  {or}
                </td>
                {METRICS.map(m => (
                  <HeatCell key={m} count={counts[or][m]} max={maxVal} />
                ))}
                <td style={{
                  padding: '4px 8px',
                  textAlign: 'center',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  color: rowTotal > 0 ? '#1E293B' : '#CBD5E1',
                }}>
                  {rowTotal > 0 ? rowTotal : '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function SeverityBars({ log }) {
  const critCount = log.filter(e => e.severity === 'CRITICAL').length
  const warnCount = log.filter(e => e.severity === 'WARNING').length
  const total = critCount + warnCount || 1

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {[
        { label: 'CRITICAL', count: critCount, ...SEV_COLORS.CRITICAL },
        { label: 'WARNING',  count: warnCount, ...SEV_COLORS.WARNING  },
      ].map(({ label, count, bar, text, bg }) => (
        <div key={label}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
            <span style={{ fontSize: '0.68rem', fontWeight: 700, color: text }}>{label}</span>
            <span style={{ fontSize: '0.68rem', fontWeight: 600, color: '#64748B' }}>{count} events</span>
          </div>
          <div style={{ background: '#F1F5F9', borderRadius: 4, height: 8, overflow: 'hidden' }}>
            <div style={{
              width: `${(count / total) * 100}%`,
              height: '100%',
              background: bar,
              borderRadius: 4,
              transition: 'width 0.6s cubic-bezier(0.16,1,0.3,1)',
            }} />
          </div>
        </div>
      ))}
      <div style={{ fontSize: '0.65rem', color: '#94A3B8', marginTop: 2 }}>
        {log.length} total flagged events in this session
      </div>
    </div>
  )
}

function OutlierRow({ entry, index }) {
  const c = SEV_COLORS[entry.severity] || SEV_COLORS.WARNING
  const metric = METRIC_LABELS[entry.metric] || entry.metric?.toUpperCase() || '—'
  const time = new Date(entry.ts).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  })

  return (
    <tr style={{ background: index % 2 === 0 ? '#FFFFFF' : '#FAFBFD' }}>
      <td style={{ padding: '7px 12px', fontSize: '0.72rem', fontFamily: 'monospace', color: '#64748B', whiteSpace: 'nowrap' }}>
        {time}
      </td>
      <td style={{ padding: '7px 12px', fontSize: '0.75rem', fontWeight: 700, fontFamily: 'monospace', color: '#0F172A' }}>
        {entry.or_id}
      </td>
      <td style={{ padding: '7px 12px' }}>
        <span style={{
          display: 'inline-block',
          padding: '1px 8px',
          borderRadius: 4,
          background: '#EFF6FF',
          color: '#1D4ED8',
          fontSize: '0.68rem',
          fontWeight: 700,
          fontFamily: 'monospace',
        }}>
          {metric}
        </span>
      </td>
      <td style={{ padding: '7px 12px', fontSize: '0.72rem', fontWeight: 700, fontFamily: 'monospace', color: '#0F172A' }}>
        {entry.val != null ? Number(entry.val).toFixed(1) : '—'}
      </td>
      <td style={{ padding: '7px 12px' }}>
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '2px 8px',
          borderRadius: 9999,
          background: c.bg,
          border: `1px solid ${c.border}`,
          fontSize: '0.65rem',
          fontWeight: 700,
          color: c.text,
          whiteSpace: 'nowrap',
        }}>
          {entry.severity === 'CRITICAL' ? '🔴' : '🟡'} {entry.severity}
        </span>
      </td>
      <td style={{
        padding: '7px 12px',
        fontSize: '0.7rem',
        color: '#475569',
        maxWidth: 300,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {entry.reason}
      </td>
    </tr>
  )
}

export default function OutliersTable() {
  const { state } = useCases()
  const log = state.outlierLog

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShieldAlert size={18} color="#EF4444" />
            Cassandra Outlier Log
          </h2>
          <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: '#64748B' }}>
            Real-time anomalies flagged by WindowOutlierDetector across all ORs
          </p>
        </div>
        <span style={{
          padding: '4px 12px',
          borderRadius: 6,
          background: log.length > 0 ? '#FEF2F2' : '#F0FDF4',
          border: `1px solid ${log.length > 0 ? '#FCA5A5' : '#86EFAC'}`,
          fontSize: '0.72rem',
          fontWeight: 700,
          color: log.length > 0 ? '#DC2626' : '#16A34A',
        }}>
          {log.length > 0 ? `${log.length} Anomalies Detected` : 'All Clear'}
        </span>
      </div>

      {log.length === 0 ? (
        <div className="app-card" style={{ padding: 32, textAlign: 'center', color: '#94A3B8' }}>
          <Activity size={32} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
          <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>No outliers detected yet</div>
          <div style={{ fontSize: '0.75rem', marginTop: 4 }}>
            Cassandra outlier events will appear here as they stream in from OR-4, OR-5, OR-6
          </div>
        </div>
      ) : (
        <>
          {/* Analytics row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 16 }}>

            {/* Heatmap */}
            <div className="app-card" style={{ padding: '14px 16px' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1E293B', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>📊</span> Outlier Heatmap by OR × Metric
              </div>
              <HeatmapGrid log={log} />
            </div>

            {/* Severity breakdown */}
            <div className="app-card" style={{ padding: '14px 16px', minWidth: 200 }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1E293B', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>📈</span> Severity Breakdown
              </div>
              <SeverityBars log={log} />
            </div>

          </div>

          {/* Full table */}
          <div className="app-card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1E293B' }}>
                All Flagged Events — most recent first
              </span>
              <span style={{ fontSize: '0.68rem', color: '#94A3B8' }}>
                Showing {log.length} of last 100
              </span>
            </div>
            <div style={{ overflowX: 'auto', maxHeight: 380, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ position: 'sticky', top: 0, background: '#F8FAFC', zIndex: 1 }}>
                  <tr>
                    {['Time','OR','Metric','Value','Severity','Reason'].map(h => (
                      <th key={h} style={{
                        padding: '8px 12px',
                        textAlign: 'left',
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        color: '#64748B',
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        borderBottom: '1px solid #E2E8F0',
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {log.map((entry, i) => <OutlierRow key={i} entry={entry} index={i} />)}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
