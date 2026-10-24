import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Chip } from '../ui/m3'
import '../ui/m3.css'

/** メニューが画面からはみ出さないための余白 */
const EDGE = 8

const dropdownIcon = (open: boolean) => (
  <svg width="18" height="18" viewBox="0 0 10 10" fill="none" aria-hidden="true"
    style={{ marginLeft: 2, marginRight: -4, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform var(--motion-duration-short4) var(--motion-easing-standard)' }}>
    <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const checkIcon = (
  <svg width="20" height="20" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M3 8.5l3 3 7-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

/**
 * 絞り込みバーのチップ。押すと下に選択肢のメニューが開く（M3 の filter chip + menu）。
 * 絞り込みバーは横にスクロールするので、メニューはチップの位置に合わせて画面に固定して出す。
 * active: 初期値から変えているとき、チップを選択中の見た目にする
 */
export function FilterMenuChip({ label, active, menuLabel, icon, width = 240, children }: {
  label: ReactNode
  active: boolean
  /** 読み上げ用のメニューの名前 */
  menuLabel: string
  icon?: ReactNode
  width?: number
  /** メニューの中身。close を呼ぶと閉じる */
  children: (close: () => void) => ReactNode
}) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const wrapRef = useRef<HTMLSpanElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const open = pos !== null
  const close = () => setPos(null)

  const toggle = () => {
    if (open) { close(); return }
    const rect = wrapRef.current?.getBoundingClientRect()
    if (!rect) return
    const menuWidth = Math.min(width, window.innerWidth - EDGE * 2)
    setPos({
      top: rect.bottom + 4,
      left: Math.max(EDGE, Math.min(rect.left, window.innerWidth - menuWidth - EDGE)),
    })
  }

  useEffect(() => {
    if (!open) return
    const handleDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (!menuRef.current?.contains(t) && !wrapRef.current?.contains(t)) setPos(null)
    }
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPos(null) }
    // チップの位置が変わるとメニューがずれるので、スクロールや画面の大きさが変わったら閉じる
    const handleMove = (e: Event) => { if (!menuRef.current?.contains(e.target as Node)) setPos(null) }
    document.addEventListener('mousedown', handleDown)
    document.addEventListener('keydown', handleKey)
    window.addEventListener('scroll', handleMove, true)
    window.addEventListener('resize', handleMove)
    return () => {
      document.removeEventListener('mousedown', handleDown)
      document.removeEventListener('keydown', handleKey)
      window.removeEventListener('scroll', handleMove, true)
      window.removeEventListener('resize', handleMove)
    }
  }, [open])

  return (
    <span ref={wrapRef} style={{ display: 'inline-flex', flexShrink: 0 }}>
      <Chip
        selected={active}
        icon={icon}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={toggle}
        style={{ whiteSpace: 'nowrap' }}
      >
        {label}
        {dropdownIcon(open)}
      </Chip>
      {pos && (
        <div
          ref={menuRef}
          role="menu"
          aria-label={menuLabel}
          className="m3-menu"
          style={{ top: pos.top, left: pos.left, width: Math.min(width, window.innerWidth - EDGE * 2), zIndex: 200 }}
        >
          {children(close)}
        </div>
      )}
    </span>
  )
}

/** メニューの 1 行。選ばれていると左にチェックが付く（multi なら複数選べる行） */
export function MenuOption({ checked, multi = false, onSelect, leading, description, children }: {
  checked: boolean
  multi?: boolean
  onSelect: () => void
  /** チェックの右に出す小さな印（ステータスの色など） */
  leading?: ReactNode
  /** 項目の下に出す短い説明 */
  description?: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      role={multi ? 'menuitemcheckbox' : 'menuitemradio'}
      aria-checked={checked}
      onClick={onSelect}
      className={`m3-menu-item m3-state${checked ? ' m3-menu-item--selected' : ''}`}
    >
      <span style={{ width: 20, display: 'flex', flexShrink: 0, color: 'var(--accent-dark)' }}>{checked ? checkIcon : null}</span>
      {leading}
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', padding: description ? 'var(--space-2) 0' : undefined }}>
        <span style={{ fontWeight: checked ? 'var(--type-weight-emphasized)' : undefined }}>{children}</span>
        {description && (
          <span style={{
            color: 'var(--text-secondary)', whiteSpace: 'normal',
            fontSize: 'var(--type-body-small-size)', lineHeight: 'var(--type-body-small-line)', fontWeight: 'var(--type-body-small-weight)',
          }}>
            {description}
          </span>
        )}
      </span>
    </button>
  )
}
