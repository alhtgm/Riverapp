import type { ReactNode } from 'react'
import { parseLocalDate, type AppNotification, type Subject, type UserSummary } from '../../types'
import NoticeFrame, { NoticeChange, NoticeLecture, NoticeTitle } from './NoticeFrame'

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

const WEEKDAY = ['日', '月', '火', '水', '木', '金', '土']

/** 5月12日(月) */
function dateWithWeekday(value: unknown): string {
  if (typeof value !== 'string') return ''
  const d = parseLocalDate(value)
  return `${d.getMonth() + 1}月${d.getDate()}日(${WEEKDAY[d.getDay()]})`
}

/** 締切が何日動いたか（例: 7日のびました / 2日早まりました） */
function shiftLabel(from: unknown, to: unknown): string | null {
  if (typeof from !== 'string' || typeof to !== 'string') return null
  const days = Math.round((parseLocalDate(to).getTime() - parseLocalDate(from).getTime()) / 86400000)
  if (days === 0) return null
  return days > 0 ? `${days}日のびました` : `${-days}日早まりました`
}

/** 講義の課題についてのお知らせ（課題の追加・締切の変更）のカード */
export default function TaskNotice({ notification: n, users, subjects, time, isNew, onOpen }: {
  notification: AppNotification
  users: Record<string, UserSummary>
  subjects: Pick<Subject, 'id' | 'name' | 'color'>[]
  time: string
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
  const shift = shiftLabel(p.old_due_date, p.new_due_date)

  return (
    <NoticeFrame
      tone={tone}
      icon={isAdded ? addedIcon : calendarIcon}
      label={isAdded ? '課題の追加' : '締切の変更'}
      createdAt={n.created_at}
      time={time}
      isNew={isNew}
      footnote={actor ? `${actor}さんが${isAdded ? '追加' : '変更'}しました` : undefined}
      openLabel="講義を開く"
      onOpen={onOpen}
    >
      <NoticeLecture name={lecture?.name ?? '講義'} color={lecture?.color} />
      <NoticeTitle>
        {String(p.title ?? '')}
        {recurringCount !== null && <span style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>（全{recurringCount}回）</span>}
      </NoticeTitle>

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
        <NoticeChange
          from={dateWithWeekday(p.old_due_date)}
          to={dateWithWeekday(p.new_due_date)}
          color={tone.fg}
          extra={shift && (
            <span style={{
              fontSize: 'var(--type-label-small-size)', padding: '0 var(--space-2)', borderRadius: 'var(--shape-xs)',
              background: 'var(--bg-secondary)', color: 'var(--text-secondary)', lineHeight: '20px',
            }}>{shift}</span>
          )}
        />
      )}
    </NoticeFrame>
  )
}
