import type { ReactNode } from 'react'
import { parseLocalDate, type AppNotification, type Subject, type UserSummary } from '../../types'

const svg = (children: ReactNode) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">{children}</svg>
)

const addedIcon = svg(<>
  <rect x="4" y="4" width="16" height="16" rx="3" stroke="currentColor" strokeWidth="1.8" />
  <path d="M12 8.5v7M8.5 12h7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
</>)

const calendarIcon = svg(<>
  <rect x="4" y="5.5" width="16" height="14.5" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
  <path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
</>)

const arrowIcon = (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M3 8h9.5M9 4.5L12.5 8 9 11.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const WEEKDAY = ['日', '月', '火', '水', '木', '金', '土']

/** 5月12日(月) */
function dateWithWeekday(value: unknown): string {
  if (typeof value !== 'string') return ''
  const d = parseLocalDate(value)
  return `${d.getMonth() + 1}月${d.getDate()}日(${WEEKDAY[d.getDay()]})`
}

/** 締切が何日動いたか（例: 7日のばした / 2日早まった） */
function shiftLabel(from: unknown, to: unknown): string | null {
  if (typeof from !== 'string' || typeof to !== 'string') return null
  const days = Math.round((parseLocalDate(to).getTime() - parseLocalDate(from).getTime()) / 86400000)
  if (days === 0) return null
  return days > 0 ? `${days}日のびました` : `${-days}日早まりました`
}

/**
 * 講義の課題についてのお知らせ（課題の追加・締切の変更）のカード。
 * 上に種類と届いた時刻、真ん中に講義名・課題名と締切、下に誰が操作したかと「講義を開く」を置く
 */
export default function TaskNotice({ notification: n, users, subjects, time, isNew, onOpen }: {
  notification: AppNotification
  users: Record<string, UserSummary>
  subjects: Pick<Subject, 'id' | 'name' | 'color'>[]
  /** 「3分前」など */
  time: string
  /** 受信箱を開いた時点で未読だった */
  isNew: boolean
  /** 講義を開く（参加中の講義のときだけ） */
  onOpen?: () => void
}) {
  const p = n.payload
  const isAdded = n.type === 'task_added'
  const lecture = subjects.find(s => s.id === p.lecture_id)
  const actor = typeof p.actor_id === 'string' ? users[p.actor_id]?.display_name : undefined
  const recurringCount = typeof p.count === 'number' ? p.count : null
  const tone = isAdded
    ? { fg: 'var(--st-done)', bg: 'var(--st-done-bg)' }
    : { fg: 'var(--st-overdue)', bg: 'var(--st-overdue-bg)' }

  const content = (
    <>
      <span style={{
        display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-2) var(--space-4)',
        background: tone.bg, color: tone.fg, fontSize: 'var(--type-label-large-size)', fontWeight: 600,
      }}>
        {isAdded ? addedIcon : calendarIcon}
        <span>{isAdded ? '課題の追加' : '締切の変更'}</span>
        {isNew && (
          <span style={{
            fontSize: 'var(--type-label-small-size)', padding: '0 var(--space-2)', borderRadius: 'var(--shape-full)',
            background: 'var(--danger)', color: 'var(--surface)', lineHeight: '18px',
          }}>新着</span>
        )}
        <span style={{ flex: 1 }} />
        <time dateTime={n.created_at} style={{ fontWeight: 400, color: 'var(--text-secondary)', fontSize: 'var(--type-body-small-size)' }}>{time}</time>
      </span>

      <span style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', padding: 'var(--space-3) var(--space-4)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--text-secondary)', fontSize: 'var(--type-label-large-size)' }}>
          <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 'var(--shape-full)', background: lecture?.color ?? 'var(--border-strong)', flexShrink: 0 }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lecture?.name ?? '講義'}</span>
        </span>
        <span style={{ fontSize: 'var(--type-title-medium-size)', lineHeight: 'var(--type-title-medium-line)', fontWeight: 700, color: 'var(--text-primary)', overflowWrap: 'anywhere' }}>
          {String(p.title ?? '')}
          {recurringCount !== null && <span style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>（全{recurringCount}回）</span>}
        </span>

        {isAdded ? (
          <span style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-2)', flexWrap: 'wrap', color: 'var(--text-primary)' }}>
            <span style={{ fontSize: 'var(--type-label-medium-size)', color: 'var(--text-secondary)' }}>締切</span>
            {recurringCount !== null ? (
              <span style={{ fontWeight: 600 }}>
                {p.interval_weeks === 1 ? '毎週' : `${String(p.interval_weeks)}週ごと`}・{dateWithWeekday(p.due_date)} 〜 {dateWithWeekday(p.last_due_date)}
              </span>
            ) : (
              <span style={{ fontWeight: 600 }}>{dateWithWeekday(p.due_date)}{typeof p.due_time === 'string' && p.due_time ? ` ${p.due_time}` : ''}</span>
            )}
          </span>
        ) : (
          <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--text-secondary)', textDecoration: 'line-through' }}>{dateWithWeekday(p.old_due_date)}</span>
            <span style={{ color: 'var(--text-secondary)', display: 'flex' }}>{arrowIcon}</span>
            <span style={{ fontWeight: 700, color: tone.fg }}>{dateWithWeekday(p.new_due_date)}</span>
            {shiftLabel(p.old_due_date, p.new_due_date) && (
              <span style={{
                fontSize: 'var(--type-label-small-size)', padding: '0 var(--space-2)', borderRadius: 'var(--shape-xs)',
                background: 'var(--bg-secondary)', color: 'var(--text-secondary)', lineHeight: '20px',
              }}>{shiftLabel(p.old_due_date, p.new_due_date)}</span>
            )}
          </span>
        )}
      </span>

      <span style={{
        display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-2) var(--space-4)',
        borderTop: '1px solid var(--border-light, var(--border))', fontSize: 'var(--type-body-small-size)', color: 'var(--text-secondary)',
      }}>
        <span style={{ flex: 1 }}>{actor ? `${actor}さんが${isAdded ? '追加' : '変更'}しました` : ''}</span>
        {onOpen && <span style={{ color: 'var(--accent-dark)', fontWeight: 600 }}>講義を開く ›</span>}
      </span>
    </>
  )

  const frame = {
    display: 'flex', flexDirection: 'column' as const, width: '100%', padding: 0, textAlign: 'left' as const,
    border: `1px solid ${isNew ? 'var(--accent-dark)' : 'var(--border)'}`, borderRadius: 'var(--shape-md)',
    background: 'var(--surface)', overflow: 'hidden', color: 'inherit', font: 'inherit',
  }

  const label = isAdded ? `課題の追加: ${String(p.title ?? '')}` : `締切の変更: ${String(p.title ?? '')}`
  return onOpen
    ? <button type="button" className="m3-state" onClick={onOpen} style={{ ...frame, cursor: 'pointer' }}>{content}</button>
    : <article aria-label={label} style={frame}>{content}</article>
}
