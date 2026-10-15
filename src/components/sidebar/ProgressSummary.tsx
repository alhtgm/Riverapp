import { useStore } from '../../store/useStore'
import { isOverdue, toDateString } from '../../types'
import type { Task } from '../../types'
import SectionTitle from './SectionTitle'

const isCompleted = (t: Task) => t.status === 'done' || t.status === 'submitted'

export default function ProgressSummary() {
  const { tasks } = useStore()

  const now = new Date()
  const todayStr = toDateString(now)
  const monthPrefix = todayStr.slice(0, 7) // YYYY-MM
  // 今週の日曜 (月曜始まり)
  const weekEnd = new Date(now)
  weekEnd.setDate(now.getDate() + ((7 - now.getDay()) % 7))
  const weekEndStr = toDateString(weekEnd)

  const monthTasks = tasks.filter(t => t.due_date.startsWith(monthPrefix))
  const monthDone = monthTasks.filter(isCompleted).length
  const rate = monthTasks.length > 0 ? Math.round((monthDone / monthTasks.length) * 100) : 0

  const overdueCount = tasks.filter(isOverdue).length
  const dueThisWeek = tasks.filter(t =>
    !isCompleted(t) && t.due_date >= todayStr && t.due_date <= weekEndStr
  ).length

  const stats = [
    { label: '期限切れ', value: overdueCount, color: overdueCount > 0 ? 'var(--danger)' : 'var(--text-primary)' },
    { label: '今週締切', value: dueThisWeek, color: 'var(--text-primary)' },
    { label: '今月完了', value: monthDone, color: 'var(--text-primary)' },
  ]

  return (
    <section style={{ padding: '14px 14px', flexShrink: 0 }}>
      <SectionTitle>今月の進捗</SectionTitle>

      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
          {rate}<span style={{ fontSize: 12, fontWeight: 600, marginLeft: 1 }}>%</span>
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
          {monthDone} / {monthTasks.length} 件
        </span>
      </div>

      <div
        role="progressbar"
        aria-label="今月の完了率"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={rate}
        style={{ height: 6, borderRadius: 9999, background: 'var(--bg-secondary)', overflow: 'hidden' }}
      >
        <div style={{
          width: `${rate}%`,
          height: '100%',
          borderRadius: 9999,
          background: 'linear-gradient(90deg, #70877f 0%, #16A34A 100%)',
          transition: 'width 0.3s ease',
        }} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginTop: 12 }}>
        {stats.map(s => (
          <div key={s.label} style={{
            background: 'var(--bg)',
            border: '1px solid var(--border-light)',
            borderRadius: 7,
            padding: '6px 4px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: s.color, lineHeight: 1.2 }}>{s.value}</div>
            <div style={{ fontSize: 9.5, color: 'var(--text-tertiary)', marginTop: 2, whiteSpace: 'nowrap' }}>{s.label}</div>
          </div>
        ))}
      </div>
    </section>
  )
}
