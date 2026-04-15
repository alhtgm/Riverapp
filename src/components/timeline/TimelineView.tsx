import { useRef, useEffect, useState, useCallback } from 'react'
import type { Subject, Task } from '../../types'
import { STATUS_CONFIG, isOverdue, toDateString } from '../../types'
import TaskDetailPanel from '../task/TaskDetailPanel'
import AddTaskModal from '../task/AddTaskModal'
import TaskQuickMenu from '../task/TaskQuickMenu'
import { useStore } from '../../store/useStore'

const COL_WIDTH_DESKTOP = 44
const COL_WIDTH_MOBILE = 36
const LABEL_WIDTH_DESKTOP = 186
const LABEL_WIDTH_MOBILE = 96
const ROW_HEIGHT = 46
const HEADER_HEIGHT = 56
const SUBJECT_SEP_HEIGHT = 28

function getDays(totalDays: number): Date[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const half = Math.floor(totalDays / 2)
  return Array.from({ length: totalDays }, (_, i) => {
    const d = new Date(today)
    d.setDate(d.getDate() + i - half)
    return d
  })
}

const DAY_JA = ['日', '月', '火', '水', '木', '金', '土']
const TOTAL_DAYS = 240

type EffectiveStatus = 'todo' | 'in_progress' | 'done' | 'submitted' | 'overdue'

const STATUS_PILLS: { key: EffectiveStatus; label: string }[] = [
  { key: 'todo',        label: '未着手' },
  { key: 'in_progress', label: '進行中' },
  { key: 'done',        label: '完了' },
  { key: 'submitted',   label: '提出済み' },
  { key: 'overdue',     label: '期限切れ' },
]

function getEffectiveStatus(task: Task, todayStr: string): EffectiveStatus {
  if (task.status !== 'done' && task.status !== 'submitted' && task.due_date < todayStr) return 'overdue'
  return task.status as EffectiveStatus
}

function taskMatchesFilter(task: Task, selected: Set<EffectiveStatus>, todayStr: string): boolean {
  if (selected.size === 0) return true
  return selected.has(getEffectiveStatus(task, todayStr))
}

interface TaskRow {
  rowKey: string
  title: string
  tasks: Task[]
  isRecurring: boolean
}

interface GroupedSubject {
  subject: Subject
  taskRows: TaskRow[]
}

function buildTaskRows(tasks: Task[]): TaskRow[] {
  const recurMap = new Map<string, Task[]>()
  const singles: Task[] = []
  for (const t of tasks) {
    if (t.recurrence_id) {
      const arr = recurMap.get(t.recurrence_id) ?? []
      arr.push(t)
      recurMap.set(t.recurrence_id, arr)
    } else {
      singles.push(t)
    }
  }
  const rows: TaskRow[] = []
  for (const [key, ts] of recurMap) {
    rows.push({
      rowKey: key,
      title: ts[0].title,
      tasks: [...ts].sort((a, b) => a.start_date.localeCompare(b.start_date)),
      isRecurring: true,
    })
  }
  for (const t of singles) {
    rows.push({ rowKey: t.id, title: t.title, tasks: [t], isRecurring: false })
  }
  rows.sort((a, b) => a.tasks[0].start_date.localeCompare(b.tasks[0].start_date))
  return rows
}

// River wave logo SVG
const RiverLogo = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
    <path d="M2 13C4.5 8.5 7.5 6.5 10 9C12.5 11.5 15.5 9.5 18 5" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M2 16.5C4.5 12 7.5 10 10 12.5C12.5 15 15.5 13 18 8.5" stroke="rgba(255,255,255,0.45)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

