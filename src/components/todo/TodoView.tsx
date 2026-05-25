import { useEffect, useState, useMemo } from 'react'
import type { Task } from '../../types'
import { STATUS_CONFIG, isOverdue, formatDate } from '../../types'
import { useStore } from '../../store/useStore'
import { useToast } from '../ui/Toast'
import TaskDetailPanel from '../task/TaskDetailPanel'
import AddTaskModal from '../task/AddTaskModal'
import AppHeader from '../layout/AppHeader'

export default function TodoView() {
  const { subjects, tasks, fetchAll, updateTask, isDark } = useStore()
  const { showToast } = useToast()
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 640)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [addModalOpen, setAddModalOpen] = useState(false)

  useEffect(() => { fetchAll() }, [fetchAll])

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const subjectMap = useMemo(
    () => new Map(subjects.map(s => [s.id, s])),
    [subjects]
  )

  // Incomplete tasks (sorted by due_date asc), then complete tasks (sorted by due_date asc)
  const sortedTasks = useMemo(() => {
    const incomplete: Task[] = []
    const complete: Task[] = []
    for (const t of tasks) {
      if (t.status === 'done' || t.status === 'submitted') complete.push(t)
      else incomplete.push(t)
    }
    const byDue = (a: Task, b: Task) => a.due_date.localeCompare(b.due_date)
    incomplete.sort(byDue)
    complete.sort(byDue)
    return [...incomplete, ...complete]
  }, [tasks])

  const handleToggle = async (task: Task) => {
    const isDone = task.status === 'done' || task.status === 'submitted'
    const newStatus = isDone ? 'todo' : 'done'
    await updateTask(task.id, { status: newStatus })
    showToast(isDone ? '未着手に戻しました' : '完了にしました')
  }

  const incompleteCnt = sortedTasks.filter(t => t.status !== 'done' && t.status !== 'submitted').length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100svh', background: 'var(--bg)' }}>
      <AppHeader isMobile={isMobile} onAddClick={() => setAddModalOpen(true)} />

      {/* Count bar */}
      <div style={{
        height: 42,
        borderBottom: '1px solid var(--border-light)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 18px',
        gap: 8,
        flexShrink: 0,
        background: 'var(--filter-glass)',
      }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '-0.01em' }}>
          未完了
        </span>
        <span style={{
          fontSize: 12,
          fontWeight: 700,
          color: '#ef946c',
          background: 'rgba(239,148,108,0.12)',
          borderRadius: 9999,
          padding: '1px 8px',
          letterSpacing: '0.01em',
        }}>
          {incompleteCnt}件
        </span>
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)', marginLeft: 4 }}>
          / 全{sortedTasks.length}件
        </span>
      </div>

      {/* Task list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {sortedTasks.length === 0 ? (
          <div style={{
            height: 320,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
          }}>
            <div style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" stroke="var(--text-disabled)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span style={{ fontSize: 13, color: 'var(--text-tertiary)', letterSpacing: '-0.01em' }}>
              課題がまだありません
            </span>
          </div>
        ) : (
          sortedTasks.map((task, idx) => {
            const subject = subjectMap.get(task.subject_id)
            const isDone = task.status === 'done' || task.status === 'submitted'
            const over = isOverdue(task)
            const cfg = over ? STATUS_CONFIG.overdue : STATUS_CONFIG[task.status]
            const accentColor = isDark ? cfg.darkColor : cfg.color
            const isFirstComplete = !isDone
              ? false
              : idx === 0 || (sortedTasks[idx - 1].status !== 'done' && sortedTasks[idx - 1].status !== 'submitted')

            return (
              <div key={task.id}>
                {isFirstComplete && (
                  <div style={{
                    padding: '10px 18px 4px',
                    fontSize: 11,
                    fontWeight: 700,
                    color: 'var(--text-disabled)',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    borderTop: idx > 0 ? '1px solid var(--border-light)' : 'none',
                  }}>
                    完了済み
                  </div>
                )}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: isMobile ? '10px 14px' : '11px 18px',
                    borderBottom: '1px solid var(--border-light)',
                    background: 'var(--surface)',
                    cursor: 'pointer',
                    transition: 'background 0.15s',
                    opacity: isDone ? 0.55 : 1,
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.background = isDark
                      ? 'rgba(255,255,255,0.03)'
                      : 'rgba(20,16,10,0.018)'
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.background = 'var(--surface)'
                  }}
                  onClick={() => setSelectedTask(task)}
                >
                  {/* Checkbox */}
                  <button
                    onClick={e => { e.stopPropagation(); handleToggle(task) }}
                    aria-label={isDone ? '未着手に戻す' : '完了にする'}
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 6,
                      border: `2px solid ${isDone ? accentColor : 'var(--border)'}`,
                      background: isDone ? accentColor : 'transparent',
                      flexShrink: 0,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.18s',
                      padding: 0,
                    }}
                    onMouseEnter={e => {
                      if (!isDone) e.currentTarget.style.borderColor = accentColor
                    }}
                    onMouseLeave={e => {
                      if (!isDone) e.currentTarget.style.borderColor = 'var(--border)'
                    }}
                  >
                    {isDone && (
                      <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
                        <path d="M1 4.5L4 7.5L10 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </button>

                  {/* Subject color stripe */}
                  <div style={{
                    width: 3,
                    height: 32,
                    borderRadius: 9999,
                    background: subject?.color ?? 'var(--border)',
                    flexShrink: 0,
                  }} />

                  {/* Task info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: isMobile ? 13 : 14,
                      fontWeight: 500,
                      color: 'var(--text-primary)',
                      letterSpacing: '-0.02em',
                      textDecoration: isDone ? 'line-through' : 'none',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {task.title}
                    </div>
                    <div style={{
                      fontSize: 11,
                      color: 'var(--text-tertiary)',
                      marginTop: 2,
                      letterSpacing: '-0.01em',
                      display: 'flex',
                      gap: 6,
                      flexWrap: 'wrap',
                    }}>
                      {subject && (
                        <span style={{ color: subject.color, fontWeight: 600 }}>
                          {subject.name}
                        </span>
                      )}
                      <span>締切: {formatDate(task.due_date)}{task.due_time ? ` ${task.due_time}` : ''}</span>
                    </div>
                  </div>

                  {/* Status badge */}
                  <span style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: accentColor,
                    background: isDark ? cfg.darkBg : cfg.bg,
                    borderRadius: 9999,
                    padding: '2px 8px',
                    flexShrink: 0,
                    letterSpacing: '-0.01em',
                  }}>
                    {cfg.label}
                  </span>

                  {/* Chevron */}
                  <svg width="7" height="12" viewBox="0 0 8 14" fill="none" style={{ flexShrink: 0, opacity: 0.3 }}>
                    <path d="M1 1l6 6-6 6" stroke="var(--text-secondary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </div>
            )
          })
        )}
        {/* Bottom padding */}
        <div style={{ height: 40 }} />
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
