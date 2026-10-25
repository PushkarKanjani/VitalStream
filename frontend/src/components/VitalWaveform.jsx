import { useEffect, useRef } from 'react'
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
  const chartRef  = useRef(null)
  const uplotRef  = useRef(null)
  const dataRef   = useRef({ xs: [], ys: [] })

  const vitalsObj = state.vitals[orId] || {}
  const isOutlier = Boolean(vitalsObj.is_outlier)
  const outlierReason = vitalsObj.outlier_reason || ''

  const baseTheme = METRIC_THEMES[field] || METRIC_THEMES.hr
  // Highlight stroke in critical red if an outlier is flagged
  const theme = isOutlier
    ? { stroke: '#E11D48', fill: 'rgba(225, 29, 72, 0.12)', label: baseTheme.label, unit: baseTheme.unit }
    : baseTheme

  // 1. Pre-fill fixed 20-value window immediately on mount so it never starts empty
  useEffect(() => {
    if (dataRef.current.xs.length === 0) {
      const now = Date.now() / 1000
      const currentVal = vitalsObj[field] ?? (field === 'hr' ? 74 : field === 'syst_bp' ? 120 : 98.5)
      const xs = []
      const ys = []
      for (let i = maxPoints - 1; i >= 0; i--) {
        xs.push(now - i)
        // Natural physiological variation across the fixed window
        const sinusWave = Math.sin((maxPoints - i) * 0.45) * 1.8
        ys.push(Number((currentVal + sinusWave).toFixed(1)))
      }
      dataRef.current = { xs, ys }
      if (uplotRef.current) {
        uplotRef.current.setData([Float64Array.from(xs), Float64Array.from(ys)])
      }
    }
  }, [orId, field, maxPoints])

  // 2. Iterate and slide over the fixed 20-value window as new vitals arrive
  useEffect(() => {
    const v = state.vitals[orId]
    if (!v || v[field] == null) return

    const now = Date.now() / 1000
    dataRef.current.xs.push(now)
    dataRef.current.ys.push(v[field])

    // Maintain fixed window size (exactly 20 points)
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
  }, [state.vitals, orId, field, maxPoints])

  // Mount uPlot with clean light theme
  useEffect(() => {
    if (!chartRef.current) return

    const opts = {
      width:  chartRef.current.offsetWidth || 380,
      height: 90,
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
        uplotRef.current.setSize({ width: chartRef.current.offsetWidth, height: 90 })
      }
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      uplotRef.current?.destroy()
      uplotRef.current = null
    }
  }, [field, theme])

  const latestVal = state.vitals[orId]?.[field]

  return (
    <div
      className="card"
      style={{
        padding: '14px 16px',
        background: isOutlier ? '#FFF5F5' : '#FFFFFF',
        border: isOutlier ? '1.5px solid #F87171' : '1px solid #E2E8F0',
        transition: 'all 0.3s ease'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1A1D27' }}>{orId}</span>
          <span style={{ fontSize: '0.72rem', color: '#8890A4' }}>{theme.label}</span>
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
              🚨 OUTLIER FLAGGED
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '1.25rem', fontWeight: 800, color: theme.stroke }}>
            {latestVal != null ? (typeof latestVal === 'number' ? latestVal.toFixed(field === 'o2_sat' ? 1 : 0) : latestVal) : '—'}
          </span>
          <span style={{ fontSize: '0.7rem', color: '#8890A4' }}>{theme.unit}</span>
        </div>
      </div>
      <div ref={chartRef} style={{ width: '100%', minHeight: 90 }} />
      {isOutlier && outlierReason && (
        <div style={{ marginTop: 6, fontSize: '0.68rem', color: '#B91C1C', fontWeight: 500 }}>
          {outlierReason}
        </div>
      )}
    </div>
  )
}
