import { useEffect, useRef, useState } from 'react'
import { useCases } from '../context/CasesContext'
import uPlot from 'uplot'
import 'uplot/dist/uPlot.min.css'

const METRIC_THEMES = {
  hr:      { stroke: '#2563EB', fill: 'rgba(37, 99, 235, 0.08)',  label: 'Heart Rate',    unit: 'bpm' },
  syst_bp: { stroke: '#C7344C', fill: 'rgba(199, 52, 76, 0.08)',  label: 'Systolic BP',   unit: 'mmHg' },
  o2_sat:  { stroke: '#2D9B6F', fill: 'rgba(45, 155, 111, 0.08)', label: 'Oxygen (SpO₂)', unit: '%' },
}

export default function VitalWaveform({ orId, field = 'hr', maxPoints = 20 }) {
  const { state } = useCases()
  const [currentMetric, setCurrentMetric] = useState(field)

  const chartRef  = useRef(null)
  const uplotRef  = useRef(null)
  const dataRef   = useRef({ xs: [], ys: [] })

  const vitalsObj = state.vitals[orId] || {}
  const isOutlier = Boolean(vitalsObj.is_outlier)
  const outlierReason = vitalsObj.outlier_reason || ''

  // Active alerts for this room
  const activeAlert = state.alerts.find(a => a.or_id === orId && !a.acknowledged)

  const baseTheme = METRIC_THEMES[currentMetric] || METRIC_THEMES.hr
  // Highlight stroke in critical rose if an outlier or alert is active
  const hasCritical = isOutlier || (activeAlert && activeAlert.severity === 'critical')
  const theme = hasCritical
    ? { stroke: '#E11D48', fill: 'rgba(225, 29, 72, 0.12)', label: baseTheme.label, unit: baseTheme.unit }
    : baseTheme

  // Reset data on metric switch or mount
  useEffect(() => {
    const now = Date.now() / 1000
    const fallbackVal = currentMetric === 'hr' ? 74 : currentMetric === 'syst_bp' ? 120 : 98.5
    const currentVal = vitalsObj[currentMetric] ?? fallbackVal
    const xs = []
    const ys = []
    for (let i = maxPoints - 1; i >= 0; i--) {
      xs.push(now - i)
      const sinusWave = Math.sin((maxPoints - i) * 0.45) * 1.5
      ys.push(Number((currentVal + sinusWave).toFixed(1)))
    }
    dataRef.current = { xs, ys }
    if (uplotRef.current) {
      uplotRef.current.setData([Float64Array.from(xs), Float64Array.from(ys)])
    }
  }, [currentMetric, orId, maxPoints])

  // Slide fixed 20-value window as vitals stream arrives
  useEffect(() => {
    const v = state.vitals[orId]
    if (!v || v[currentMetric] == null) return

    const now = Date.now() / 1000
    dataRef.current.xs.push(now)
    dataRef.current.ys.push(v[currentMetric])

    // Maintain fixed window size (exactly maxPoints)
    while (dataRef.current.xs.length > maxPoints) {
      dataRef.current.xs.shift()
      dataRef.current.ys.shift()
    }

    if (uplotRef.current) {
      uplotRef.current.setData([
        Float64Array.from(dataRef.current.xs),
        Float64Array.from(dataRef.current.ys),
      ])
    }
  }, [state.vitals, orId, currentMetric, maxPoints])

  // Mount uPlot
  useEffect(() => {
    if (!chartRef.current) return

    const opts = {
      width:  chartRef.current.offsetWidth || 380,
      height: 95,
      cursor: { show: false },
      legend: { show: false },
      scales: { x: { time: true }, y: { auto: true } },
      axes: [
        { show: false },
        {
          stroke: '#8890A4',
          size:  36,
          ticks: { show: false },
          grid:  { stroke: '#EEF0F5', width: 1 },
          font:  '11px Inter, sans-serif',
        }
      ],
      series: [
        {},
        {
          stroke: theme.stroke,
          width:  2,
          fill:   theme.fill,
        }
      ],
    }

    uplotRef.current = new uPlot(opts, [
      Float64Array.from(dataRef.current.xs),
      Float64Array.from(dataRef.current.ys)
    ], chartRef.current)

    const handleResize = () => {
      if (uplotRef.current && chartRef.current) {
        uplotRef.current.setSize({ width: chartRef.current.offsetWidth, height: 95 })
      }
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      uplotRef.current?.destroy()
      uplotRef.current = null
    }
  }, [currentMetric, theme])

  const latestVal = state.vitals[orId]?.[currentMetric]

  return (
    <div
      className="card"
      style={{
        padding: '14px 16px',
        background: isOutlier ? '#FFF5F5' : activeAlert ? '#FFFBEB' : '#FFFFFF',
        border: isOutlier ? '1.5px solid #F87171' : activeAlert ? '1.5px solid #FCD34D' : '1px solid #E2E8F0',
        transition: 'all 0.3s ease',
        borderRadius: 12,
      }}
    >
      {/* Top Header Row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#1A1D27', fontFamily: 'monospace' }}>{orId}</span>

          {/* Metric Selector Buttons */}
          <div style={{ display: 'flex', background: '#F1F5F9', borderRadius: 6, padding: 2, gap: 2 }}>
            {[
              { id: 'hr', label: 'HR' },
              { id: 'syst_bp', label: 'SBP' },
              { id: 'o2_sat', label: 'SpO₂' },
            ].map(m => (
              <button
                key={m.id}
                onClick={() => setCurrentMetric(m.id)}
                style={{
                  padding: '1px 7px',
                  borderRadius: 4,
                  fontSize: '0.65rem',
                  fontWeight: currentMetric === m.id ? 700 : 500,
                  background: currentMetric === m.id ? '#FFFFFF' : 'transparent',
                  color: currentMetric === m.id ? '#0F172A' : '#64748B',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: currentMetric === m.id ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                }}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Outlier Tag */}
          {isOutlier && (
            <span
              title={outlierReason}
              style={{
                background: '#FEE2E2',
                color: '#DC2626',
                border: '1px solid #FCA5A5',
                padding: '2px 7px',
                borderRadius: 999,
                fontSize: '0.65rem',
                fontWeight: 700,
                letterSpacing: '0.02em',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
                animation: 'pulse 1.8s infinite'
              }}
            >
              🚨 CASSANDRA OUTLIER
            </span>
          )}

          {/* Active Alert Pill */}
          {activeAlert && (
            <span
              style={{
                background: activeAlert.severity === 'critical' ? '#FEE2E2' : '#FEF3C7',
                color: activeAlert.severity === 'critical' ? '#B91C1C' : '#B45309',
                border: `1px solid ${activeAlert.severity === 'critical' ? '#FCA5A5' : '#FDE68A'}`,
                padding: '2px 7px',
                borderRadius: 999,
                fontSize: '0.65rem',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
              }}
            >
              ⚠ {activeAlert.alert_type} ({activeAlert.severity.toUpperCase()})
            </span>
          )}
        </div>

        {/* Live Value Display */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '1.3rem', fontWeight: 800, color: theme.stroke }}>
            {latestVal != null ? (typeof latestVal === 'number' ? latestVal.toFixed(currentMetric === 'o2_sat' ? 1 : 0) : latestVal) : '—'}
          </span>
          <span style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 600 }}>{theme.unit}</span>
        </div>
      </div>

      {/* Chart Canvas */}
      <div ref={chartRef} style={{ width: '100%', minHeight: 95 }} />

      {/* Outlier / Alert Description Footer */}
      {(isOutlier && outlierReason) ? (
        <div style={{ marginTop: 6, fontSize: '0.68rem', color: '#B91C1C', fontWeight: 600 }}>
          {outlierReason}
        </div>
      ) : activeAlert ? (
        <div style={{ marginTop: 6, fontSize: '0.68rem', color: '#B45309', fontWeight: 500 }}>
          Active Alert: {activeAlert.message}
        </div>
      ) : null}
    </div>
  )
}
