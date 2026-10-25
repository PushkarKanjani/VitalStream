import { useEffect, useRef } from 'react'
import { useCases } from '../context/CasesContext'
import uPlot from 'uplot'
import 'uplot/dist/uPlot.min.css'

const COLORS = {
  hr:      '#58A6FF',
  syst_bp: '#F85149',
  o2_sat:  '#3FB950',
}

export default function VitalWaveform({ orId, field = 'hr', maxPoints = 120 }) {
  const { state } = useCases()
  const chartRef  = useRef(null)
  const uplotRef  = useRef(null)
  const dataRef   = useRef({ xs: [], ys: [] })

  // Append new vitals as they arrive
  useEffect(() => {
    const v = state.vitals[orId]
    if (!v || v[field] == null) return

    const now = Date.now() / 1000
    dataRef.current.xs.push(now)
    dataRef.current.ys.push(v[field])

    // Keep only last maxPoints
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
  }, [state.vitals, orId, field])

  // Mount uPlot
  useEffect(() => {
    if (!chartRef.current) return

    const opts = {
      width:  chartRef.current.offsetWidth || 380,
      height: 80,
      cursor: { show: false },
      legend: { show: false },
      scales: { x: { time: true }, y: { auto: true } },
      axes: [
        { show: false },
        {
          stroke: '#8B949E',
          size:  32,
          ticks: { show: false },
          grid:  { stroke: '#30363D', width: 0.5 },
        }
      ],
      series: [
        {},
        {
          stroke: COLORS[field] || '#58A6FF',
          width:  1.5,
          fill:   `${COLORS[field] || '#58A6FF'}18`,
        }
      ],
    }

    uplotRef.current = new uPlot(opts, [new Float64Array(), new Float64Array()], chartRef.current)

    return () => {
      uplotRef.current?.destroy()
      uplotRef.current = null
    }
  }, [field])

  const LABEL_MAP = { hr: 'Heart Rate', syst_bp: 'Systolic BP', o2_sat: 'SpO₂' }

  return (
    <div className="glass-card p-3">
      <p className="vital-label mb-2">{LABEL_MAP[field] || field} — {orId}</p>
      <div ref={chartRef} className="w-full" />
    </div>
  )
}
