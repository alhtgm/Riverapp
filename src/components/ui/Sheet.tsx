import { useEffect, useId, useRef, type ReactNode } from 'react'
import { IconButton } from './m3'

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

/**
 * 画面の上に重ねて開くパネル。見た目は M3（m3.css の .m3-modal）。
 * PC・タブレットでは中央のダイアログ、スマートフォン（600px 未満）では下からのシート。
 */
export default function Sheet({ title, subtitle, onClose, children, footer, headerExtra, width = 520, height, zIndex = 300 }: Props) {
  const titleId = useId()
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
    <div
      className="m3-modal-wrap"
      style={{ zIndex }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="m3-modal"
        data-fixed-height={height ? '' : undefined}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={{
          width: `min(${width}px, calc(100vw - 48px))`,
          height: height ? `min(${height}px, 88svh)` : undefined,
        }}
      >
        <div className="m3-modal__handle-area" aria-hidden="true"><div className="m3-sheet__handle" /></div>
        <div className="m3-modal__header">
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 id={titleId} className="m3-modal__title">{title}</h2>
            {subtitle && <p className="m3-modal__subtitle">{subtitle}</p>}
          </div>
          {headerExtra}
          <IconButton label="閉じる" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </IconButton>
        </div>
        <div className="m3-modal__body">
          {children}
        </div>
        {footer && <div className="m3-modal__footer">{footer}</div>}
      </div>
    </div>
  )
}
