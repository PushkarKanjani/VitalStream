import { useEffect, useState } from 'react'

function StatusPill({ label, status, detail }) {
  const color = status === 'online' ? 'text-vs-green' : status === 'offline' ? 'text-vs-red' : 'text-vs-yellow'
  return (
    <div className="glass-card p-3 flex items-start gap-3">
      <span className={`status-dot mt-1 ${status === 'online' ? 'active' : status === 'offline' ? 'alert' : 'cleaning'}`} />
      <div>
        <p className="text-xs font-semibold text-vs-text">{label}</p>
        <p className={`text-xs ${color}`}>{status}</p>
        {detail && <p className="text-xs text-vs-muted mt-0.5">{detail}</p>}
      </div>
    </div>
  )
}

export default function PipelineHealth() {
  const [health, setHealth] = useState(null)
  const [cass,   setCass]   = useState(null)

  async function fetchHealth() {
    try {
      const [h, c] = await Promise.all([
        fetch('/api/metrics/health').then(r => r.json()),
        fetch('/api/metrics/cassandra').then(r => r.json()),
      ])
      setHealth(h)
      setCass(c)
    } catch (e) {
      console.error('Health fetch failed:', e)
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
      <h2 className="text-lg font-semibold text-vs-text mb-3 flex items-center gap-2">
        <span>📡</span> Pipeline Health
        <button onClick={fetchHealth} className="ml-auto text-xs text-vs-muted hover:text-vs-blue transition">↻ Refresh</button>
      </h2>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <StatusPill label="MongoDB"   status={health?.mongodb || 'unknown'}  detail="Document store · ACID" />
        <StatusPill label="Flink"     status={health?.flink   || 'unknown'}  detail={`${flinkJobs.length} job(s) running`} />
        <StatusPill label="Cassandra" status={cass?.status    || 'unknown'}  detail={cass?.writes_per_sec ? `${cass.writes_per_sec} rows/sec` : 'Time-series store'} />
        <StatusPill label="Kafka"     status="online"                        detail="vitals.raw · 6 partitions" />
      </div>

      {flinkJobs.length > 0 && (
        <div className="glass-card p-3">
          <p className="vital-label mb-2">Flink Jobs</p>
          {flinkJobs.map(j => (
            <div key={j.id} className="flex items-center justify-between py-1 border-b border-vs-border last:border-0">
              <span className="text-xs text-vs-text truncate">{j.name}</span>
              <span className={`text-xs font-mono ${j.state === 'RUNNING' ? 'text-vs-green' : 'text-vs-yellow'}`}>{j.state}</span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-2 grid grid-cols-2 gap-2 text-center">
        <div className="glass-card p-2">
          <p className="vital-label">Active Cases</p>
          <p className="text-vs-blue font-mono text-lg font-semibold">{health?.active_cases ?? '—'}</p>
        </div>
        <div className="glass-card p-2">
          <p className="vital-label">Unacked Alerts</p>
          <p className={`font-mono text-lg font-semibold ${(health?.unacked_alerts || 0) > 0 ? 'text-vs-red' : 'text-vs-green'}`}>
            {health?.unacked_alerts ?? '—'}
          </p>
        </div>
      </div>
    </section>
  )
}
