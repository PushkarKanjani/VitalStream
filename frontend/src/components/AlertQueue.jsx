import { useState } from 'react'
import { ShieldAlert, AlertTriangle, CheckCircle2, Clock, Filter, Check } from 'lucide-react'
import { useCases } from '../context/CasesContext'
import { useToast } from '../context/ToastContext'

export default function AlertQueue({ compact = false }) {
  const { state, dispatch } = useCases()
  const { addToast } = useToast()

  const [acking, setAcking] = useState(null)
  const [filter, setFilter] = useState('ALL') // 'ALL' | 'CRITICAL' | 'WARNING'

  const alerts = state.alerts.filter(a => !a.acknowledged)

  const filteredAlerts = alerts.filter(a => {
    if (filter === 'CRITICAL') return a.severity === 'critical'
    if (filter === 'WARNING')  return a.severity === 'warning'
    return true
  })

  const shown = compact ? filteredAlerts.slice(0, 4) : filteredAlerts

  async function acknowledge(alertId, orId, alertType) {
    setAcking(alertId)
    try {
      await fetch(`/api/alerts/${alertId}/acknowledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acknowledged_by: 'Charge Nurse' }),
      })

      dispatch({ type: 'ALERT_CHANGE', payload: { alert_id: alertId, acknowledged: true } })

      addToast({
        type: 'success',
        title: 'Alert Acknowledged',
        message: `Alert ${alertId} for ${orId} (${alertType}) acknowledged. Escalation timer disarmed.`,
        duration: 3500
      })

      dispatch({
        type: 'ADD_AUDIT_LOG',
        payload: {
          id: `ACK-${alertId}`,
          timestamp: new Date().toISOString(),
          action: 'ALERT_ACKNOWLEDGED',
          entity: `${orId} · ${alertType}`,
          actor: 'Charge Nurse',
          status: 'success',
          detail: `Acknowledged within SLA. Escalation disarmed.`
        }
      })
    } catch (e) {
      addToast({
        type: 'error',
        title: 'ACK Failed',
        message: 'Could not communicate with alert server.'
      })
    } finally {
      setAcking(null)
    }
  }

  return (
    <section>
      {/* Header */}
      <div className="flex items-center justify-between mb-3.5">
        <div>
          <h2 className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-600" />
            <span>Active Alerts</span>
          </h2>
          {!compact && (
            <p className="text-xs text-slate-500 mt-0.5">
              Immediate warnings when patient vitals cross safe thresholds
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {alerts.length > 0 && (
            <span className="px-2.5 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">
              {alerts.length} Pending
            </span>
          )}
        </div>
      </div>

      {/* Filter Tabs (when not compact) */}
      {!compact && alerts.length > 0 && (
        <div className="flex items-center gap-1.5 mb-3 text-xs">
          <span className="text-slate-400 font-medium mr-1">Filter:</span>
          {['ALL', 'CRITICAL', 'WARNING'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                filter === f 
                  ? 'bg-slate-800 text-white' 
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {f === 'ALL' ? 'All' : f === 'CRITICAL' ? 'Critical Only' : 'Warnings'}
            </button>
          ))}
        </div>
      )}

      {/* Empty State */}
      {alerts.length === 0 && (
        <div className="app-card p-6 text-center bg-white border border-slate-200">
          <div className="w-10 h-10 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto mb-2.5">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div className="text-sm font-bold text-slate-800">All Patient Vitals Stable</div>
          <div className="text-xs text-slate-500 mt-0.5">Zero unacknowledged alarms in surgical queue</div>
        </div>
      )}

      {/* Alert Cards List */}
      {shown.length > 0 && (
        <div className="space-y-2.5">
          {shown.map((alert) => {
            const isCrit = alert.severity === 'critical'
            const borderColor = isCrit ? '#FECACA' : '#FDE68A'
            const bgColor     = isCrit ? '#FEF2F2' : '#FFFBEB'
            const accentColor = isCrit ? '#DC2626' : '#D97706'

            return (
              <div
                key={alert.alert_id}
                className="app-card p-3.5 border transition-all flex items-start gap-3"
                style={{
                  background: bgColor,
                  borderColor: borderColor,
                  borderLeftWidth: '4px',
                  borderLeftColor: accentColor,
                }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span 
                      className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider"
                      style={{
                        background: isCrit ? '#FEE2E2' : '#FEF3C7',
                        color: accentColor,
                      }}
                    >
                      {alert.severity}
                    </span>
                    <span className="text-xs font-mono font-bold text-slate-900">
                      {alert.or_id}
                    </span>
                    <span className="text-xs text-slate-500 font-medium">
                      {alert.alert_type}
                    </span>
                  </div>

                  <p className="text-xs font-semibold text-slate-800 leading-snug">
                    {alert.reason}
                  </p>

                  <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-1.5">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>Fired: {new Date(alert.created_at).toLocaleTimeString()}</span>
                    <span>•</span>
                    <span className="text-slate-600 font-medium">Escalation Timer: 10m</span>
                  </div>
                </div>

                <button
                  onClick={() => acknowledge(alert.alert_id, alert.or_id, alert.alert_type)}
                  disabled={acking === alert.alert_id}
                  className="shrink-0 px-3 py-1.5 text-xs rounded-lg font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-700 transition-colors shadow-sm flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{acking === alert.alert_id ? 'Saving…' : 'Acknowledge'}</span>
                </button>
              </div>
            )
          })}
        </div>
      )}

      {compact && filteredAlerts.length > 4 && (
        <div className="text-center mt-2.5">
          <span className="text-xs text-blue-600 font-semibold cursor-pointer hover:underline">
            +{filteredAlerts.length - 4} more alarms in queue →
          </span>
        </div>
      )}
    </section>
  )
}
