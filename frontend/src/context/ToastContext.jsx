import { createContext, useContext, useState, useCallback } from 'react'
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((toast) => {
    const id = Math.random().toString(36).substring(2, 9)
    const newToast = {
      id,
      type: toast.type || 'info', // 'success' | 'error' | 'warning' | 'info'
      title: toast.title,
      message: toast.message,
      duration: toast.duration || 4500,
    }

    setToasts((prev) => [...prev, newToast])

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, newToast.duration)
  }, [])

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      {/* Toast Overlay Container */}
      <div className="fixed top-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map((toast) => {
          const isSuccess = toast.type === 'success'
          const isError   = toast.type === 'error'
          const isWarning = toast.type === 'warning'

          return (
            <div
              key={toast.id}
              className="pointer-events-auto flex items-start gap-3 p-4 rounded-xl bg-white border shadow-lg animate-enter transition-all"
              style={{
                borderColor: isSuccess ? '#A7F3D0' : isError ? '#FECACA' : isWarning ? '#FDE68A' : '#E2E8F0',
                boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.08), 0 8px 10px -6px rgba(15, 23, 42, 0.04)',
              }}
            >
              <div className="shrink-0 mt-0.5">
                {isSuccess && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
                {isError   && <XCircle className="w-5 h-5 text-rose-600" />}
                {isWarning && <AlertTriangle className="w-5 h-5 text-amber-600" />}
                {!isSuccess && !isError && !isWarning && <Info className="w-5 h-5 text-blue-600" />}
              </div>

              <div className="flex-1 min-w-0">
                {toast.title && (
                  <h4 className="text-sm font-semibold text-slate-900 leading-tight">
                    {toast.title}
                  </h4>
                )}
                <p className="text-xs text-slate-600 mt-0.5 leading-snug">
                  {toast.message}
                </p>
              </div>

              <button
                onClick={() => removeToast(toast.id)}
                className="shrink-0 p-1 text-slate-400 hover:text-slate-600 rounded-md transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}
