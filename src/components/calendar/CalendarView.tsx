import { useEffect, useState, useMemo } from 'react'
import type { Task } from '../../types'
import { toDateString, formatDate } from '../../types'
import { useStore } from '../../store/useStore'
import { useToast } from '../ui/Toast'
import TaskDetailPanel from '../task/TaskDetailPanel'
import AddTaskModal from '../task/AddTaskModal'
import AppHeader from '../layout/AppHeader'

const DAY_JA = ['日', '月', '火', '水', '木', '金', '土']

export default function CalendarView() {
  const { subjects, tasks, fetchAll, isDark } = useStore()
  const { showToast: _showToast } = useToast()
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 640)
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [addModalOpen, setAddModalOpen] = useState(false)

  useEffect(() => { fetchAll() }, [fetchAll])

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const todayStr = toDateString(new Date())
  const year = currentMonth.getFullYear()
  const month = currentMonth.getMonth()

  const subjectMap = useMemo(
    () => new Map(subjects.map(s => [s.id, s])),
    [subjects]
  )

  // Build calendar grid: null = padding cell
  const cells: (Date | null)[] = useMemo(() => {
    const firstDay = new Date(year, month, 1)
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const startDow = firstDay.getDay()
    const arr: (Date | null)[] = Array(startDow).fill(null)
    for (let d = 1; d <= daysInMonth; d++) arr.push(new Date(year, month, d))
    while (arr.length % 7 !== 0) arr.push(null)
    return arr
  }, [year, month])

  // Group tasks by due_date
  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>()
    for (const task of tasks) {
      const arr = map.get(task.due_date) ?? []
      arr.push(task)
      map.set(task.due_date, arr)
    }
    return map
  }, [tasks])

  const prevMonth = () => setCurrentMonth(new Date(year, month - 1, 1))
  const nextMonth = () => setCurrentMonth(new Date(year, month + 1, 1))
  const goToday   = () => {
    const d = new Date()
    setCurrentMonth(new Date(d.getFullYear(), d.getMonth(), 1))
  }

  // How many task chips to show per cell before "+N more"
  const MAX_CHIPS = isMobile ? 1 : 3

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100svh', background: 'var(--bg)' }}>
      <AppHeader isMobile={isMobile} onAddClick={() => setAddModalOpen(true)} />

      {/* Month navigation bar */}
      <div style={{
        height: 48,
        borderBottom: '1px solid var(--border-light)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 18px',
        gap: 10,
        flexShrink: 0,
        background: 'var(--filter-glass)',
      }}>
        <button
          onClick={prevMonth}
          aria-label="前の月"
          style={{
            background: 'none',
            border: '1px solid var(--border)',
            borderRadius: 7,
            width: 30,
            height: 30,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-secondary)',
            flexShrink: 0,
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-secondary)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
        >
          <svg width="7" height="12" viewBox="0 0 8 14" fill="none">
            <path d="M7 1L1 7l6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        <span style={{
          fontSize: isMobile ? 15 : 16,
          fontWeight: 700,
          color: 'var(--text-primary)',
          letterSpacing: '-0.03em',
          minWidth: 90,
          textAlign: 'center',
        }}>
          {year}年{month + 1}月
        </span>

        <button
          onClick={nextMonth}
          aria-label="次の月"
          style={{
            background: 'none',
            border: '1px solid var(--border)',
            borderRadius: 7,
            width: 30,
            height: 30,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-secondary)',
            flexShrink: 0,
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-secondary)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
        >
          <svg width="7" height="12" viewBox="0 0 8 14" fill="none">
            <path d="M1 1l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        <button
          onClick={goToday}
          style={{
            background: 'none',
            border: '1px solid var(--border)',
            borderRadius: 7,
            padding: '4px 10px',
            fontSize: 12,
            fontWeight: 500,
            cursor: 'pointer',
            color: 'var(--text-secondary)',
            fontFamily: 'inherit',
            letterSpacing: '-0.01em',
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-secondary)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
        >
          今月
        </button>
      </div>

      {/* Calendar grid */}
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
        {/* Day-of-week header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          {DAY_JA.map((d, i) => (
            <div key={i} style={{
              padding: '6px 0',
              textAlign: 'center',
              fontSize: 11,
              fontWeight: 700,
              color: i === 0 ? '#DC2626' : i === 6 ? '#c4a77d' : 'var(--text-disabled)',
              letterSpacing: '0.04em',
              background: 'var(--bg)',
            }}>
              {d}
            </div>
          ))}
        </div>

        {/* Weeks */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gridAutoRows: '1fr',
          flex: 1,
          minHeight: 0,
        }}>
          {cells.map((day, i) => {
            if (!day) {
              return (
                <div key={i} style={{
                  background: isDark ? 'rgba(255,255,255,0.015)' : 'rgba(20,16,10,0.015)',
                  borderRight: '1px solid var(--border-light)',
                  borderBottom: '1px solid var(--border-light)',
                }} />
              )
            }

            const dateStr = toDateString(day)
            const isToday = dateStr === todayStr
            const dow = day.getDay()
            const isSun = dow === 0
            const isSat = dow === 6
            const dayTasks = tasksByDate.get(dateStr) ?? []
            const extra = dayTasks.length - MAX_CHIPS

            return (
              <div
                key={i}
                style={{
                  borderRight: '1px solid var(--border-light)',
                  borderBottom: '1px solid var(--border-light)',
                  padding: isMobile ? '4px 3px' : '6px 6px',
                  background: isToday
                    ? (isDark ? 'rgba(112,135,127,0.10)' : 'rgba(112,135,127,0.05)')
                    : 'var(--surface)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                  minHeight: 0,
                  overflow: 'hidden',
                }}
              >
                {/* Day number */}
                <div style={{
                  width: isToday ? 22 : 20,
                  height: isToday ? 22 : 20,
                  borderRadius: '50%',
                  background: isToday ? '#70877f' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: isMobile ? 11 : 12,
                  fontWeight: isToday ? 800 : 400,
                  color: isToday ? '#ffffff'
                    : isSun ? '#DC2626'
                    : isSat ? '#c4a77d'
                    : 'var(--text-secondary)',
                  letterSpacing: '-0.02em',
                  flexShrink: 0,
                  alignSelf: 'flex-start',
                  boxShadow: isToday ? '0 2px 8px rgba(112,135,127,0.40)' : 'none',
                }}>
                  {day.getDate()}
                </div>

                {/* Task chips */}
                {dayTasks.slice(0, MAX_CHIPS).map(task => {
                  const subject = subjectMap.get(task.subject_id)
                  const isDone = task.status === 'done' || task.status === 'submitted'
                  return (
                    <div
                      key={task.id}
                      title={`${task.title}（${formatDate(task.due_date)}）`}
                      onClick={() => setSelectedTask(task)}
                      style={{
                        fontSize: isMobile ? 9 : 10,
                        fontWeight: 500,
                        padding: isMobile ? '1px 3px' : '2px 5px',
                        borderRadius: 4,
                        cursor: 'pointer',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(20,16,10,0.04)',
                        borderLeft: `3px solid ${subject?.color ?? '#888'}`,
                        color: isDone ? 'var(--text-disabled)' : 'var(--text-secondary)',
                        textDecoration: isDone ? 'line-through' : 'none',
                        flexShrink: 0,
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLElement).style.background = isDark
                          ? 'rgba(255,255,255,0.11)'
                          : 'rgba(20,16,10,0.08)'
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLElement).style.background = isDark
                          ? 'rgba(255,255,255,0.06)'
                          : 'rgba(20,16,10,0.04)'
                      }}
                    >
                      {task.title}
                    </div>
                  )
                })}

                {/* "+N more" overflow */}
                {extra > 0 && (
                  <div style={{
                    fontSize: isMobile ? 9 : 10,
                    color: 'var(--text-tertiary)',
                    fontWeight: 600,
                    letterSpacing: '-0.01em',
                    paddingLeft: isMobile ? 3 : 5,
                    flexShrink: 0,
                  }}>
                    +{extra}件
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Modals */}
      {addModalOpen && (
        <AddTaskModal
          subjects={subjects}
          onClose={() => setAddModalOpen(false)}
        />
      )}
      {selectedTask && (
        <TaskDetailPanel
          task={selectedTask}
          subjects={subjects}
          onClose={() => setSelectedTask(null)}
        />
      )}
    </div>
  )
}
