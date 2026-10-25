import { useState } from 'react'
import { useCases } from '../context/CasesContext'

const BED_STATUS_STYLE = {
  available: 'border-vs-green text-vs-green',
  occupied:  'border-vs-blue  text-vs-blue',
  cleaning:  'border-vs-yellow text-vs-yellow',
}

export default function BedBoard() {
  const { state, dispatch } = useCases()
  const [reserving, setReserving] = useState(null)
  const [form, setForm]           = useState({ caseId: '', reservedBy: '' })
  const [modalBed, setModalBed]   = useState(null)

  const recoveryBeds = Object.values(state.beds).filter(b => b.type === 'recovery')

  async function reserve() {
    if (!form.caseId || !form.reservedBy) return
    setReserving(modalBed)
    try {
      const res = await fetch('/api/beds/reserve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bed_id:      modalBed,
          case_id:     form.caseId,
          reserved_by: form.reservedBy,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert(`❌ ${data.detail}`)
      } else {
        dispatch({ type: 'BED_CHANGE', payload: data.bed })
        setModalBed(null)
        setForm({ caseId: '', reservedBy: '' })
      }
    } finally {
      setReserving(null)
    }
  }

  return (
    <section>
      <h2 className="text-lg font-semibold text-vs-text mb-3 flex items-center gap-2">
        <span>🛏</span> Recovery Beds
      </h2>
      <div className="grid grid-cols-3 gap-2">
        {(recoveryBeds.length > 0
          ? recoveryBeds
          : ['REC-1','REC-2','REC-3','REC-4','REC-5','REC-6'].map(id => ({ bed_id: id, status: 'available', type: 'recovery' }))
        ).map(bed => (
          <div
            key={bed.bed_id}
            className={`glass-card p-3 border cursor-pointer hover:opacity-80 transition-opacity
              ${BED_STATUS_STYLE[bed.status] || BED_STATUS_STYLE.available}`}
            onClick={() => bed.status === 'available' && setModalBed(bed.bed_id)}
          >
            <div className="text-xs font-mono font-semibold">{bed.bed_id}</div>
            <div className="text-xs mt-1 capitalize">{bed.status}</div>
            {bed.case_id && <div className="text-xs text-vs-muted truncate">Case: {bed.case_id}</div>}
          </div>
        ))}
      </div>

      {/* Reserve modal */}
      {modalBed && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="glass-card p-6 w-80 border border-vs-border">
            <h3 className="font-semibold text-vs-text mb-4">Reserve {modalBed}</h3>
            <input
              className="w-full bg-vs-bg border border-vs-border rounded px-3 py-2 text-sm text-vs-text mb-3 focus:outline-none focus:border-vs-blue"
              placeholder="Case ID"
              value={form.caseId}
              onChange={e => setForm(f => ({ ...f, caseId: e.target.value }))}
            />
            <input
              className="w-full bg-vs-bg border border-vs-border rounded px-3 py-2 text-sm text-vs-text mb-4 focus:outline-none focus:border-vs-blue"
              placeholder="Reserved by (name)"
              value={form.reservedBy}
              onChange={e => setForm(f => ({ ...f, reservedBy: e.target.value }))}
            />
            <div className="flex gap-2">
              <button
                onClick={reserve}
                disabled={!!reserving}
                className="flex-1 py-2 rounded bg-vs-blue text-white text-sm font-medium hover:opacity-80 transition disabled:opacity-50"
              >
                {reserving ? 'Reserving…' : 'Reserve'}
              </button>
              <button
                onClick={() => setModalBed(null)}
                className="flex-1 py-2 rounded bg-vs-border text-vs-text text-sm hover:opacity-80 transition"
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
