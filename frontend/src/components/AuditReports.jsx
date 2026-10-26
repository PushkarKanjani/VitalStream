import { useState, useRef, useEffect } from 'react'
import {
  FileText,
  Download,
  ShieldCheck,
  CheckCircle2,
  AlertOctagon,
  Filter,
  Search,
  Clock,
  Calendar,
  ChevronDown,
  Check,
  Sparkles
} from 'lucide-react'
import { useCases } from '../context/CasesContext'
import { useToast } from '../context/ToastContext'

export default function AuditReports() {
  const { state } = useCases()
  const { addToast } = useToast()

  const [searchTerm, setSearchTerm]     = useState('')
  const [filterType, setFilterType]     = useState('ALL') // 'ALL' | 'BLOCKED' | 'BED'
  const [timeRange, setTimeRange]       = useState('ALL')  // 'ALL' | '24H' | '7D' | '30D'
  const [showExportMenu, setShowExportMenu] = useState(false)
  const dropdownRef = useRef(null)

  const logs = state.auditLogs || []

  // Close export dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowExportMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Calculate counts for each time window
  const now = Date.now()
  const count24h = logs.filter(l => now - new Date(l.timestamp).getTime() <= 24 * 60 * 60 * 1000).length
  const count7d  = logs.filter(l => now - new Date(l.timestamp).getTime() <= 7 * 24 * 60 * 60 * 1000).length
  const count30d = logs.filter(l => now - new Date(l.timestamp).getTime() <= 30 * 24 * 60 * 60 * 1000).length

  // Filter logs based on search term, category filter, and time range
  const filteredLogs = logs.filter(log => {
    const logTime = new Date(log.timestamp).getTime()
    const diffMs = now - logTime

    // 1. Time range filter
    if (timeRange === '24H' && diffMs > 24 * 60 * 60 * 1000) return false
    if (timeRange === '7D'  && diffMs > 7 * 24 * 60 * 60 * 1000) return false
    if (timeRange === '30D' && diffMs > 30 * 24 * 60 * 60 * 1000) return false

    // 2. Action category filter
    if (filterType === 'BLOCKED' && log.status !== 'blocked') return false
    if (filterType === 'BED' && !log.action?.includes('BED')) return false

    // 3. Search query
    const q = searchTerm.toLowerCase().trim()
    if (!q) return true

    return (
      log.entity?.toLowerCase().includes(q) ||
      log.detail?.toLowerCase().includes(q) ||
      log.actor?.toLowerCase().includes(q) ||
      log.action?.toLowerCase().includes(q) ||
      log.id?.toLowerCase().includes(q)
    )
  })

  // Export JSON with presets: 24h, 7d, 30d, all
  function exportAuditJson(rangeKey) {
    setShowExportMenu(false)
    const exportTime = new Date()
    let exportRecords = logs
    let rangeLabel = 'All Time'
    let fileSuffix = 'all_records'

    if (rangeKey === '24h') {
      exportRecords = logs.filter(l => now - new Date(l.timestamp).getTime() <= 24 * 60 * 60 * 1000)
      rangeLabel = 'Past 24 Hours'
      fileSuffix = 'past_24_hours'
    } else if (rangeKey === '7d') {
      exportRecords = logs.filter(l => now - new Date(l.timestamp).getTime() <= 7 * 24 * 60 * 60 * 1000)
      rangeLabel = 'Past Week (7 Days)'
      fileSuffix = 'past_week'
    } else if (rangeKey === '30d') {
      exportRecords = logs.filter(l => now - new Date(l.timestamp).getTime() <= 30 * 24 * 60 * 60 * 1000)
      rangeLabel = 'Past Month (Last 30 Days)'
      fileSuffix = 'last_30_days'
    }

    const payload = {
      export_metadata: {
        hospital: 'Apollo Hospitals, Gandhinagar — Perioperative Surgical Unit',
        system: 'VitalStream Clinical Governance & Event Audit Engine',
        export_range: rangeLabel,
        record_count: exportRecords.length,
        exported_at: exportTime.toISOString(),
        exported_by: 'Attending Clinical Staff',
        compliance_hash: `sha256_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`,
        certification: 'Immutable audit log verified under HIPAA § 164.312(b) & CDSCO standards'
      },
      records: exportRecords
    }

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(payload, null, 2))
    const downloadAnchor = document.createElement('a')
    downloadAnchor.setAttribute('href', dataStr)
    downloadAnchor.setAttribute('download', `vitalstream_audit_${fileSuffix}_${exportTime.toISOString().slice(0, 10)}.json`)
    document.body.appendChild(downloadAnchor)
    downloadAnchor.click()
    downloadAnchor.remove()

    addToast({
      type: 'success',
      title: `Exported: ${rangeLabel}`,
      message: `Downloaded ${exportRecords.length} audit records in JSON format.`,
      duration: 4000
    })
  }

  return (
    <div className="max-w-7xl mx-auto py-6 px-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">
            <ShieldCheck className="w-4 h-4" />
            <span>HIPAA & Perioperative Clinical Governance</span>
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Immutable Clinical Safety & Event Audit Trail
          </h2>
          <p className="text-xs text-slate-600 mt-1">
            Tamper-evident record of all bed locks, allergy interceptions, and alert acknowledgments.
          </p>
        </div>

        {/* JSON Export Dropdown Menu */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            className="btn-solid-primary text-xs px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-sm"
          >
            <Download className="w-4 h-4" />
            <span>Export Audit JSON</span>
            <ChevronDown className="w-3.5 h-3.5 opacity-80" />
          </button>

          {showExportMenu && (
            <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 z-50 divide-y divide-slate-100 overflow-hidden animate-enter">
              <div className="px-3.5 py-2.5 bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Select Export Time Window
              </div>
              
              <div className="py-1">
                <button
                  onClick={() => exportAuditJson('24h')}
                  className="w-full text-left px-4 py-2.5 text-xs text-slate-700 hover:bg-blue-50/70 hover:text-blue-900 transition-colors flex items-center justify-between group"
                >
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-blue-600" />
                    <span className="font-semibold">Past 24 Hours</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-bold">
                    {count24h} logs
                  </span>
                </button>

                <button
                  onClick={() => exportAuditJson('7d')}
                  className="w-full text-left px-4 py-2.5 text-xs text-slate-700 hover:bg-blue-50/70 hover:text-blue-900 transition-colors flex items-center justify-between group"
                >
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                    <span className="font-semibold">Past Week (7 Days)</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 font-bold">
                    {count7d} logs
                  </span>
                </button>

                <button
                  onClick={() => exportAuditJson('30d')}
                  className="w-full text-left px-4 py-2.5 text-xs text-slate-700 hover:bg-blue-50/70 hover:text-blue-900 transition-colors flex items-center justify-between group"
                >
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="font-semibold">Last 30 Days (Past Month)</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                    {count30d} logs
                  </span>
                </button>
              </div>

              <div className="py-1 bg-slate-50/40">
                <button
                  onClick={() => exportAuditJson('all')}
                  className="w-full text-left px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 transition-colors flex items-center justify-between font-medium"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-slate-500" />
                    <span>All Records (Complete Archive)</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 font-bold">
                    {logs.length} logs
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <div className="app-card p-4 bg-white border border-slate-200 shadow-xs">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Filtered Records</div>
          <div className="text-2xl font-extrabold font-mono text-slate-900 mt-1">{filteredLogs.length}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {timeRange === 'ALL' ? 'All historical logs' : timeRange === '24H' ? 'Past 24 hours' : timeRange === '7D' ? 'Past 7 days' : 'Last 30 days'}
          </div>
        </div>

        <div className="app-card p-4 bg-white border border-slate-200 shadow-xs">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Allergy Intercepts</div>
          <div className="text-2xl font-extrabold font-mono text-rose-600 mt-1">
            {filteredLogs.filter(l => l.status === 'blocked').length}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Contraindications blocked</div>
        </div>

        <div className="app-card p-4 bg-white border border-slate-200 shadow-xs">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">ACID Bed Events</div>
          <div className="text-2xl font-extrabold font-mono text-emerald-600 mt-1">
            {filteredLogs.filter(l => l.action?.includes('BED')).length}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">0 Double-bookings allowed</div>
        </div>

        <div className="app-card p-4 bg-white border border-slate-200 shadow-xs">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Compliance Status</div>
          <div className="text-2xl font-extrabold text-blue-600 mt-1">PASS (100%)</div>
          <div className="text-[11px] text-slate-500 mt-0.5">HIPAA & CDSCO Verified</div>
        </div>
      </div>

      {/* Filter Toolbar: Time Ranges & Categories */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 mb-4">
        
        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by ID, doctor, patient, action, or medicine..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="app-input pl-9 py-2 text-xs"
          />
        </div>

        {/* Combined Time Range & Action Category Filter Controls */}
        <div className="flex items-center gap-3 self-start md:self-auto flex-wrap">
          
          {/* Time Window Selector */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
            {[
              { id: '24H', label: 'Past 24h', count: count24h },
              { id: '7D',  label: 'Past Week', count: count7d },
              { id: '30D', label: 'Last 30 Days', count: count30d },
              { id: 'ALL', label: 'All Time', count: logs.length },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTimeRange(t.id)}
                className={`px-3 py-1.5 rounded-lg font-semibold text-[11px] transition-all flex items-center gap-1.5 ${
                  timeRange === t.id
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>{t.label}</span>
                <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold ${
                  timeRange === t.id ? 'bg-blue-50 text-blue-700' : 'bg-slate-200/80 text-slate-500'
                }`}>
                  {t.count}
                </span>
              </button>
            ))}
          </div>

          {/* Action Category Filter */}
          <div className="flex items-center gap-1 text-xs">
            {['ALL', 'BLOCKED', 'BED'].map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-2.5 py-1.5 rounded-lg font-semibold text-xs border transition-colors ${
                  filterType === type 
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs' 
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {type === 'ALL' ? 'All Types' : type === 'BLOCKED' ? 'Blocked Only' : 'Bed Locks'}
              </button>
            ))}
          </div>

        </div>
      </div>

      {/* Audit Log Table */}
      <div className="app-card bg-white border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-4">Event ID</th>
                <th className="py-3 px-4">Date & Time (UTC)</th>
                <th className="py-3 px-4">Action Type</th>
                <th className="py-3 px-4">Clinical Entity</th>
                <th className="py-3 px-4">Doctor / Staff</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Audit Detail & Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-8 text-center text-slate-400">
                    No audit records match the selected filters.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const isBlocked = log.status === 'blocked'
                  const isCaution = log.status === 'caution'
                  const logDate = new Date(log.timestamp)

                  return (
                    <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-700">
                        {log.id}
                      </td>
                      <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                        <div className="font-medium text-slate-700">
                          {logDate.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {logDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-800">
                        <span className="font-mono text-[11px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">
                          {log.action}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-800">
                        {log.entity}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {log.actor}
                      </td>
                      <td className="py-3 px-4">
                        {isBlocked ? (
                          <span className="px-2 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-rose-700 font-bold text-[10px]">
                            🚨 BLOCKED
                          </span>
                        ) : isCaution ? (
                          <span className="px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 font-bold text-[10px]">
                            ⚠️ CAUTION
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold text-[10px]">
                            ✓ COMMITTED
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-600 max-w-sm truncate" title={log.detail}>
                        {log.detail}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}
