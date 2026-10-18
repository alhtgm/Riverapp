import { createContext, useContext, useState, useCallback, useRef } from 'react'
import './m3.css'

/** info はほかの人の操作で届いたお知らせ（フレンド申請など）。少し長めに表示する */
type ToastType = 'success' | 'error' | 'info'

interface ToastItem {
  id: number
  message: string
  type: ToastType
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} })

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  return useContext(ToastContext)
}

/** 反転した面（スナックバー）の上でも読めるよう、アイコンの色を背景側に寄せる */
const iconColor: Record<ToastType, string> = {
  success: 'color-mix(in oklab, var(--st-done) 60%, var(--surface))',
  error: 'color-mix(in oklab, var(--danger) 60%, var(--surface))',
  info: 'color-mix(in oklab, var(--accent) 60%, var(--surface))',
}

/**
 * 画面下に短く出るお知らせ（M3 のスナックバー。見た目は m3.css の .m3-snackbar）。
 * 右下の「課題を追加」ボタンにかぶらないよう、その上に出す。
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(0)

  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    const id = ++nextId.current
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, type === 'info' ? 5000 : 4000)
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        className="m3-snackbar-host"
        style={{ bottom: 'calc(88px + env(safe-area-inset-bottom))', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-2)', zIndex: 9999 }}
        aria-live="polite"
        aria-atomic="false"
      >
        {toasts.map(toast => (
          <div key={toast.id} className="m3-snackbar" role={toast.type === 'error' ? 'alert' : 'status'} style={{ paddingRight: 'var(--space-4)' }}>
            <span aria-hidden="true" style={{ display: 'flex', flexShrink: 0, color: iconColor[toast.type] }}>
              {toast.type === 'info' ? (
                <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
                  <path d="M4 11V7a4 4 0 118 0v4l1.2 1.5H2.8L4 11z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                  <path d="M6.5 14a1.6 1.6 0 003 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              ) : toast.type === 'success' ? (
                <svg width="18" height="18" viewBox="0 0 14 14" fill="none">
                  <circle cx="7" cy="7" r="6.2" stroke="currentColor" strokeWidth="1.2" />
                  <path d="M4 7l2 2 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 14 14" fill="none">
                  <circle cx="7" cy="7" r="6.2" stroke="currentColor" strokeWidth="1.2" />
                  <path d="M7 4v4M7 9.5v.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              )}
            </span>
            <span className="m3-snackbar__text">{toast.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
