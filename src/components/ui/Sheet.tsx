import { useEffect, useRef, type ReactNode, type CSSProperties } from 'react'

const openSheets: (() => void)[] = []
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape' && openSheets.length > 0) openSheets[openSheets.length - 1]()
  })
}

interface Props {
  title: ReactNode
  /** タイトルの下に出す一言の説明 */
  subtitle?: ReactNode
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  /** 右上の閉じるボタンの左に並べる要素 */
  headerExtra?: ReactNode
  width?: number
  /** 指定するとタブ切り替えなどで高さが変わらない固定の高さになる */
  height?: number
  /** 重ねて開くとき用（既定 300） */
  zIndex?: number
}

/** 画面中央のモーダル（スマートフォンでは下からのシート） */
export default function Sheet({ title, subtitle, onClose, children, footer, headerExtra, width = 520, height, zIndex = 300 }: Props) {
  // 重ねて開いているときは、Esc で一番上のシートだけを閉じる
  const closeRef = useRef(onClose)
  useEffect(() => { closeRef.current = onClose }, [onClose])
  useEffect(() => {
    const entry = () => closeRef.current()
    openSheets.push(entry)
    return () => {
      const i = openSheets.lastIndexOf(entry)
      if (i >= 0) openSheets.splice(i, 1)
    }
  }, [])

  return (
    <>
      <style>{`
        @keyframes sheetFade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes sheetUp { from { transform: translateY(16px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
        .river-sheet-body > * { flex-shrink: 0; }
        @media (max-width: 639px) {
          .river-sheet-wrap { align-items: flex-end !important; padding: 0 !important; }
          .river-sheet { width: 100vw !important; max-height: 92svh !important; border-radius: 16px 16px 0 0 !important; }
          .river-sheet[data-fixed-height] { height: 92svh !important; }
        }
      `}</style>
      <div
        className="river-sheet-wrap"
        style={{
          position: 'fixed', inset: 0, zIndex,
          background: 'rgba(20,18,40,0.32)',
          backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
          animation: 'sheetFade 0.18s ease-out',
        }}
        onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
      >
        <div
          className="river-sheet"
          data-fixed-height={height ? '' : undefined}
          role="dialog"
          aria-modal="true"
          style={{
            width: `min(${width}px, calc(100vw - 32px))`,
            height: height ? `min(${height}px, 88svh)` : undefined,
            maxHeight: 'min(88svh, 900px)',
            borderRadius: 14,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-xl)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
            animation: 'sheetUp 0.24s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <div style={{
            padding: '14px 20px', borderBottom: '1px solid var(--border-light)',
            display: 'flex', alignItems: 'center', gap: 10, background: 'var(--surface-warm)', flexShrink: 0,
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{title}</div>
              {subtitle && <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{subtitle}</div>}
            </div>
            {headerExtra}
            <button onClick={onClose} aria-label="閉じる" style={iconButton}>
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          <div className="river-sheet-body" style={{ padding: 20, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 24 }}>
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
