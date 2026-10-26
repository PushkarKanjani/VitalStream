import { useEffect, useRef, useState, useMemo } from 'react'
import { useCases } from '../context/CasesContext'
import { METRIC_RULES } from '../config/outlierRules'
import uPlot from 'uplot'
import 'uplot/dist/uPlot.min.css'

const METRIC_THEMES = {
  hr:      { stroke: '#2563EB', fill: 'rgba(37, 99, 235, 0.08)',  label: 'Heart Rate',    unit: 'bpm' },
  syst_bp: { stroke: '#0284C7', fill: 'rgba(2, 132, 199, 0.08)',  label: 'Systolic BP',   unit: 'mmHg' },
  o2_sat:  { stroke: '#059669', fill: 'rgba(5, 150, 105, 0.08)', label: 'Oxygen (SpO₂)', unit: '%' },
  etco2:   { stroke: '#7C3AED', fill: 'rgba(124, 58, 237, 0.08)', label: 'End-Tidal CO₂',unit: 'mmHg' },
  temp_c:  { stroke: '#D97706', fill: 'rgba(217, 119, 6, 0.08)',  label: 'Temperature',   unit: '°C' },
}

export default function VitalWaveform({ orId, field = 'hr', maxPoints = 20 }) {
  const { state } = useCases()
  const chartRef  = useRef(null)
  const uplotRef  = useRef(null)
  const dataRef   = useRef({ xs: [], ys: [] })

  const vitalsObj = state.vitals[orId] || {}
  const activeAlert = state.alerts.find(a => a.or_id === orId && !a.acknowledged)

  // Active outliers for this OR
  const orActiveOutliers = useMemo(() => {
    return (state.activeOutliers || []).filter(o => o.or_id === orId)
  }, [state.activeOutliers, orId])

  const severityRank = { CRITICAL: 1, WARNING: 2, INFO: 3 }
  const sortedOutliers = useMemo(() => {
    const list = [...orActiveOutliers].sort((a, b) => 
      (severityRank[a.severity] || 9) - (severityRank[b.severity] || 9)
    )
    if (list.length === 0 && vitalsObj.is_outlier) {
      return [{
        metric: vitalsObj.metric || 'syst_bp',
        value: vitalsObj.val ?? vitalsObj.syst_bp ?? 70.0,
        unit: vitalsObj.unit || 'mmHg',
        rule: vitalsObj.rule || 'THRESHOLD',
        expected_low: vitalsObj.expected_low ?? 75.0,
        expected_high: vitalsObj.expected_high ?? 180.0,
        z_score: vitalsObj.z_score,
        severity: vitalsObj.severity || 'CRITICAL',
      }]
    }
    return list
  }, [orActiveOutliers, vitalsObj])

  const topOutlier = sortedOutliers[0] || null

  // Metric selector state
  const [userSelectedMetric, setUserSelectedMetric] = useState(null)
  const lastOutlierMetricRef = useRef(null)

  // Auto-select the offending metric tab when an active outlier occurs
  useEffect(() => {
    if (topOutlier?.metric && topOutlier.metric !== lastOutlierMetricRef.current) {
      lastOutlierMetricRef.current = topOutlier.metric
      setUserSelectedMetric(null)
    } else if (!topOutlier) {
      lastOutlierMetricRef.current = null
    }
  }, [topOutlier?.metric, topOutlier?.value])

  const currentMetric = userSelectedMetric || (topOutlier ? topOutlier.metric : field)

  // Only the offending metric is styled red; normal metrics stay neutral
  const isCurrentMetricOutlier = Boolean(
    sortedOutliers.some(o => o.metric === currentMetric) ||
    (vitalsObj.is_outlier && (vitalsObj.metric === currentMetric || (!vitalsObj.metric && currentMetric === 'syst_bp')))
  )

  const baseTheme = METRIC_THEMES[currentMetric] || METRIC_THEMES.hr
  const theme = isCurrentMetricOutlier
    ? { stroke: '#DC2626', fill: 'rgba(220, 38, 38, 0.08)', label: baseTheme.label, unit: baseTheme.unit }
    : baseTheme

  // Reset/seed data on metric switch or mount
  useEffect(() => {
    const now = Date.now() / 1000
    const fallbackVal = currentMetric === 'hr' ? 74 : currentMetric === 'syst_bp' ? 120 : 98.5
    const currentVal = vitalsObj[currentMetric] ?? fallbackVal
    
    // Check if we have history recorded
    const hist = state.vitalsHistory[orId]?.[currentMetric] || []
    const xs = []
    const ys = []

    if (hist.length > 0) {
      const startIdx = Math.max(0, hist.length - maxPoints)
      const slice = hist.slice(startIdx)
      for (let i = 0; i < slice.length; i++) {
        xs.push(now - (slice.length - 1 - i))
        ys.push(slice[i] != null ? slice[i] : currentVal)
      }
    } else {
      for (let i = maxPoints - 1; i >= 0; i--) {
        xs.push(now - i)
        const sinusWave = Math.sin((maxPoints - i) * 0.45) * 1.5
        ys.push(Number((currentVal + sinusWave).toFixed(1)))
      }
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

  // Mount uPlot with threshold bands and violating points marker
  useEffect(() => {
    if (!chartRef.current) return

    const ruleCfg = METRIC_RULES[currentMetric]
    const expLow = ruleCfg?.expectedLow
    const expHigh = ruleCfg?.expectedHigh

    const opts = {
      width:  chartRef.current.offsetWidth || 380,
      height: 95,
      cursor: { show: false },
      legend: { show: false },
      scales: {
        x: { time: true },
        y: {
          auto: true,
          range: (u, dataMin, dataMax) => {
            if (expLow != null && expHigh != null) {
              const min = Math.min(dataMin ?? expLow, expLow - 5)
              const max = Math.max(dataMax ?? expHigh, expHigh + 5)
              return [min, max]
            }
            return [dataMin, dataMax]
          }
        }
      },
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
      hooks: {
        draw: [
          (u) => {
            try {
              if (!u || !u.ctx || typeof u.valToPos !== 'function') return
              const { ctx } = u

              // Draw threshold / expected band
              if (expLow != null && expHigh != null) {
                const yMin = u.valToPos(expLow, 'y', true)
                const yMax = u.valToPos(expHigh, 'y', true)
                const topY = Math.min(yMin, yMax)
                const botY = Math.max(yMin, yMax)
                const bandH = Math.max(1, botY - topY)

                ctx.save()
                // Expected safe range band
                ctx.fillStyle = 'rgba(16, 185, 129, 0.05)'
                ctx.fillRect(u.bbox.left, topY, u.bbox.width, bandH)

                // Dashed boundary lines
                ctx.strokeStyle = '#FCA5A5'
                ctx.lineWidth = 1
                ctx.setLineDash([4, 4])
                ctx.beginPath()
                ctx.moveTo(u.bbox.left, yMin)
                ctx.lineTo(u.bbox.left + u.bbox.width, yMin)
                ctx.moveTo(u.bbox.left, yMax)
                ctx.lineTo(u.bbox.left + u.bbox.width, yMax)
                ctx.stroke()
                ctx.restore()
              }

              // Mark only violating points
              if (expLow != null && expHigh != null && u.data && u.data[1]) {
                ctx.save()
                const xs = u.data[0]
                const ys = u.data[1]
                for (let i = 0; i < ys.length; i++) {
                  const val = ys[i]
                  if (val != null && (val < expLow || val > expHigh)) {
                    const cx = u.valToPos(xs[i], 'x', true)
                    const cy = u.valToPos(val, 'y', true)
                    ctx.beginPath()
                    ctx.arc(cx, cy, 3.5, 0, 2 * Math.PI)
                    ctx.fillStyle = '#DC2626'
                    ctx.fill()
                    ctx.strokeStyle = '#FFFFFF'
                    ctx.lineWidth = 1.5
                    ctx.stroke()
                  }
                }
                ctx.restore()
              }
            } catch (err) {
              // Ignore canvas edge cases during mount/unmount
            }
          }
        ]
      }
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

  const outlierVal = (isCurrentMetricOutlier && topOutlier?.metric === currentMetric) ? topOutlier.value : null
  const rawVal = outlierVal ?? state.vitals[orId]?.[currentMetric]
  const fallbackVal = currentMetric === 'hr' ? 74 : currentMetric === 'syst_bp' ? 120 : currentMetric === 'o2_sat' ? 98.5 : currentMetric === 'temp_c' ? 36.8 : 35
  const latestVal = rawVal ?? fallbackVal

  // Formatted outlier description line
  const outlierLineText = useMemo(() => {
    if (!topOutlier) return ''
    const mLabel = METRIC_RULES[topOutlier.metric]?.label || topOutlier.metric.toUpperCase()
    const valStr = typeof topOutlier.value === 'number' ? topOutlier.value.toFixed(1) : topOutlier.value
    const unitStr = topOutlier.unit || METRIC_RULES[topOutlier.metric]?.unit || ''
    if (topOutlier.rule === 'STATISTICAL') {
      return `${mLabel} ${valStr} ${unitStr} | z = ${(topOutlier.z_score || 0).toFixed(1)} | STATISTICAL`
    }
    if (topOutlier.rule === 'ARTIFACT') {
      return `${mLabel} ${valStr} ${unitStr} | SENSOR CHECK | ARTIFACT`
    }
    const comp = topOutlier.value < topOutlier.expected_low
      ? `below ${topOutlier.expected_low}`
      : `above ${topOutlier.expected_high}`
    return `${mLabel} ${valStr} ${unitStr} | ${comp} | THRESHOLD`
  }, [topOutlier])

  return (
    <div
      className="card"
      style={{
        padding: '14px 16px',
        background: '#FFFFFF',
        border: '1px solid #E2E8F0',
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
              { id: 'temp_c', label: 'Temp' },
              { id: 'etco2', label: 'EtCO₂' },
            ].map(m => {
              const mHasOutlier = sortedOutliers.some(o => o.metric === m.id)
              const isSelected = currentMetric === m.id
              return (
                <button
                  key={m.id}
                  onClick={() => setUserSelectedMetric(m.id)}
                  style={{
                    padding: '2px 8px',
                    borderRadius: 4,
                    fontSize: '0.68rem',
                    fontWeight: isSelected ? 700 : 500,
                    background: isSelected 
                      ? (mHasOutlier ? '#FEE2E2' : '#FFFFFF') 
                      : (mHasOutlier ? '#FEF2F2' : 'transparent'),
                    color: mHasOutlier ? '#DC2626' : (isSelected ? '#0F172A' : '#64748B'),
                    border: isSelected && mHasOutlier ? '1px solid #FCA5A5' : 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 3,
                    boxShadow: isSelected ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                  }}
                >
                  {m.label}
                  {mHasOutlier && (
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#DC2626', display: 'inline-block' }} />
                  )}
                </button>
              )
            })}
          </div>

          {/* Outlier Tag */}
          {topOutlier && (
            <span
              title={outlierLineText}
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
              🚨 OUTLIER ACTIVE
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
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
          <span style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '1.4rem',
            fontWeight: 800,
            color: isCurrentMetricOutlier ? '#DC2626' : theme.stroke
          }}>
            {latestVal != null ? (typeof latestVal === 'number' ? (isCurrentMetricOutlier || currentMetric === 'o2_sat' || currentMetric === 'temp_c' ? latestVal.toFixed(1) : Math.round(latestVal)) : latestVal) : '—'}
          </span>
          <span style={{ fontSize: '0.75rem', color: isCurrentMetricOutlier ? '#DC2626' : '#64748B', fontWeight: 700 }}>
            {theme.unit}
          </span>
        </div>
      </div>

      {/* Chart Canvas */}
      <div ref={chartRef} style={{ width: '100%', minHeight: 95 }} />

      {/* Outlier / Alert Description Footer */}
      {topOutlier ? (
        <div style={{ marginTop: 6, fontSize: '0.68rem', color: '#B91C1C', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
          <span>🚨</span>
          <span>{outlierLineText}</span>
          {sortedOutliers.length > 1 && (
            <span style={{ background: '#FEE2E2', color: '#991B1B', padding: '1px 5px', borderRadius: 4, fontSize: '0.62rem', fontWeight: 700 }}>
              +{sortedOutliers.length - 1} more
            </span>
          )}
        </div>
      ) : activeAlert ? (
        <div style={{ marginTop: 6, fontSize: '0.68rem', color: '#B45309', fontWeight: 500 }}>
          Active Alert: {activeAlert.message}
        </div>
      ) : null}
    </div>
  )
}
