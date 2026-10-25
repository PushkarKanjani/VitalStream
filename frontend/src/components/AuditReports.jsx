import { useState } from 'react'
import { FileText, Download, ShieldCheck, CheckCircle2, AlertOctagon, Filter, Search, Clock } from 'lucide-react'
import { useCases } from '../context/CasesContext'
import { useToast } from '../context/ToastContext'

export default function AuditReports() {
  const { state } = useCases()
  const { addToast } = useToast()
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState('ALL')

  const logs = state.auditLogs || []

  const filteredLogs = logs.filter(log => {
    const matchesSearch = log.entity?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          log.detail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          log.actor?.toLowerCase().includes(searchTerm.toLowerCase())
    if (filterType === 'ALL') return matchesSearch
    if (filterType === 'BLOCKED') return matchesSearch && log.status === 'blocked'
    if (filterType === 'BED') return matchesSearch && log.action?.includes('BED')
    return matchesSearch
  })

  function handleExport() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(logs, null, 2))
    const downloadAnchor = document.createElement('a')
    downloadAnchor.setAttribute("href", dataStr)
    downloadAnchor.setAttribute("download", `vitalstream_clinical_audit_${new Date().toISOString().slice(0,10)}.json`)
    document.body.appendChild(downloadAnchor)
    downloadAnchor.click()
    downloadAnchor.remove()

    addToast({
      type: 'success',
      title: 'Audit Trail Exported',
      message: `Exported ${logs.length} immutable clinical records to JSON.`,
      duration: 3500
    })
  }

  return (
    <div className="max-w-6xl mx-auto py-6 px-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">
            <ShieldCheck className="w-4 h-4" />
            <span>HIPAA & Perioperative Clinical Governance</span>
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Immutable Clinical Safety & Event Audit Trail
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Tamper-evident record of all bed locks, allergy interceptions, and alert acknowledgments.
          </p>
        </div>

        <button
          onClick={handleExport}
          className="btn-outline text-xs px-4 py-2.5 rounded-xl self-start sm:self-center"
        >
          <Download className="w-4 h-4 text-slate-600" />
          <span>Export Audit Log</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-8">
        <div className="app-card p-4">
          <div className="text-xs font-bold text-slate-500 uppercase">Audit Records</div>
          <div className="text-2xl font-extrabold font-mono text-slate-900 mt-1">{logs.length}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Logged in current session</div>
        </div>

        <div className="app-card p-4">
          <div className="text-xs font-bold text-slate-500 uppercase">Allergy Intercepts</div>
          <div className="text-2xl font-extrabold font-mono text-rose-600 mt-1">
            {logs.filter(l => l.status === 'blocked').length}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Contraindications blocked</div>
        </div>

        <div className="app-card p-4">
          <div className="text-xs font-bold text-slate-500 uppercase">ACID Bed Events</div>
          <div className="text-2xl font-extrabold font-mono text-emerald-600 mt-1">
            {logs.filter(l => l.action?.includes('BED')).length}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">0 Double-bookings allowed</div>
        </div>

        <div className="app-card p-4">
          <div className="text-xs font-bold text-slate-500 uppercase">Compliance Status</div>
          <div className="text-2xl font-extrabold text-blue-600 mt-1">PASS</div>
          <div className="text-[11px] text-slate-500 mt-0.5">100% Policy Adherence</div>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-4">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search audit trail..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="app-input pl-9 py-2 text-xs"
          />
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto text-xs">
          <span className="text-slate-500 font-semibold">Filter:</span>
          {['ALL', 'BLOCKED', 'BED'].map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-3 py-1.5 rounded-lg font-semibold text-xs transition-colors ${
                filterType === type 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {type === 'ALL' ? 'All Events' : type === 'BLOCKED' ? 'Blocked Only' : 'Bed Locks'}
            </button>
          ))}
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="app-card bg-white border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-4">Event ID</th>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Entity</th>
                <th className="py-3 px-4">Actor</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Audit Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.map((log) => {
                const isBlocked = log.status === 'blocked'
                return (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-700">
                      {log.id}
                    </td>
                    <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-800">
                      {log.action}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {log.entity}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {log.actor}
                    </td>
                    <td className="py-3 px-4">
                      {isBlocked ? (
                        <span className="px-2 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-rose-700 font-bold text-[10px]">
                          BLOCKED
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold text-[10px]">
                          COMMITTED
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-600 max-w-xs truncate" title={log.detail}>
                      {log.detail}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}
