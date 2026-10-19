import { useState } from 'react'
import { parseLocalDate, toDateString } from '../../types'
import { IconButton } from './m3'

interface Props {
  /** 選択中の日付（YYYY-MM-DD） */
  value: string
  onChange: (date: string) => void
  /** この日より前は選択不可（YYYY-MM-DD, inclusive） */
  min?: string
}

const WEEK_JA = ['日', '月', '火', '水', '木', '金', '土']

/**
 * モーダル内にそのまま表示するインライン月カレンダー（日付を直接クリックで選択）。
 * 見た目は M3 の docked date picker（角 16px・日付は 40px の丸）。
 */
export default function MiniCalendar({ value, onChange, min }: Props) {
  const base = value ? parseLocalDate(value) : new Date()
  const [view, setView] = useState(() => new Date(base.getFullYear(), base.getMonth(), 1))

  const todayStr = toDateString(new Date())
  const year = view.getFullYear()
  const month = view.getMonth()
  const startOffset = new Date(year, month, 1).getDay() // 0=日曜
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const cells: (number | null)[] = []
  for (let i = 0; i < startOffset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <div style={{
      background: 'var(--surface-warm)',
      borderRadius: 'var(--shape-lg)',
      padding: 'var(--space-3)',
      maxWidth: 360,
    }}>
      {/* Header: 前月 / 年月 / 次月 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
        <IconButton label="前の月" onClick={() => setView(new Date(year, month - 1, 1))}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M12.5 4.5L7 10l5.5 5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </IconButton>
        <span aria-live="polite" style={{
          fontSize: 'var(--type-title-small-size)', lineHeight: 'var(--type-title-small-line)',
          fontWeight: 'var(--type-title-small-weight)', color: 'var(--text-primary)',
        }}>
          {year}年{month + 1}月
        </span>
        <IconButton label="次の月" onClick={() => setView(new Date(year, month + 1, 1))}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M7.5 4.5L13 10l-5.5 5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </IconButton>
      </div>

      {/* 曜日ラベル */}
      <div aria-hidden="true" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 'var(--space-1)' }}>
        {WEEK_JA.map((w, i) => (
          <div key={w} style={{
            textAlign: 'center',
            fontSize: 'var(--type-body-small-size)',
            lineHeight: 'var(--type-body-small-line)',
            color: i === 0 ? 'var(--danger)' : i === 6 ? 'var(--saturday)' : 'var(--text-secondary)',
          }}>
            {w}
          </div>
        ))}
      </div>

      {/* 日付グリッド */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', rowGap: 'var(--space-1)', justifyItems: 'center' }}>
        {cells.map((d, i) => {
          if (d === null) return <div key={`b-${i}`} />
          const dateStr = toDateString(new Date(year, month, d))
          const isSelected = dateStr === value
          const isToday = dateStr === todayStr
          const isDisabled = !!min && dateStr < min
          const dow = (startOffset + d - 1) % 7
          return (
            <button
              key={dateStr}
              type="button"
              disabled={isDisabled}
              aria-pressed={isSelected}
              aria-current={isToday ? 'date' : undefined}
              aria-label={`${month + 1}月${d}日（${WEEK_JA[dow]}）${isToday ? '・今日' : ''}`}
              className="m3-state"
              onClick={() => onChange(dateStr)}
              style={{
                width: 40,
                height: 40,
                padding: 0,
                borderRadius: 'var(--shape-full)',
                border: isToday && !isSelected ? '1px solid var(--accent-dark)' : '1px solid transparent',
                background: isSelected ? 'var(--accent-solid)' : 'transparent',
                color: isDisabled
                  ? 'var(--text-disabled)'
                  : isSelected ? 'var(--on-accent)'
                  : isToday ? 'var(--accent-dark)'
                  : dow === 0 ? 'var(--danger)'
                  : dow === 6 ? 'var(--saturday)'
                  : 'var(--text-primary)',
                fontSize: 'var(--type-body-large-size)',
                lineHeight: 'var(--type-body-large-line)',
                fontWeight: isSelected || isToday ? 'var(--type-weight-emphasized)' : 400,
                cursor: isDisabled ? 'not-allowed' : 'pointer',
                opacity: isDisabled ? 'var(--state-disabled-content-opacity)' : 1,
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
