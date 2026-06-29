import { useState } from 'react'
import { parseLocalDate, toDateString } from '../../types'

interface Props {
  /** 選択中の日付（YYYY-MM-DD） */
  value: string
  onChange: (date: string) => void
  /** この日より前は選択不可（YYYY-MM-DD, inclusive） */
  min?: string
}

const WEEK_JA = ['日', '月', '火', '水', '木', '金', '土']

/** モーダル内にそのまま表示するインライン月カレンダー（日付を直接クリックで選択） */
export default function MiniCalendar({ value, onChange, min }: Props) {
  const base = value ? parseLocalDate(value) : new Date()
  const [view, setView] = useState(() => new Date(base.getFullYear(), base.getMonth(), 1))
  const [hovered, setHovered] = useState<string | null>(null)

  const todayStr = toDateString(new Date())
  const year = view.getFullYear()
  const month = view.getMonth()
  const startOffset = new Date(year, month, 1).getDay() // 0=日曜
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const cells: (number | null)[] = []
  for (let i = 0; i < startOffset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  const navBtn: React.CSSProperties = {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: 7,
    width: 28,
    height: 28,
    cursor: 'pointer',
    color: 'var(--text-secondary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'inherit',
    flexShrink: 0,
  }

  return (
    <div style={{
      marginTop: 8,
      background: 'var(--surface-warm)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: 12,
    }}>
      {/* Header: 前月 / 年月 / 次月 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <button type="button" aria-label="前の月" style={navBtn} onClick={() => setView(new Date(year, month - 1, 1))}>
          <svg width="7" height="11" viewBox="0 0 8 12" fill="none"><path d="M6.5 1L1.5 6l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
          {year}年{month + 1}月
        </span>
        <button type="button" aria-label="次の月" style={navBtn} onClick={() => setView(new Date(year, month + 1, 1))}>
          <svg width="7" height="11" viewBox="0 0 8 12" fill="none"><path d="M1.5 1l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
      </div>

      {/* 曜日ラベル */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
        {WEEK_JA.map((w, i) => (
          <div key={w} style={{
            textAlign: 'center',
            fontSize: 10,
            fontWeight: 700,
            color: i === 0 ? '#DC2626' : i === 6 ? '#c4a77d' : 'var(--text-tertiary)',
          }}>
            {w}
          </div>
        ))}
      </div>

      {/* 日付グリッド */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
        {cells.map((d, i) => {
          if (d === null) return <div key={`b-${i}`} />
          const dateStr = toDateString(new Date(year, month, d))
          const isSelected = dateStr === value
          const isToday = dateStr === todayStr
          const isDisabled = !!min && dateStr < min
          const isHovered = hovered === dateStr && !isDisabled && !isSelected
          const dow = (startOffset + d - 1) % 7
          return (
            <button
              key={dateStr}
              type="button"
              disabled={isDisabled}
              onClick={() => onChange(dateStr)}
              onMouseEnter={() => { if (!isDisabled) setHovered(dateStr) }}
              onMouseLeave={() => setHovered(null)}
              style={{
                height: 32,
                borderRadius: 8,
                border: isToday && !isSelected ? '1.5px solid var(--accent)' : '1.5px solid transparent',
                background: isSelected ? 'var(--accent)' : isHovered ? 'var(--bg-secondary)' : 'transparent',
                color: isDisabled
                  ? 'var(--text-disabled)'
                  : isSelected ? '#fff'
                  : dow === 0 ? '#DC2626'
                  : dow === 6 ? '#c4a77d'
                  : 'var(--text-primary)',
                fontSize: 13,
                fontWeight: isSelected ? 700 : 500,
                cursor: isDisabled ? 'not-allowed' : 'pointer',
                opacity: isDisabled ? 0.4 : 1,
                fontFamily: 'inherit',
                transition: 'background 0.12s, border-color 0.12s',
                boxShadow: isSelected ? '0 2px 8px rgba(239,148,108,0.4)' : 'none',
              }}
            >
              {d}
            </button>
          )
        })}
      </div>
    </div>
  )
}
