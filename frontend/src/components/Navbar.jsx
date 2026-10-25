import { useEffect, useState } from 'react'
import { 
  Activity, 
  ShieldAlert, 
  Bed, 
  Pill, 
  FileText, 
  Server, 
  Clock, 
  User, 
  Bell, 
  Radio, 
  ExternalLink,
  ChevronDown,
  Building2
} from 'lucide-react'
import { useCases } from '../context/CasesContext'

export default function Navbar({ currentView, onViewChange, wsConnected }) {
  const { state } = useCases()
  const [utcTime, setUtcTime] = useState('')

  // Live hospital clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      setUtcTime(now.toTimeString().split(' ')[0] + ' UTC')
    }
    updateTime()
    const timer = setInterval(updateTime, 1000)
    return () => clearInterval(timer)
  }, [])

  const unackedAlerts = state.alerts.filter(a => !a.acknowledged).length

  const NAV_ITEMS = [
    { id: 'landing',   label: 'Platform Overview', icon: Building2 },
    { id: 'command',   label: 'Command Center',    icon: Activity, badge: unackedAlerts > 0 ? unackedAlerts : null },
    { id: 'meds',      label: 'Medication Safety', icon: Pill },
    { id: 'audit',     label: 'Clinical Audit',    icon: FileText },
    { id: 'cluster',   label: 'Cluster Health',    icon: Server },
  ]

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200">
      {/* ── Top Bar ──────────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
        
        {/* Brand & Hospital Unit */}
        <div className="flex items-center gap-3">
          <div 
            onClick={() => onViewChange('landing')}
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-sm group-hover:scale-105 transition-transform">
              VS
            </div>
            <div>
              <div className="font-extrabold text-sm text-slate-900 tracking-tight flex items-center gap-1.5">
                <span>VitalStream</span>
                <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                  PROD v1.4
                </span>
              </div>
              <div className="text-[11px] text-slate-500 font-medium">
                St. Jude Memorial Hospital · OR Suite 1-6
              </div>
            </div>
          </div>
        </div>

        {/* Center / Right Hospital Status Bar */}
        <div className="flex items-center gap-4">
          
          {/* Hospital Clock */}
          <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200/80 text-xs font-mono text-slate-600">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>{utcTime || '00:00:00 UTC'}</span>
          </div>

          {/* WebSocket Live Indicator */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200/80 text-xs">
            <span className={wsConnected ? 'live-pulse' : 'w-2 h-2 rounded-full bg-amber-400'} />
            <span className="font-medium text-slate-600">
              {wsConnected ? 'WebSocket Live' : 'Reconnecting…'}
            </span>
          </div>

          {/* Notification Bell with Badge */}
          <button 
            onClick={() => onViewChange('command')}
            className="relative p-2 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
            title="Alerts Queue"
          >
            <Bell className="w-4 h-4" />
            {unackedAlerts > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white" />
            )}
          </button>

          {/* Clinical Staff Indicator */}
          <div className="flex items-center gap-2.5 pl-3 border-l border-slate-200">
            <div className="w-8 h-8 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 font-semibold text-xs">
              <User className="w-4 h-4" />
            </div>
            <div className="hidden lg:block text-left">
              <div className="text-xs font-bold text-slate-800 leading-tight">Clinical Staff</div>
              <div className="text-[10px] text-slate-500 font-medium">Perioperative Care Team</div>
            </div>
          </div>

        </div>
      </div>

      {/* ── Secondary Navigation Strip ────────────────────────────────────── */}
      <div className="bg-slate-50/60 border-t border-slate-200/60 px-6">
        <div className="max-w-7xl mx-auto flex items-center gap-1 overflow-x-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const isActive = currentView === item.id
            return (
              <button
                key={item.id}
                onClick={() => onViewChange(item.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold whitespace-nowrap transition-all border-b-2 -mb-[1px]
                  ${isActive 
                    ? 'border-blue-600 text-blue-600 bg-white shadow-sm rounded-t-md' 
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-white/50'}`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                <span>{item.label}</span>
                {item.badge && (
                  <span className="ml-1 px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-bold">
                    {item.badge}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </header>
  )
}
