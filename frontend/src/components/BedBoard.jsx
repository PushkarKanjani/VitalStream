import { useState } from 'react'
import { useCases } from '../context/CasesContext'

const STATUS_META = {
  available: { label: 'Available', bg: '#EBF7F3', color: '#2D9B6F', border: '#A8DFC8' },
  occupied:  { label: 'Occupied',  bg: '#EEF4FF', color: '#2563EB', border: '#B4CFFA' },
  cleaning:  { label: 'Cleaning',  bg: '#FDF6E8', color: '#B07A20', border: '#EDD89A' },
}

const PLACEHOLDER_BEDS = ['REC-1','REC-2','REC-3','REC-4','REC-5','REC-6'].map(id => ({
  bed_id: id, status: 'available', type: 'recovery',
}))

export default function BedBoard() {
  const { state, dispatch } = useCases()
  const [reserving, setReserving] = useState(null)
  const [form, setForm]           = useState({ caseId: '', reservedBy: '' })
  const [modalBed, setModalBed]   = useState(null)
  const [error, setError]         = useState('')

  const recoveryBeds = Object.values(state.beds).filter(b => b.type === 'recovery')
  const beds = recoveryBeds.length > 0 ? recoveryBeds : PLACEHOLDER_BEDS

  const avail = beds.filter(b => b.status === 'available').length
  const occup = beds.filter(b => b.status === 'occupied').length

  async function reserve() {
    if (!form.caseId || !form.reservedBy) {
      setError('Please fill in both fields.')
      return
    }
    setError('')
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
        setError(data.detail || 'Reservation failed.')
      } else {
        dispatch({ type: 'BED_CHANGE', payload: data.bed })
        setModalBed(null)
        setForm({ caseId: '', reservedBy: '' })
      }
    } catch {
      setError('Network error — try again.')
    } finally {
      setReserving(null)
    }
  }

  return (
    <section>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#1A1D27', margin: 0 }}>Recovery Beds</h2>
          <p style={{ fontSize: '0.72rem', color: '#8890A4', margin: '2px 0 0' }}>
            {avail} available · {occup} occupied
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {[
            { label: 'Available', count: avail, bg: '#EBF7F3', color: '#2D9B6F' },
            { label: 'Occupied',  count: occup, bg: '#EEF4FF', color: '#2563EB' },
          ].map(s => (
            <div key={s.label} style={{ textAlign: 'center', background: s.bg, borderRadius: 8, padding: '6px 12px' }}>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: s.color, fontFamily: 'JetBrains Mono, monospace' }}>{s.count}</div>
              <div style={{ fontSize: '0.6rem', color: '#8890A4', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Bed grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        {beds.map(bed => {
          const meta = STATUS_META[bed.status] || STATUS_META.available
          const clickable = bed.status === 'available'
          return (
            <div
              key={bed.bed_id}
              className={clickable ? 'card card-hover' : 'card'}
              style={{
                padding: '12px 14px',
                border: `1px solid ${meta.border}`,
                background: meta.bg,
                cursor: clickable ? 'pointer' : 'default',
                opacity: bed.status === 'cleaning' ? 0.75 : 1,
              }}
              onClick={() => clickable && setModalBed(bed.bed_id)}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.85rem', fontWeight: 700, color: '#1A1D27' }}>
                  {bed.bed_id}
                </span>
                <span style={{
                  fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase',
                  letterSpacing: '0.05em', color: meta.color,
                }}>
                  {meta.label}
                </span>
              </div>

              {bed.case_id && (
                <div style={{ fontSize: '0.7rem', color: '#8890A4', marginTop: 2 }}>
                  Case: <span style={{ color: '#4B5263', fontFamily: 'JetBrains Mono, monospace' }}>{bed.case_id}</span>
                </div>
              )}
              {bed.reserved_by && (
                <div style={{ fontSize: '0.68rem', color: '#8890A4' }}>By: {bed.reserved_by}</div>
              )}

              {clickable && (
                <div style={{ marginTop: 8, fontSize: '0.68rem', color: '#2563EB', fontWeight: 500 }}>
                  + Reserve
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Reserve modal */}
      {modalBed && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(26,29,39,0.35)',
          backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 50,
        }}>
          <div className="card" style={{
            width: 340, padding: '24px',
            boxShadow: '0 20px 50px rgba(0,0,0,0.14)',
            animation: 'slideUp 0.22s ease-out',
          }}>
            <h3 style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1A1D27', margin: '0 0 4px' }}>
              Reserve {modalBed}
            </h3>
            <p style={{ fontSize: '0.72rem', color: '#8890A4', margin: '0 0 18px' }}>
              Enter case details to reserve this bed.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input
                className="field"
                placeholder="Case ID  (e.g. CASE-001)"
                value={form.caseId}
                onChange={e => setForm(f => ({ ...f, caseId: e.target.value }))}
              />
              <input
                className="field"
                placeholder="Reserved by (nurse name)"
                value={form.reservedBy}
                onChange={e => setForm(f => ({ ...f, reservedBy: e.target.value }))}
              />
              {error && (
                <p style={{ fontSize: '0.72rem', color: '#C7344C', margin: 0 }}>{error}</p>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button className="btn-primary" style={{ flex: 1 }} onClick={reserve} disabled={!!reserving}>
                  {reserving ? 'Reserving…' : 'Reserve Bed'}
                </button>
                <button className="btn-ghost" style={{ flex: 1 }} onClick={() => { setModalBed(null); setError('') }}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
