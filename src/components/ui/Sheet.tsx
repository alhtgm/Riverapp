import { useEffect, type ReactNode, type CSSProperties } from 'react'

interface Props {
  title: ReactNode
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  /** 右上の閉じるボタンの左に並べる要素 */
  headerExtra?: ReactNode
  width?: number
  /** 重ねて開くとき用（既定 300） */
  zIndex?: number
}

/** 画面中央のモーダル（スマートフォンでは下からのシート） */
export default function Sheet({ title, onClose, children, footer, headerExtra, width = 520, zIndex = 300 }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <>
      <style>{`
        @keyframes sheetFade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes sheetUp { from { transform: translateY(16px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
        .river-sheet { width: min(${width}px, calc(100vw - 32px)); max-height: min(86svh, 760px); border-radius: 14px; }
        @media (max-width: 639px) {
          .river-sheet-wrap { align-items: flex-end !important; padding: 0 !important; }
          .river-sheet { width: 100vw; max-height: 92svh; border-radius: 16px 16px 0 0; }
        }
      `}</style>
      <div
        className="river-sheet-wrap"
        style={{
          position: 'fixed', inset: 0, zIndex,
          background: 'rgba(20,16,10,0.32)',
          backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
          animation: 'sheetFade 0.18s ease-out',
        }}
        onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
      >
        <div
          className="river-sheet"
          role="dialog"
          aria-modal="true"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-xl)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
            animation: 'sheetUp 0.24s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <div style={{
            padding: '14px 18px', borderBottom: '1px solid var(--border-light)',
            display: 'flex', alignItems: 'center', gap: 10, background: 'var(--surface-warm)', flexShrink: 0,
          }}>
            <div style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              {title}
            </div>
            {headerExtra}
            <button onClick={onClose} aria-label="閉じる" style={iconButton}>
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          <div style={{ padding: 18, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 18 }}>
            {children}
          </div>
          {footer && (
            <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border-light)', background: 'var(--surface-warm)', flexShrink: 0 }}>
              {footer}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

const iconButton: CSSProperties = {
  background: 'var(--bg-secondary)', border: 'none', borderRadius: 6,
  width: 28, height: 28, cursor: 'pointer', color: 'var(--text-secondary)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
}

/** 名前の頭文字アイコン */
export function Avatar({ name, size = 26 }: { name: string | null; size?: number }) {
  const ch = (name ?? '?').trim().charAt(0) || '?'
  let hash = 0
  for (const c of name ?? '?') hash = (hash * 31 + c.charCodeAt(0)) % 360
  return (
    <span
      title={name ?? undefined}
      style={{
        width: size, height: size, borderRadius: '50%', flexShrink: 0,
        background: `hsl(${hash} 55% 88%)`, color: `hsl(${hash} 45% 32%)`,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontSize: Math.round(size * 0.46), fontWeight: 700, border: '2px solid var(--surface)',
      }}
    >
      {ch}
    </span>
  )
}

export function ErrorText({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <div style={{ padding: '10px 12px', background: 'var(--danger-bg)', color: 'var(--danger)', border: '1px solid rgba(220,38,38,0.25)', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>
      {message}
    </div>
  )
}
