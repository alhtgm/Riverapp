import { useEffect, useRef } from 'react'
import './m3.css'

/** 講義の色の候補（ユーザーが選んで保存する色なので、テーマとは別にそのまま持つ） */
const PRESET_COLORS = [
  '#E16259', '#F97316', '#D97706', '#16A34A',
  '#0891B2', '#06B6D4', '#7C3AED', '#DB2777',
  '#64748B', '#78716C', '#0F766E', '#15803D',
  '#1D4ED8', '#6D28D9', '#BE185D', '#B45309',
]

interface Props {
  value: string
  onChange: (color: string) => void
  onClose: () => void
  position?: { top?: number | string; left?: number | string; right?: number | string; bottom?: number | string }
}

/** 講義の色を選ぶ小さなパネル（M3: 角 16px・影 Level 2。色の見本は 36px、押せる範囲は 48px） */
export default function ColorPicker({ value, onChange, onClose, position }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const keyHandler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    setTimeout(() => {
      document.addEventListener('mousedown', handler)
      document.addEventListener('keydown', keyHandler)
    }, 0)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('keydown', keyHandler)
    }
  }, [onClose])

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="講義の色"
      onClick={e => e.stopPropagation()}
      style={{
        position: 'absolute',
        ...position,
        background: 'var(--surface-warm)',
        borderRadius: 'var(--shape-lg)',
        boxShadow: 'var(--elevation-2)',
        padding: 'var(--space-4)',
        zIndex: 300,
        width: 'max-content',
        animation: 'm3-menu-in var(--motion-duration-medium1) var(--motion-easing-emphasized-decelerate)',
        cursor: 'default',
      }}
    >
      <div style={{
        fontSize: 'var(--type-label-large-size)',
        lineHeight: 'var(--type-label-large-line)',
        fontWeight: 'var(--type-label-large-weight)',
        color: 'var(--text-secondary)',
        marginBottom: 'var(--space-3)',
      }}>
        講義の色
      </div>
      <div role="radiogroup" aria-label="講義の色の候補" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 36px)', gap: 'var(--space-3)' }}>
        {PRESET_COLORS.map(c => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={value === c}
            aria-label={`色 ${c}`}
            className="m3-state m3-target"
            onClick={() => { onChange(c); onClose() }}
            style={{
              width: 36,
              height: 36,
              borderRadius: 'var(--shape-full)',
              background: c,
              border: '3px solid var(--surface-warm)',
              cursor: 'pointer',
              boxShadow: value === c ? '0 0 0 2px var(--text-primary)' : 'none',
              padding: 0,
            }}
          />
        ))}
      </div>
      <label style={{ marginTop: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer' }}>
        <input
          type="color"
          value={value}
          onChange={e => onChange(e.target.value)}
          style={{ width: 40, height: 40, borderRadius: 'var(--shape-xs)', border: '1px solid var(--border-strong)', cursor: 'pointer', padding: 'var(--space-1)', background: 'var(--surface)' }}
        />
        <span style={{
          fontSize: 'var(--type-body-small-size)', lineHeight: 'var(--type-body-small-line)',
          color: 'var(--text-secondary)', fontFamily: 'ui-monospace, monospace',
        }}>
          好きな色: {value}
        </span>
      </label>
    </div>
  )
}