export default function TimelineView() {
  const { subjects, tasks, fetchAll, deleteSubject, signOut } = useStore()
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 640)
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set())
  const [deletingSubjectId, setDeletingSubjectId] = useState<string | null>(null)
  const [quickMenu, setQuickMenu] = useState<{ task: Task; x: number; y: number } | null>(null)
  const [hoveredSubjectId, setHoveredSubjectId] = useState<string | null>(null)
  const [selectedStatuses, setSelectedStatuses] = useState<Set<EffectiveStatus>>(new Set())
  const scrollRef = useRef<HTMLDivElement>(null)

  const days = getDays(TOTAL_DAYS)
  const todayStr = toDateString(new Date())
  const todayIdx = days.findIndex(d => toDateString(d) === todayStr)

  useEffect(() => { fetchAll() }, [fetchAll])

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const COL_WIDTH = isMobile ? COL_WIDTH_MOBILE : COL_WIDTH_DESKTOP
  const LABEL_WIDTH = isMobile ? LABEL_WIDTH_MOBILE : LABEL_WIDTH_DESKTOP

  useEffect(() => {
    if (scrollRef.current && todayIdx >= 0) {
      const target = LABEL_WIDTH + todayIdx * COL_WIDTH - scrollRef.current.clientWidth / 2 + COL_WIDTH / 2
      scrollRef.current.scrollLeft = Math.max(0, target)
    }
  }, [todayIdx])

  const toggleCollapse = useCallback((id: string) => {
    setCollapsedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])

  const handleDeleteSubject = async (id: string) => {
    try {
      await deleteSubject(id)
      setDeletingSubjectId(null)
    } catch (e: unknown) {
      alert((e as Error).message)
    }
  }

  const isFiltering = selectedStatuses.size > 0

  const grouped: GroupedSubject[] = subjects
    .map(subject => {
      const allRows = buildTaskRows(tasks.filter(t => t.subject_id === subject.id))
      const taskRows = !isFiltering
        ? allRows
        : allRows
            .map(row => ({
              ...row,
              tasks: row.tasks.filter(t => taskMatchesFilter(t, selectedStatuses, todayStr)),
            }))
            .filter(row => row.tasks.length > 0)
      return { subject, taskRows }
    })
    .filter(g => !isFiltering || g.taskRows.length > 0)

  const filteredTotal = grouped.reduce(
    (sum, g) => sum + g.taskRows.reduce((s, r) => s + r.tasks.length, 0), 0
  )

  const toggleStatus = (key: EffectiveStatus) => {
    setSelectedStatuses(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  const handleBarClick = (e: React.MouseEvent, task: Task) => {
    e.stopPropagation()
    setQuickMenu({ task, x: e.clientX, y: e.clientY })
  }

  const getBarProps = (task: Task) => {
    const si = days.findIndex(d => toDateString(d) === task.start_date)
    const ei = days.findIndex(d => toDateString(d) === task.due_date)
    if (si < 0 && ei < 0) return null
    const startI = si >= 0 ? si : 0
    const endI = ei >= 0 ? ei : days.length - 1
    const color = isOverdue(task) ? STATUS_CONFIG.overdue.color : STATUS_CONFIG[task.status].color
    const bg = isOverdue(task) ? STATUS_CONFIG.overdue.bg : STATUS_CONFIG[task.status].bg
    return { left: startI * COL_WIDTH, width: Math.max((endI - startI + 1) * COL_WIDTH, COL_WIDTH), color, bg }
  }

  const stickyLabel = (zIndex = 5): React.CSSProperties => ({
    width: LABEL_WIDTH,
    flexShrink: 0,
    position: 'sticky',
    left: 0,
    zIndex,
    background: 'inherit',
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100svh', background: '#F6F3EE' }}>

      {/* ---- Glassmorphism header ---- */}
      <header style={{
        height: 52,
        background: 'rgba(246,243,238,0.88)',
        backdropFilter: 'blur(20px) saturate(160%)',
        WebkitBackdropFilter: 'blur(20px) saturate(160%)',
        borderBottom: '1px solid rgba(255,255,255,0.7)',
        boxShadow: '0 1px 0 rgba(20,16,10,0.06), 0 2px 8px rgba(20,16,10,0.03)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 18px',
        gap: 12,
        flexShrink: 0,
        position: 'relative',
        zIndex: 100,
      }}>

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, flex: 1, minWidth: 0 }}>
          <div style={{
            width: 30,
            height: 30,
            background: 'linear-gradient(135deg, #3B63FF 0%, #7C3AED 100%)',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 3px 10px rgba(59,99,255,0.35)',
            flexShrink: 0,
          }}>
            <RiverLogo size={18} />
          </div>
          <span style={{
            fontSize: 17,
            fontWeight: 700,
            color: '#1C1917',
            letterSpacing: '-0.04em',
            flexShrink: 0,
          }}>
            River
          </span>
          <div style={{ width: 1, height: 14, background: '#E3DDD5', marginLeft: 2, flexShrink: 0 }} />
          <span style={{
            fontSize: 12,
            color: '#A8A29E',
            fontWeight: 500,
            letterSpacing: '-0.01em',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            課題タイムライン
          </span>
        </div>

        {/* Add task button */}
        <button
          onClick={() => setShowAddModal(true)}
          style={{
            background: 'linear-gradient(135deg, #3B63FF 0%, #2D52E8 100%)',
            color: '#ffffff',
            border: 'none',
            borderRadius: 8,
            padding: isMobile ? '7px 10px' : '7px 15px',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            letterSpacing: '-0.02em',
            boxShadow: '0 3px 10px rgba(59,99,255,0.3)',
            transition: 'all 0.15s',
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            flexShrink: 0,
            fontFamily: 'inherit',
          }}
          onMouseEnter={e => {
            const el = e.currentTarget
            el.style.boxShadow = '0 5px 16px rgba(59,99,255,0.42)'
            el.style.transform = 'translateY(-1px)'
          }}
          onMouseLeave={e => {
            const el = e.currentTarget
            el.style.boxShadow = '0 3px 10px rgba(59,99,255,0.3)'
            el.style.transform = 'translateY(0)'
          }}
        >
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
            <path d="M6 1v10M1 6h10" stroke="white" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          {!isMobile && '課題を追加'}
        </button>

        {/* Logout */}
        <button
          onClick={() => signOut()}
          style={{
            background: 'transparent',
            border: '1px solid #E3DDD5',
            borderRadius: 7,
            padding: isMobile ? '6px 8px' : '6px 11px',
            fontSize: 12,
            fontWeight: 500,
            cursor: 'pointer',
            color: '#78716C',
            transition: 'all 0.12s',
            flexShrink: 0,
            fontFamily: 'inherit',
            letterSpacing: '-0.01em',
            display: 'flex',
            alignItems: 'center',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = '#EDE8DF'
            e.currentTarget.style.borderColor = '#CCC5BB'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.borderColor = '#E3DDD5'
          }}
        >
          {isMobile ? (
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M10 3L15 8M15 8L10 13M15 8H5M6 2H2.5C1.67 2 1 2.67 1 3.5v9c0 .83.67 1.5 1.5 1.5H6" stroke="#78716C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          ) : 'ログアウト'}
        </button>
      </header>

      {/* ---- Filter bar ---- */}
      <div style={{
        height: 42,
        borderBottom: '1px solid #EDE8DF',
        display: 'flex',
        alignItems: 'center',
        padding: '0 18px',
        gap: 6,
        flexShrink: 0,
        background: 'rgba(246,243,238,0.6)',
        position: 'relative',
        zIndex: 99,
        overflowX: 'auto',
      }}>
        {!isMobile && (
          <span style={{
            fontSize: 11,
            fontWeight: 700,
            color: '#C4BDB5',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            flexShrink: 0,
            marginRight: 2,
          }}>
            絞り込み
          </span>
        )}

        {STATUS_PILLS.map(pill => {
          const isActive = selectedStatuses.has(pill.key)
          const cfg = STATUS_CONFIG[pill.key]
          return (
            <button
              key={pill.key}
              onClick={() => toggleStatus(pill.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                background: isActive ? cfg.bg : 'transparent',
                color: isActive ? cfg.color : '#78716C',
                border: `1px solid ${isActive ? cfg.color + '44' : '#E3DDD5'}`,
                borderRadius: 9999,
                padding: '3px 10px 3px 7px',
                fontSize: 12,
                fontWeight: isActive ? 600 : 400,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.12s',
                flexShrink: 0,
                letterSpacing: '-0.01em',
                fontFamily: 'inherit',
                boxShadow: isActive ? `0 2px 8px ${cfg.color}22` : 'none',
              }}
              onMouseEnter={e => {
                if (!isActive) {
                  e.currentTarget.style.background = cfg.bg
                  e.currentTarget.style.borderColor = cfg.color + '33'
                  e.currentTarget.style.color = cfg.color
                }
              }}
              onMouseLeave={e => {
                if (!isActive) {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.borderColor = '#E3DDD5'
                  e.currentTarget.style.color = '#78716C'
                }
              }}
            >
              <div style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: cfg.color,
                flexShrink: 0,
                opacity: isActive ? 1 : 0.45,
              }} />
              {pill.label}
            </button>
          )
        })}

        {isFiltering && (
          <>
            <div style={{ width: 1, height: 14, background: '#E3DDD5', margin: '0 2px', flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: '#A8A29E', flexShrink: 0, letterSpacing: '-0.01em' }}>
              {filteredTotal}件
            </span>
            <button
              onClick={() => setSelectedStatuses(new Set())}
              style={{
                background: 'none',
                border: '1px solid #E3DDD5',
                cursor: 'pointer',
                fontSize: 11,
                color: '#A8A29E',
                padding: '2px 8px',
                borderRadius: 9999,
                flexShrink: 0,
                fontFamily: 'inherit',
                transition: 'all 0.12s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = '#EDE8DF'
                e.currentTarget.style.color = '#78716C'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'none'
                e.currentTarget.style.color = '#A8A29E'
              }}
            >
              リセット
            </button>
          </>
        )}
      </div>

      {/* ---- Main scroll area ---- */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflow: 'auto',
          position: 'relative',
        }}
      >
        <div style={{ width: LABEL_WIDTH + days.length * COL_WIDTH, minHeight: '100%' }}>

          {/* ---- Date header (sticky top) ---- */}
          <div style={{
            position: 'sticky',
            top: 0,
            height: HEADER_HEIGHT,
            display: 'flex',
            zIndex: 20,
            background: '#F6F3EE',
            borderBottom: '1px solid #E3DDD5',
            boxShadow: '0 2px 8px rgba(20,16,10,0.04)',
          }}>
            {/* Corner cell */}
            <div style={{
              ...stickyLabel(30),
              height: HEADER_HEIGHT,
              background: '#F6F3EE',
              borderRight: '1px solid #E3DDD5',
              display: 'flex',
              alignItems: 'flex-end',
              padding: '0 14px 12px',
            }}>
              <span style={{
                fontSize: 10,
                fontWeight: 700,
                color: '#C4BDB5',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
              }}>
                科目 / 課題
              </span>
            </div>

            {/* Date columns */}
            {days.map((day, i) => {
              const isToday = toDateString(day) === todayStr
              const dow = day.getDay()
              const isSun = dow === 0
              const isSat = dow === 6
              const isFirst = day.getDate() === 1

              return (
                <div
                  key={i}
                  style={{
                    width: COL_WIDTH,
                    flexShrink: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    paddingBottom: 8,
                    gap: 2,
                    background: isToday
                      ? 'rgba(59,99,255,0.06)'
                      : (isSun || isSat)
                      ? 'rgba(20,16,10,0.015)'
                      : 'transparent',
                    borderRight: '1px solid rgba(20,16,10,0.04)',
                    position: 'relative',
                  }}
                >
                  {(isFirst || i === 0) && (
                    <div style={{
                      position: 'absolute',
                      top: 9,
                      left: 3,
                      fontSize: 9,
                      fontWeight: 700,
                      color: '#78716C',
                      letterSpacing: '0.05em',
                      whiteSpace: 'nowrap',
                    }}>
                      {day.getMonth() + 1}月
                    </div>
                  )}
                  <span style={{
                    fontSize: 9,
                    fontWeight: 600,
                    color: isSun ? '#DC2626' : isSat ? '#3B63FF' : '#C4BDB5',
                    letterSpacing: '0.02em',
                  }}>
                    {DAY_JA[dow]}
                  </span>
                  <div style={{
                    width: 24,
                    height: 24,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '50%',
                    background: isToday ? '#3B63FF' : 'transparent',
                    boxShadow: isToday ? '0 2px 8px rgba(59,99,255,0.35)' : 'none',
                    fontSize: 11,
                    fontWeight: isToday ? 700 : 400,
                    color: isToday ? '#ffffff' : isSun ? '#DC2626' : isSat ? '#3B63FF' : '#78716C',
                    letterSpacing: '-0.02em',
                  }}>
                    {day.getDate()}
                  </div>
                </div>
              )
            })}
          </div>

          {/* ---- Today vertical line ---- */}
          <div style={{
            position: 'absolute',
            top: HEADER_HEIGHT,
            bottom: 0,
            left: LABEL_WIDTH + todayIdx * COL_WIDTH + COL_WIDTH / 2 - 1,
            width: 1.5,
            background: 'linear-gradient(180deg, #3B63FF 0%, rgba(59,99,255,0.08) 100%)',
            zIndex: 4,
            pointerEvents: 'none',
          }} />

          {/* ---- Subject groups ---- */}
          {grouped.length === 0 ? (
            <div style={{
              display: 'flex',
              height: 320,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  width: 52,
                  height: 52,
                  borderRadius: 14,
                  background: '#FFFFFF',
                  border: '1px solid #E3DDD5',
                  boxShadow: '0 2px 8px rgba(20,16,10,0.06)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 14px',
                }}>
                  <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                    <rect x="2.5" y="2.5" width="17" height="17" rx="4.5" stroke="#C4BDB5" strokeWidth="1.5"/>
                    <path d="M8 11h6M11 8v6" stroke="#C4BDB5" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </div>
                <p style={{ fontSize: 14, color: '#A8A29E', margin: 0, fontWeight: 600, letterSpacing: '-0.02em' }}>
                  課題を追加してはじめましょう
                </p>
                <p style={{ fontSize: 12, color: '#C4BDB5', marginTop: 5, letterSpacing: '-0.01em' }}>
                  右上の「課題を追加」から追加できます
                </p>
              </div>
            </div>
          ) : (
            grouped.map(({ subject, taskRows }) => {
              const collapsed = collapsedIds.has(subject.id)
              const isDeletingThis = deletingSubjectId === subject.id
              const isHovered = hoveredSubjectId === subject.id

              return (
                <div key={subject.id}>
                  {/* Subject separator row */}
                  <div
                    style={{
                      display: 'flex',
                      height: SUBJECT_SEP_HEIGHT,
                      borderTop: '1px solid #EDE8DF',
                    }}
                    onMouseEnter={() => setHoveredSubjectId(subject.id)}
                    onMouseLeave={() => setHoveredSubjectId(null)}
                  >
                    {/* Sticky label */}
                    <div style={{
                      ...stickyLabel(15),
                      background: '#EDE8DF',
                      borderRight: '1px solid #E3DDD5',
                      display: 'flex',
                      alignItems: 'center',
                      paddingLeft: 0,
                    }}>
                      {/* Subject color stripe */}
                      <div style={{
                        width: 4,
                        height: '100%',
                        background: subject.color,
                        flexShrink: 0,
                        borderRadius: '0 3px 3px 0',
                      }} />

                      {/* Collapse toggle + name */}
                      <div
                        style={{
                          flex: 1,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '0 6px 0 8px',
                          cursor: 'pointer',
                          height: '100%',
                          userSelect: 'none',
                          minWidth: 0,
                        }}
                        onClick={() => toggleCollapse(subject.id)}
                      >
                        <svg
                          width="8" height="8" viewBox="0 0 10 10" fill="none"
                          style={{
                            flexShrink: 0,
                            transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                            transition: 'transform 0.18s cubic-bezier(0.4,0,0.2,1)',
                          }}
                        >
                          <path d="M2 3.5L5 6.5L8 3.5" stroke="#A8A29E" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        <span style={{
                          fontSize: isMobile ? 10 : 11,
                          fontWeight: 700,
                          color: '#78716C',
                          letterSpacing: '-0.01em',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          flex: 1,
                        }}>
                          {subject.name}
                        </span>
                        {!collapsed && taskRows.length > 0 && (
                          <span style={{
                            fontSize: 9,
                            color: '#A8A29E',
                            background: 'rgba(20,16,10,0.07)',
                            borderRadius: 9999,
                            padding: '1px 5px',
                            flexShrink: 0,
                            fontWeight: 700,
                          }}>
                            {taskRows.length}
                          </span>
                        )}
                      </div>

                      {/* Delete button */}
                      {!isDeletingThis && (
                        <button
                          onClick={e => { e.stopPropagation(); setDeletingSubjectId(subject.id) }}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '3px 7px 3px 2px',
                            color: '#C4BDB5',
                            display: 'flex',
                            alignItems: 'center',
                            flexShrink: 0,
                            opacity: isHovered ? 1 : 0,
                            transition: 'opacity 0.15s',
                            borderRadius: 4,
                          }}
                        >
                          <svg width="11" height="11" viewBox="0 0 13 13" fill="none">
                            <path d="M2 3.5h9M5 3.5V2.5h3v1M5.5 5.5v4M7.5 5.5v4M3 3.5l.5 7h6l.5-7" stroke="#A8A29E" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </button>
                      )}

                      {/* Inline delete confirm */}
                      {isDeletingThis && (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '0 7px 0 2px',
                          flexShrink: 0,
                        }}>
                          <span style={{ fontSize: 9, color: '#DC2626', fontWeight: 700, whiteSpace: 'nowrap', letterSpacing: '-0.01em' }}>削除?</span>
                          <button
                            onClick={e => { e.stopPropagation(); handleDeleteSubject(subject.id) }}
                            style={{
                              background: '#DC2626',
                              color: '#fff',
                              border: 'none',
                              borderRadius: 4,
                              padding: '2px 7px',
                              fontSize: 9,
                              fontWeight: 700,
                              cursor: 'pointer',
                              fontFamily: 'inherit',
                            }}
                          >
                            はい
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); setDeletingSubjectId(null) }}
                            style={{
                              background: 'rgba(20,16,10,0.07)',
                              color: '#78716C',
                              border: 'none',
                              borderRadius: 4,
                              padding: '2px 7px',
                              fontSize: 9,
                              fontWeight: 600,
                              cursor: 'pointer',
                              fontFamily: 'inherit',
                            }}
                          >
                            否
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Grid: faint color wash */}
                    <div style={{
                      flex: 1,
                      background: `linear-gradient(90deg, ${subject.color}14 0%, transparent 140px)`,
                      borderBottom: `1px solid ${subject.color}20`,
                    }} />
                  </div>

                  {/* Task rows */}
                  {!collapsed && taskRows.map(row => (
                    <div key={row.rowKey} style={{ display: 'flex', height: ROW_HEIGHT, borderBottom: '1px solid #EDE8DF' }}>
                      {/* Sticky task label */}
                      <div style={{
                        ...stickyLabel(10),
                        background: '#FFFFFF',
                        borderRight: '1px solid #EDE8DF',
                        display: 'flex',
                        alignItems: 'center',
                        paddingLeft: isMobile ? 10 : 22,
                        gap: isMobile ? 4 : 6,
                        paddingRight: isMobile ? 4 : 10,
                      }}>
                        {row.isRecurring && (
                          <div style={{
                            width: 4,
                            height: 4,
                            borderRadius: '50%',
                            background: subject.color,
                            flexShrink: 0,
                            opacity: 0.7,
                          }} />
                        )}
                        <span style={{
                          fontSize: isMobile ? 10 : 12,
                          color: '#78716C',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          flex: 1,
                          fontWeight: row.isRecurring ? 600 : 400,
                          letterSpacing: '-0.01em',
                        }}>
                          {row.title}
                        </span>
                        {row.isRecurring && !isMobile && (
                          <span style={{
                            fontSize: 9,
                            color: '#A8A29E',
                            flexShrink: 0,
                            background: '#F2EFE9',
                            borderRadius: 9999,
                            padding: '1px 5px',
                            fontWeight: 600,
                          }}>
                            {row.tasks.length}
                          </span>
                        )}
                      </div>

                      {/* Grid + bars */}
                      <div style={{ flex: 1, position: 'relative', background: '#FFFFFF' }}>
                        {/* Column shading */}
                        {days.map((d, i) => {
                          const dow = d.getDay()
                          const isWknd = dow === 0 || dow === 6
                          const isTodayCol = toDateString(d) === todayStr
                          if (!isWknd && !isTodayCol) return null
                          return (
                            <div
                              key={i}
                              style={{
                                position: 'absolute',
                                left: i * COL_WIDTH,
                                top: 0,
                                width: COL_WIDTH,
                                height: ROW_HEIGHT,
                                background: isTodayCol
                                  ? 'rgba(59,99,255,0.04)'
                                  : 'rgba(20,16,10,0.016)',
                                borderRight: '1px solid rgba(20,16,10,0.025)',
                                pointerEvents: 'none',
                              }}
                            />
                          )
                        })}

                        {/* Task bars */}
                        {row.tasks.map(task => {
                          const bp = getBarProps(task)
                          if (!bp) return null
                          const { left, width, color, bg } = bp

                          return (
                            <div
                              key={task.id}
                              onClick={e => handleBarClick(e, task)}
                              title={`${task.title}：${task.start_date} → ${task.due_date}`}
                              style={{
                                position: 'absolute',
                                left,
                                width,
                                top: '50%',
                                transform: 'translateY(-50%)',
                                height: 28,
                                background: bg,
                                borderRadius: 6,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                paddingLeft: 8,
                                paddingRight: 16,
                                overflow: 'hidden',
                                whiteSpace: 'nowrap',
                                zIndex: 2,
                                transition: 'transform 0.12s, box-shadow 0.12s',
                                borderLeft: `3px solid ${color}`,
                                boxShadow: `0 1px 4px ${color}18`,
                              }}
                              onMouseEnter={e => {
                                const el = e.currentTarget as HTMLElement
                                el.style.transform = 'translateY(-50%) translateY(-2px)'
                                el.style.boxShadow = `0 4px 12px ${color}28`
                                el.style.zIndex = '3'
                              }}
                              onMouseLeave={e => {
                                const el = e.currentTarget as HTMLElement
                                el.style.transform = 'translateY(-50%)'
                                el.style.boxShadow = `0 1px 4px ${color}18`
                                el.style.zIndex = '2'
                              }}
                            >
                              {/* Arrow right-end */}
                              <div style={{
                                position: 'absolute',
                                right: 0,
                                top: 0,
                                bottom: 0,
                                width: 18,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: `linear-gradient(90deg, transparent, ${bg} 60%)`,
                              }}>
                                <svg width="5" height="9" viewBox="0 0 6 10" fill="none">
                                  <path d="M1 1L5 5L1 9" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              </div>

                              <span style={{
                                fontSize: 11,
                                fontWeight: 600,
                                color,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                letterSpacing: '-0.02em',
                                lineHeight: 1,
                              }}>
                                {task.title}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}

                  {/* Empty subject */}
                  {!collapsed && taskRows.length === 0 && (
                    <div style={{ display: 'flex', height: ROW_HEIGHT, borderBottom: '1px solid #EDE8DF' }}>
                      <div style={{
                        ...stickyLabel(10),
                        background: '#FFFFFF',
                        borderRight: '1px solid #EDE8DF',
                        display: 'flex',
                        alignItems: 'center',
                        paddingLeft: 22,
                      }}>
                        <span style={{ fontSize: 11, color: '#C4BDB5', fontStyle: 'italic', letterSpacing: '-0.01em' }}>課題なし</span>
                      </div>
                      <div style={{ flex: 1, background: '#FFFFFF' }} />
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* ---- Overlays ---- */}
      {selectedTask && (
        <TaskDetailPanel
          task={selectedTask}
          subjects={subjects}
          onClose={() => setSelectedTask(null)}
        />
      )}
      {showAddModal && (
        <AddTaskModal
          subjects={subjects}
          onClose={() => setShowAddModal(false)}
        />
      )}
      {quickMenu && (
        <TaskQuickMenu
          task={quickMenu.task}
          position={{ x: quickMenu.x, y: quickMenu.y }}
          onClose={() => setQuickMenu(null)}
          onOpenDetail={() => { setSelectedTask(quickMenu.task); setQuickMenu(null) }}
        />
      )}
    </div>
  )
}
