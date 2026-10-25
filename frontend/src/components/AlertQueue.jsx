import { useState } from 'react'
import { useCases } from '../context/CasesContext'

export default function AlertQueue() {
  const { state, dispatch } = useCases()
  const [acking, setAcking] = useState(null)

  const alerts = state.alerts.filter(a => !a.acknowledged)

  async function acknowledge(alertId) {
    setAcking(alertId)
    try {
      await fetch(`/api/alerts/${alertId}/acknowledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acknowledged_by: 'Charge Nurse' }),
      })
      // WebSocket will push the update, but also update local state immediately
      dispatch({ type: 'ALERT_CHANGE', payload: { alert_id: alertId, acknowledged: true } })
    } catch (e) {
      console.error('ACK failed:', e)
    } finally {
      setAcking(null)
    }
  }

  return (
    <section>
      <h2 className="text-lg font-semibold text-vs-text mb-3 flex items-center gap-2">
        <span>🚨</span> Alert Queue
        {alerts.length > 0 && (
          <span className="alert-badge critical ml-2">{alerts.length} unacked</span>
        )}
      </h2>

      {alerts.length === 0 ? (
        <div className="glass-card p-6 text-center text-vs-muted text-sm">
          ✓ No unacknowledged alerts
        </div>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {alerts.map(alert => (
            <div
              key={alert.alert_id}
              className={`glass-card p-3 flex items-start justify-between gap-3 border-l-4 animate-fade-in
                ${alert.severity === 'critical' ? 'border-l-vs-red' : 'border-l-vs-yellow'}`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`alert-badge ${alert.severity}`}>{alert.severity}</span>
                  <span className="text-xs font-mono text-vs-blue">{alert.or_id}</span>
                  <span className="text-xs font-mono text-vs-muted">{alert.alert_type}</span>
                </div>
                <p className="text-xs text-vs-text leading-snug truncate">{alert.reason}</p>
                <p className="text-xs text-vs-muted mt-0.5">
                  {new Date(alert.created_at).toLocaleTimeString()}
                </p>
              </div>
              <button
                onClick={() => acknowledge(alert.alert_id)}
                disabled={acking === alert.alert_id}
                className="shrink-0 px-3 py-1 text-xs rounded-md bg-vs-green/10 text-vs-green border border-vs-green/30
                           hover:bg-vs-green/20 transition-colors disabled:opacity-50"
              >
                {acking === alert.alert_id ? '…' : 'ACK'}
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
