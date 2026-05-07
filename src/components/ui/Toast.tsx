import { createContext, useContext, useState, useCallback, useRef } from 'react'

type ToastType = 'success' | 'error'

interface ToastItem {
  id: number
  message: string
  type: ToastType
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} })

export function useToast() {
  return useContext(ToastContext)
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(0)

  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    const id = ++nextId.current
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 3200)
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          zIndex: 9999,
          pointerEvents: 'none',
        }}
        aria-live="polite"
        aria-atomic="false"
      >
        {toasts.map(toast => (
          <div
            key={toast.id}
            role="status"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '11px 16px',
              background: toast.type === 'success' ? '#1C1917' : '#FEF2F2',
              color: toast.type === 'success' ? '#FFFFFF' : '#DC2626',
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 500,
              letterSpacing: '-0.02em',
              boxShadow: '0 4px 20px rgba(20,16,10,0.18), 0 1px 4px rgba(20,16,10,0.1)',
              border: toast.type === 'error' ? '1px solid rgba(220,38,38,0.25)' : 'none',
              pointerEvents: 'auto',
              animation: 'toastIn 0.22s cubic-bezier(0.34,1.56,0.64,1)',
              fontFamily: 'inherit',
              minWidth: 160,
              maxWidth: 320,
            }}
          >
            {toast.type === 'success' ? (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
                <circle cx="7" cy="7" r="6.5" stroke="rgba(255,255,255,0.35)" strokeWidth="1"/>
                <path d="M4 7l2 2 4-4" stroke="#4ADE80" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
                <circle cx="7" cy="7" r="6.5" stroke="rgba(220,38,38,0.4)" strokeWidth="1"/>
                <path d="M7 4v4M7 9.5v.5" stroke="#DC2626" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            )}
            {toast.message}
          </div>
        ))}
      </div>
      <style>{`
        @keyframes toastIn {
          from { opacity: 0; transform: translateY(10px) scale(0.95); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </ToastContext.Provider>
  )
}
