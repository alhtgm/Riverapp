import { useEffect, useRef } from 'react'

const PRESET_COLORS = [
  '#E16259', '#F97316', '#D97706', '#16A34A',
  '#0891B2', '#3B63FF', '#7C3AED', '#DB2777',
  '#64748B', '#78716C', '#0F766E', '#15803D',
  '#1D4ED8', '#6D28D9', '#BE185D', '#B45309',
]

interface Props {
  value: string
  onChange: (color: string) => void
  onClose: () => void
  position?: { top?: number | string; left?: number | string; right?: number | string; bottom?: number | string }
}

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
      style={{
        position: 'absolute',
        ...position,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        boxShadow: '0 8px 32px rgba(20,16,10,0.14), 0 2px 8px rgba(20,16,10,0.08)',
        padding: 12,
        zIndex: 300,
        width: 172,
        animation: 'quickMenuIn 0.2s cubic-bezier(0.16,1,0.3,1)',
      }}
    >
      <div style={{
        fontSize: 9,
        fontWeight: 700,
        color: 'var(--text-disabled)',
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        marginBottom: 8,
      }}>
        科目カラー
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
        {PRESET_COLORS.map(c => (
          <button
            key={c}
            onClick={() => { onChange(c); onClose() }}
            title={c}
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: c,
              border: value === c ? '2px solid var(--text-primary)' : '2px solid transparent',
              cursor: 'pointer',
              outline: 'none',
              boxShadow: value === c ? `0 0 0 2px var(--surface), 0 0 0 4px ${c}` : 'none',
              transition: 'all 0.15s',
              padding: 0,
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.12)' }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
          />
        ))}
      </div>
      <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
        <input
          type="color"
          value={value}
          onChange={e => onChange(e.target.value)}
          style={{ width: 32, height: 28, borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer', padding: 2, background: 'var(--surface)' }}
        />
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'monospace', letterSpacing: '0.02em' }}>
          {value}
        </span>
      </div>
    </div>
  )
}
