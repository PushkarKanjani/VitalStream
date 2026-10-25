import { useState } from 'react'
import { useCases } from '../context/CasesContext'

export default function AlertQueue({ compact = false }) {
  const { state, dispatch } = useCases()
  const [acking, setAcking] = useState(null)

  const alerts = state.alerts.filter(a => !a.acknowledged)
  const shown  = compact ? alerts.slice(0, 4) : alerts

  async function acknowledge(alertId) {
    setAcking(alertId)
    try {
      await fetch(`/api/alerts/${alertId}/acknowledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acknowledged_by: 'Charge Nurse' }),
      })
      dispatch({ type: 'ALERT_CHANGE', payload: { alert_id: alertId, acknowledged: true } })
    } catch (e) {
      console.error('ACK failed:', e)
    } finally {
      setAcking(null)
    }
  }

  return (
    <section>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: compact ? 10 : 14 }}>
        <div>
          <h2 style={{ fontSize: compact ? '0.82rem' : '1rem', fontWeight: 700, color: '#1A1D27', margin: 0 }}>
            Alert Queue
          </h2>
          {!compact && (
            <p style={{ fontSize: '0.72rem', color: '#8890A4', margin: '2px 0 0' }}>
              {alerts.length} unacknowledged
            </p>
          )}
        </div>
        {alerts.length > 0 && (
          <span className="badge badge-critical">{alerts.length}</span>
        )}
      </div>

      {/* Empty state */}
      {alerts.length === 0 && (
        <div className="card" style={{ padding: '20px 16px', textAlign: 'center' }}>
          <div style={{ fontSize: '1.4rem', marginBottom: 6 }}>✓</div>
          <div style={{ fontSize: '0.8rem', color: '#2D9B6F', fontWeight: 500 }}>All clear</div>
          <div style={{ fontSize: '0.7rem', color: '#8890A4', marginTop: 2 }}>No unacknowledged alerts</div>
        </div>
      )}

      {/* Alert list */}
      {shown.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {shown.map(alert => {
            const isCrit = alert.severity === 'critical'
            const accent = isCrit ? '#C7344C' : '#B07A20'
            const bgTint = isCrit ? '#FDF0F2' : '#FDF6E8'
            return (
              <div
                key={alert.alert_id}
                className="card animate-fade-in"
                style={{
                  borderLeft: `3px solid ${accent}`,
                  padding: '10px 12px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  background: bgTint,
                  borderRadius: '0 8px 8px 0',
                  borderTopLeftRadius: 0,
                  borderBottomLeftRadius: 0,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                    <span className={`badge ${isCrit ? 'badge-critical' : 'badge-warning'}`}>
                      {alert.severity}
                    </span>
                    <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#4B5263', fontFamily: 'JetBrains Mono, monospace' }}>
                      {alert.or_id}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: '#8890A4' }}>{alert.alert_type}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: '#1A1D27', lineHeight: 1.4 }}>
                    {alert.reason}
                  </p>
                  <p style={{ margin: '3px 0 0', fontSize: '0.68rem', color: '#8890A4' }}>
                    {new Date(alert.created_at).toLocaleTimeString()}
                  </p>
                </div>
                {!compact && (
                  <button
                    className="btn-ack"
                    onClick={() => acknowledge(alert.alert_id)}
                    disabled={acking === alert.alert_id}
                  >
                    {acking === alert.alert_id ? '…' : 'ACK'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {compact && alerts.length > 4 && (
        <p style={{ fontSize: '0.7rem', color: '#8890A4', textAlign: 'center', marginTop: 8 }}>
          +{alerts.length - 4} more — see Alerts tab
        </p>
      )}
    </section>
  )
}
