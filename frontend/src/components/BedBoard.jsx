import { useState } from 'react'
import { Bed, CheckCircle2, Lock, Unlock, AlertCircle, Plus, RefreshCw, X } from 'lucide-react'
import { useCases } from '../context/CasesContext'
import { useToast } from '../context/ToastContext'

const STATUS_META = {
  available: { label: 'Available', bg: '#ECFDF5', color: '#059669', border: '#A7F3D0', icon: Unlock },
  occupied:  { label: 'Occupied',  bg: '#EFF6FF', color: '#2563EB', border: '#BFDBFE', icon: Lock },
  cleaning:  { label: 'Sanitizing', bg: '#FFFBEB', color: '#D97706', border: '#FDE68A', icon: RefreshCw },
}

const PLACEHOLDER_BEDS = ['REC-1','REC-2','REC-3','REC-4','REC-5','REC-6'].map(id => ({
  bed_id: id, status: 'available', type: 'recovery',
}))

export default function BedBoard() {
  const { state, dispatch } = useCases()
  const { addToast } = useToast()

  const [reserving, setReserving] = useState(false)
  const [releasing, setReleasing] = useState(null)
  const [modalBed, setModalBed]   = useState(null)
  const [releaseModalBed, setReleaseModalBed] = useState(null)
  const [form, setForm]           = useState({ caseId: '', reservedBy: 'Charge Nurse Sarah' })
  const [error, setError]         = useState('')

  const recoveryBeds = Object.values(state.beds).filter(b => b.type === 'recovery')
  const beds = recoveryBeds.length > 0 ? recoveryBeds : PLACEHOLDER_BEDS

  const avail = beds.filter(b => b.status === 'available').length
  const occup = beds.filter(b => b.status === 'occupied').length

  // Reserve Bed Action
  async function handleReserve(e) {
    e.preventDefault()
    if (!form.caseId || !form.reservedBy) {
      setError('Both Case ID and Nurse Name are required.')
      return
    }
    setError('')
    setReserving(true)

    try {
      const res = await fetch('/api/beds/reserve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bed_id: modalBed,
          case_id: form.caseId,
          reserved_by: form.reservedBy,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        // Double booking race condition caught!
        const errDetail = data.detail || 'Reservation rejected.'
        setError(errDetail)
        addToast({
          type: 'error',
          title: 'ACID Reservation Blocked',
          message: errDetail,
          duration: 5000
        })
      } else {
        dispatch({ type: 'BED_CHANGE', payload: data.bed })
        addToast({
          type: 'success',
          title: 'Bed Reserved Successfully',
          message: `${modalBed} reserved for ${form.caseId}.`,
          duration: 4000
        })

        dispatch({
          type: 'ADD_AUDIT_LOG',
          payload: {
            id: `BED-${Date.now().toString().slice(-4)}`,
            timestamp: new Date().toISOString(),
            action: 'BED_RESERVATION_COMMITTED',
            entity: modalBed,
            actor: form.reservedBy,
            status: 'success',
            detail: `ACID lock acquired. Allocated to ${form.caseId}.`
          }
        })

        setModalBed(null)
        setForm({ caseId: '', reservedBy: 'Charge Nurse Sarah' })
      }
    } catch {
      setError('Network communication failure.')
    } finally {
      setReserving(false)
    }
  }

  // Release Bed Action
  async function handleRelease(bedId) {
    setReleasing(bedId)
    try {
      const res = await fetch(`/api/beds/release/${bedId}`, { method: 'POST' })
      if (!res.ok) {
        addToast({ type: 'error', title: 'Release Failed', message: 'Could not release bed.' })
      } else {
        const updated = { bed_id: bedId, status: 'available', case_id: null, reserved_by: null, type: 'recovery' }
        dispatch({ type: 'BED_CHANGE', payload: updated })
        addToast({
          type: 'info',
          title: 'Bed Released',
          message: `${bedId} is now clean and available for post-op admissions.`
        })

        dispatch({
          type: 'ADD_AUDIT_LOG',
          payload: {
            id: `BED-${Date.now().toString().slice(-4)}`,
            timestamp: new Date().toISOString(),
            action: 'BED_RELEASED',
            entity: bedId,
            actor: 'Charge Nurse',
            status: 'success',
            detail: `Patient discharged. Bed status returned to available.`
          }
        })

        setReleaseModalBed(null)
      }
    } finally {
      setReleasing(null)
    }
  }

  return (
    <section>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Bed className="w-4 h-4 text-blue-600" />
            <span>Recovery Bed Board</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Live bed availability and instant conflict-free bed reservations
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800">
            {avail} Available
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-xs font-semibold text-blue-800">
            {occup} Occupied
          </div>
        </div>
      </div>

      {/* Bed Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {beds.map(bed => {
          const meta = STATUS_META[bed.status] || STATUS_META.available
          const Icon = meta.icon
          const isAvail = bed.status === 'available'
          const isOccup = bed.status === 'occupied'

          return (
            <div
              key={bed.bed_id}
              className="app-card p-4 transition-all relative overflow-hidden"
              style={{
                background: meta.bg,
                borderColor: meta.border,
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <Icon className="w-3.5 h-3.5" style={{ color: meta.color }} />
                  <span className="font-mono font-extrabold text-sm text-slate-900">
                    {bed.bed_id}
                  </span>
                </div>

                <span 
                  className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                  style={{ color: meta.color, background: 'rgba(255,255,255,0.7)' }}
                >
                  {meta.label}
                </span>
              </div>

              {/* Case / Occupant Info */}
              <div className="text-xs text-slate-600 space-y-0.5 min-h-[36px]">
                {bed.case_id ? (
                  <>
                    <div className="font-semibold text-slate-800">Case: {bed.case_id}</div>
                    <div className="text-[11px] text-slate-500 truncate">Nurse: {bed.reserved_by || 'Staff'}</div>
                  </>
                ) : (
                  <div className="text-slate-400 italic text-[11px] pt-1">
                    Ready for surgical transfer
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex items-center justify-between">
                {isAvail && (
                  <button
                    onClick={() => {
                      setModalBed(bed.bed_id)
                      setForm({ caseId: `CASE-00${Math.floor(Math.random() * 8) + 1}`, reservedBy: 'Charge Nurse Sarah' })
                      setError('')
                    }}
                    className="w-full btn-solid-primary py-1.5 text-xs rounded-lg"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Reserve Bed</span>
                  </button>
                )}

                {isOccup && (
                  <button
                    onClick={() => setReleaseModalBed(bed.bed_id)}
                    className="w-full btn-outline py-1.5 text-xs text-slate-600 hover:text-rose-600 hover:border-rose-200 rounded-lg"
                  >
                    <span>Discharge / Release</span>
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Reserve Bed Modal */}
      {modalBed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-enter">
          <div className="app-card bg-white p-6 rounded-2xl max-w-sm w-full shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Bed className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-bold text-slate-900">
                  Reserve {modalBed}
                </h3>
              </div>
              <button 
                onClick={() => setModalBed(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              Instantly reserves this recovery bed. Double-bookings are automatically blocked.
            </p>

            <form onSubmit={handleReserve} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Surgical Case ID
                </label>
                <input
                  type="text"
                  value={form.caseId}
                  onChange={(e) => setForm(f => ({ ...f, caseId: e.target.value }))}
                  placeholder="e.g. CASE-001"
                  className="app-input text-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Reserving Clinician
                </label>
                <input
                  type="text"
                  value={form.reservedBy}
                  onChange={(e) => setForm(f => ({ ...f, reservedBy: e.target.value }))}
                  placeholder="Nurse / Staff Name"
                  className="app-input text-xs"
                  required
                />
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={reserving}
                  className="flex-1 btn-solid-primary py-2.5 text-xs rounded-xl"
                >
                  {reserving ? 'Reserving…' : 'Reserve Bed'}
                </button>
                <button
                  type="button"
                  onClick={() => setModalBed(null)}
                  className="btn-outline py-2.5 px-4 text-xs rounded-xl"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Release Confirmation Modal */}
      {releaseModalBed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-enter">
          <div className="app-card bg-white p-6 rounded-2xl max-w-sm w-full shadow-2xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-2">
              Release {releaseModalBed}?
            </h3>
            <p className="text-xs text-slate-600 mb-5 leading-relaxed">
              Are you sure you want to mark this recovery bed as discharged? The bed will be sanitized and returned to the available pool.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => handleRelease(releaseModalBed)}
                disabled={releasing === releaseModalBed}
                className="flex-1 btn-solid-primary bg-rose-600 hover:bg-rose-700 py-2.5 text-xs rounded-xl"
              >
                {releasing === releaseModalBed ? 'Releasing…' : 'Yes, Discharge Bed'}
              </button>
              <button
                onClick={() => setReleaseModalBed(null)}
                className="btn-outline py-2.5 px-4 text-xs rounded-xl"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

    </section>
  )
}
