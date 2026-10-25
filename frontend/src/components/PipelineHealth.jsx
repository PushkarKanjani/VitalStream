import { useEffect, useState } from 'react'

const SERVICE_META = {
  online:  { label: 'Operational', dot: 'active',   color: '#2D9B6F', bg: '#EBF7F3' },
  offline: { label: 'Offline',     dot: 'alert',    color: '#C7344C', bg: '#FDF0F2' },
  warning: { label: 'Degraded',    dot: 'cleaning', color: '#B07A20', bg: '#FDF6E8' },
  unknown: { label: 'Checking',    dot: 'idle',     color: '#8890A4', bg: '#F7F8FA' },
}

function ServiceCard({ label, status, detail }) {
  const meta = SERVICE_META[status] || SERVICE_META.unknown
  return (
    <div className="card" style={{ padding: '12px 14px', background: '#FFFFFF' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#1A1D27' }}>{label}</span>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          fontSize: '0.68rem', fontWeight: 600, color: meta.color,
          background: meta.bg, padding: '2px 8px', borderRadius: 999,
        }}>
          <span className={`status-dot ${meta.dot}`} />
          {meta.label}
        </span>
      </div>
      {detail && <div style={{ fontSize: '0.72rem', color: '#8890A4', marginTop: 2 }}>{detail}</div>}
    </div>
  )
}

export default function PipelineHealth({ compact = false }) {
  const [health, setHealth] = useState(null)
  const [cass,   setCass]   = useState(null)
  const [loading, setLoading] = useState(false)

  async function fetchHealth() {
    setLoading(true)
    try {
      const [h, c] = await Promise.all([
        fetch('/api/metrics/health').then(r => r.json()).catch(() => null),
        fetch('/api/metrics/cassandra').then(r => r.json()).catch(() => null),
      ])
      if (h) setHealth(h)
      if (c) setCass(c)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchHealth()
    const iv = setInterval(fetchHealth, 15000)
    return () => clearInterval(iv)
  }, [])

  const flinkJobs = health?.flink_jobs || []

  return (
    <section>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: compact ? 10 : 14 }}>
        <h2 style={{ fontSize: compact ? '0.82rem' : '1rem', fontWeight: 700, color: '#1A1D27', margin: 0 }}>
          Pipeline Status
        </h2>
        <button
          onClick={fetchHealth}
          disabled={loading}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: '0.72rem', color: '#2563EB', fontWeight: 500,
            padding: 0,
          }}
        >
          {loading ? 'Refreshing…' : '↻ Refresh'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : 'repeat(2, 1fr)', gap: 8, marginBottom: 12 }}>
        <ServiceCard
          label="MongoDB 7.0"
          status={health?.mongodb === 'healthy' ? 'online' : (health?.mongodb || 'unknown')}
          detail="Document store · ACID bed lock"
        />
        <ServiceCard
          label="Apache Kafka"
          status="online"
          detail="vitals.raw · 6 partitions"
        />
        <ServiceCard
          label="Apache Flink"
          status={health?.flink === 'healthy' ? 'online' : (health?.flink || 'unknown')}
          detail={`${flinkJobs.length} active streaming job(s)`}
        />
        <ServiceCard
          label="Cassandra"
          status={cass?.status === 'online' ? 'online' : (cass?.status || 'unknown')}
          detail={cass?.writes_per_sec ? `${cass.writes_per_sec} vitals/sec` : 'Time-series vitals table'}
        />
      </div>

      {flinkJobs.length > 0 && !compact && (
        <div className="card" style={{ padding: '12px 14px', marginBottom: 12 }}>
          <div className="vital-label" style={{ marginBottom: 8 }}>Flink Streaming Jobs</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {flinkJobs.map(j => (
              <div key={j.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                <span style={{ color: '#1A1D27', fontWeight: 500 }}>{j.name}</span>
                <span className={`badge ${j.state === 'RUNNING' ? 'badge-ok' : 'badge-warning'}`}>{j.state}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mini metric counters */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
        <div className="card" style={{ padding: '10px 12px', textAlign: 'center', background: '#FFFFFF' }}>
          <div className="vital-label">Active ORs</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#2563EB', fontFamily: 'JetBrains Mono, monospace', marginTop: 2 }}>
            {health?.active_cases ?? '0'}
          </div>
        </div>
        <div className="card" style={{ padding: '10px 12px', textAlign: 'center', background: '#FFFFFF' }}>
          <div className="vital-label">Unacked Alerts</div>
          <div style={{
            fontSize: '1.25rem', fontWeight: 700,
            color: (health?.unacked_alerts || 0) > 0 ? '#C7344C' : '#2D9B6F',
            fontFamily: 'JetBrains Mono, monospace', marginTop: 2,
          }}>
            {health?.unacked_alerts ?? '0'}
          </div>
        </div>
      </div>
    </section>
  )
}
