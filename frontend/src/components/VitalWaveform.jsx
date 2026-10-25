import { useEffect, useRef } from 'react'
import { useCases } from '../context/CasesContext'
import uPlot from 'uplot'
import 'uplot/dist/uPlot.min.css'

const METRIC_THEMES = {
  hr:      { stroke: '#2563EB', fill: 'rgba(37, 99, 235, 0.08)',  label: 'Heart Rate',    unit: 'bpm' },
  syst_bp: { stroke: '#C7344C', fill: 'rgba(199, 52, 76, 0.08)',  label: 'Systolic BP',   unit: 'mmHg' },
  o2_sat:  { stroke: '#2D9B6F', fill: 'rgba(45, 155, 111, 0.08)', label: 'Oxygen (SpO₂)', unit: '%' },
}

export default function VitalWaveform({ orId, field = 'hr', maxPoints = 120 }) {
  const { state } = useCases()
  const chartRef  = useRef(null)
  const uplotRef  = useRef(null)
  const dataRef   = useRef({ xs: [], ys: [] })

  const theme = METRIC_THEMES[field] || METRIC_THEMES.hr

  // Append new vitals as they arrive
  useEffect(() => {
    const v = state.vitals[orId]
    if (!v || v[field] == null) return

    const now = Date.now() / 1000
    dataRef.current.xs.push(now)
    dataRef.current.ys.push(v[field])

    if (dataRef.current.xs.length > maxPoints) {
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

    uplotRef.current = new uPlot(opts, [new Float64Array(), new Float64Array()], chartRef.current)

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
    <div className="card" style={{ padding: '14px 16px', background: '#FFFFFF' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1A1D27' }}>{orId}</span>
          <span style={{ fontSize: '0.72rem', color: '#8890A4', marginLeft: 8 }}>{theme.label}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '1.2rem', fontWeight: 700, color: theme.stroke }}>
            {latestVal != null ? (typeof latestVal === 'number' ? latestVal.toFixed(field === 'o2_sat' ? 1 : 0) : latestVal) : '—'}
          </span>
          <span style={{ fontSize: '0.7rem', color: '#8890A4' }}>{theme.unit}</span>
        </div>
      </div>
      <div ref={chartRef} style={{ width: '100%', minHeight: 90 }} />
    </div>
  )
}
