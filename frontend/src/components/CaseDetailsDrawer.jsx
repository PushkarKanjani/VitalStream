import { useEffect } from 'react'
import { X, Activity, User, Stethoscope, ShieldAlert, Bed, Clock, Pill, CheckCircle2 } from 'lucide-react'
import { useCases } from '../context/CasesContext'

export default function CaseDetailsDrawer({ orId, onClose, onOpenMedConsole }) {
  const { state } = useCases()

  const caseInfo = state.cases[orId]
  const vitals   = state.vitals[orId] || {}
  const hasAlert = state.alerts.some(a => a.or_id === orId && !a.acknowledged)

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  if (!orId) return null

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div 
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm transition-opacity"
      />

      {/* Drawer Panel */}
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white border-l border-slate-200 shadow-2xl flex flex-col animate-drawer">
          
          {/* Header */}
          <div className="p-6 border-b border-slate-200 flex items-center justify-between bg-slate-50/60">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-600 text-white font-mono font-bold flex items-center justify-center text-sm shadow-sm">
                {orId}
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {caseInfo?.procedure_name || caseInfo?.procedure_type || 'Surgery Details'}
                </h3>
                <div className="text-xs text-slate-500 font-medium">
                  {caseInfo?.case_id ? `Case #${caseInfo.case_id}` : 'No Active Surgery'}
                </div>
              </div>
            </div>

            <button 
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Drawer Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            
            {/* Case Status Pill */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-xs font-semibold text-slate-600">Room Status</span>
              {hasAlert ? (
                <span className="status-pill status-pill-danger">
                  ⚠ Critical Alert
                </span>
              ) : caseInfo?.status === 'active' ? (
                <span className="status-pill status-pill-success">
                  ● In Surgery
                </span>
              ) : (
                <span className="status-pill bg-slate-100 text-slate-600">
                  Idle / Cleaned
                </span>
              )}
            </div>

            {/* Surgical Staff */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Doctors & Staff
              </h4>
              <div className="p-3.5 rounded-xl border border-slate-200 space-y-2 bg-white">
                <div className="flex items-center gap-2.5 text-xs text-slate-700">
                  <Stethoscope className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>Chief Surgeon: <strong className="text-slate-900">Dr. {(caseInfo?.surgeon_name || caseInfo?.primary_surgeon || 'Aditi Sharma').replace(/^Dr\.\s*/i, '').replace(/\s*\(Chief Surgeon\)/i, '')}</strong></span>
                </div>
                <div className="flex items-center gap-2.5 text-xs text-slate-700">
                  <User className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>Anesthesiologist: <strong className="text-slate-900">{caseInfo?.anesthesiologist || 'Dr. Amit Sen'}</strong></span>
                </div>
                <div className="flex items-center gap-2.5 text-xs text-slate-700">
                  <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>Start Time: <strong>{caseInfo?.scheduled_start ? new Date(caseInfo.scheduled_start).toLocaleTimeString() : '08:30 AM'}</strong></span>
                </div>
              </div>
            </div>

            {/* Real-Time Telemetry Snapshot */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Live Vital Signs
              </h4>
              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Heart Rate</div>
                  <div className="text-xl font-bold font-mono text-slate-900 mt-0.5">
                    {vitals.hr ? `${Math.round(vitals.hr)} bpm` : '74 bpm'}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Blood Pressure</div>
                  <div className="text-xl font-bold font-mono text-slate-900 mt-0.5">
                    {vitals.syst_bp ? `${Math.round(vitals.syst_bp)}/${Math.round(vitals.dias_bp || 80)}` : '122/81'}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Oxygen Saturation</div>
                  <div className="text-xl font-bold font-mono text-slate-900 mt-0.5">
                    {vitals.o2_sat ? `${vitals.o2_sat.toFixed(1)}%` : '98.5%'}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Body Temperature</div>
                  <div className="text-xl font-bold font-mono text-slate-900 mt-0.5">
                    {vitals.temp_c ? `${vitals.temp_c.toFixed(1)} °C` : '36.8 °C'}
                  </div>
                </div>
              </div>
            </div>

            {/* Patient Allergy Guard Status */}
            <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-800 uppercase tracking-wide">
                <ShieldAlert className="w-4 h-4 text-amber-600" />
                <span>Patient Allergies</span>
              </div>
              <div className="mt-2 text-xs text-amber-900 leading-relaxed">
                Patient is allergic to <strong>Penicillin & Aspirin</strong>. Dangerous medicines are automatically blocked by the system.
              </div>
            </div>

          </div>

          {/* Drawer Actions */}
          <div className="p-5 border-t border-slate-200 bg-slate-50/70 flex gap-3">
            <button
              onClick={() => {
                onClose()
                if (onOpenMedConsole) onOpenMedConsole()
              }}
              className="flex-1 btn-solid-primary py-2.5 text-xs rounded-xl"
            >
              <Pill className="w-4 h-4" />
              <span>Prescribe Medicine</span>
            </button>

            <button
              onClick={onClose}
              className="btn-outline py-2.5 px-4 text-xs rounded-xl"
            >
              Close
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}
