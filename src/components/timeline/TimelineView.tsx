import { useRef, useEffect, useState, useCallback } from 'react'
import type { Subject, Task } from '../../types'
import { STATUS_CONFIG, isOverdue, toDateString, parseLocalDate } from '../../types'
import TaskDetailPanel from '../task/TaskDetailPanel'
import AddTaskModal from '../task/AddTaskModal'
import TaskQuickMenu from '../task/TaskQuickMenu'
import ColorPicker from '../ui/ColorPicker'
import { useStore } from '../../store/useStore'
import { useToast } from '../ui/Toast'

const COL_WIDTH_DESKTOP = 44
const COL_WIDTH_MOBILE = 36
const LABEL_WIDTH_DESKTOP = 216
const LABEL_WIDTH_MOBILE = 108
const ROW_HEIGHT = 52
const HEADER_HEIGHT = 56
const SUBJECT_SEP_HEIGHT = 36

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

const DARK_BAR_CONFIG: Record<string, { color: string; bg: string }> = {
  todo:        { color: '#A8A29E', bg: 'rgba(155,149,144,0.16)' },
  in_progress: { color: '#6B84FF', bg: 'rgba(107,132,255,0.18)' },
  done:        { color: '#22C55E', bg: 'rgba(22,163,74,0.18)' },
  submitted:   { color: '#A855F7', bg: 'rgba(124,58,237,0.18)' },
  overdue:     { color: '#EF4444', bg: 'rgba(239,68,68,0.16)' },
}

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

/**
 * Groups tasks into rows:
 * - Recurring tasks: grouped by recurrence_id
 * - Single tasks: grouped by (row_id ?? task.id) — tasks pointing to the same anchor share a row
 */
function buildTaskRows(tasks: Task[]): TaskRow[] {
  const recurMap = new Map<string, Task[]>()
  const rowMap = new Map<string, Task[]>()

  for (const t of tasks) {
    if (t.recurrence_id) {
      const arr = recurMap.get(t.recurrence_id) ?? []
      arr.push(t)
      recurMap.set(t.recurrence_id, arr)
    } else {
      // Tasks with row_id point to the anchor task's id; anchors (row_id=null) use their own id
      const key = t.row_id ?? t.id
      const arr = rowMap.get(key) ?? []
      arr.push(t)
      rowMap.set(key, arr)
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
  for (const [key, ts] of rowMap) {
    const sorted = [...ts].sort((a, b) => a.start_date.localeCompare(b.start_date))
    rows.push({ rowKey: key, title: sorted[0].title, tasks: sorted, isRecurring: false })
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

// Helper: add N days to a YYYY-MM-DD string
function addDaysToStr(dateStr: string, days: number): string {
  const d = parseLocalDate(dateStr)
  d.setDate(d.getDate() + days)
  return toDateString(d)
}

interface DragState {
  type: 'move' | 'resize-start' | 'resize-end'
  taskId: string
  startX: number
  origStartDate: string
  origDueDate: string
  moved: boolean
}

export default function TimelineView() {
  const { subjects, tasks, fetchAll, deleteSubject, updateSubject, signOut, updateTask, loading, isDark, toggleTheme } = useStore()
  const { showToast } = useToast()
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [addModalSubjectId, setAddModalSubjectId] = useState<string | null>(null)
  /** rowKey + subjectId for adding to an existing row */
  const [addToRow, setAddToRow] = useState<{ rowKey: string; subjectId: string } | null>(null)
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 640)
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set())
  const [deletingSubjectId, setDeletingSubjectId] = useState<string | null>(null)
  const [quickMenu, setQuickMenu] = useState<{ task: Task; x: number; y: number } | null>(null)
  const [hoveredSubjectId, setHoveredSubjectId] = useState<string | null>(null)
  const [hoveredRowKey, setHoveredRowKey] = useState<string | null>(null)
  const [selectedStatuses, setSelectedStatuses] = useState<Set<EffectiveStatus>>(new Set())
  /** 表示範囲: 'week'=今週, 'month'=今月(30日), 'all'=すべて */
  const [viewRange, setViewRange] = useState<'week' | 'month' | 'all'>('month')
  /** 科目カラーピッカー: subjectId */
  const [colorPickerSubjectId, setColorPickerSubjectId] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // ---- Drag state ----
  const dragRef = useRef<DragState | null>(null)
  const dragOverrideRef = useRef<{ id: string; start_date: string; due_date: string } | null>(null)
  const [dragOverride, setDragOverride] = useState<{ id: string; start_date: string; due_date: string } | null>(null)
  const wasDraggingRef = useRef(false)

  const days = getDays(TOTAL_DAYS)
  const todayStr = toDateString(new Date())
  const todayIdx = days.findIndex(d => toDateString(d) === todayStr)

  // 表示範囲cutoff
  const focusCutoffStr = (() => {
    if (viewRange === 'all') return '9999-12-31'
    const d = new Date()
    d.setDate(d.getDate() + (viewRange === 'week' ? 7 : 30))
    return toDateString(d)
  })()

  useEffect(() => { fetchAll() }, [fetchAll])

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const COL_WIDTH = isMobile ? COL_WIDTH_MOBILE : COL_WIDTH_DESKTOP
  const LABEL_WIDTH = isMobile ? LABEL_WIDTH_MOBILE : LABEL_WIDTH_DESKTOP

  // ---- Scroll to today ----
  const scrollToToday = useCallback(() => {
    if (scrollRef.current && todayIdx >= 0) {
      const target = LABEL_WIDTH + todayIdx * COL_WIDTH - scrollRef.current.clientWidth / 2 + COL_WIDTH / 2
      scrollRef.current.scrollTo({ left: Math.max(0, target), behavior: 'smooth' })
    }
  }, [todayIdx, COL_WIDTH, LABEL_WIDTH])

  useEffect(() => {
    if (scrollRef.current && todayIdx >= 0) {
      const target = LABEL_WIDTH + todayIdx * COL_WIDTH - scrollRef.current.clientWidth / 2 + COL_WIDTH / 2
      scrollRef.current.scrollLeft = Math.max(0, target)
    }
  }, [todayIdx])

  // Keyboard shortcuts: N = new task, T = scroll to today
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault()
        setAddModalSubjectId('')
      } else if (e.key === 't' || e.key === 'T') {
        scrollToToday()
      } else if (e.key === 'd' || e.key === 'D') {
        toggleTheme()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [scrollToToday])

  // ---- Drag: mousemove / mouseup on document ----
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const drag = dragRef.current
      if (!drag) return
      const deltaX = e.clientX - drag.startX
      if (Math.abs(deltaX) > 4) drag.moved = true
      const deltaCols = Math.round(deltaX / COL_WIDTH)

      let newStart = drag.origStartDate
      let newDue = drag.origDueDate

      if (drag.type === 'move') {
        newStart = addDaysToStr(drag.origStartDate, deltaCols)
        newDue = addDaysToStr(drag.origDueDate, deltaCols)
      } else if (drag.type === 'resize-start') {
        newStart = addDaysToStr(drag.origStartDate, deltaCols)
        if (newStart >= drag.origDueDate) newStart = addDaysToStr(drag.origDueDate, -1)
      } else if (drag.type === 'resize-end') {
        newDue = addDaysToStr(drag.origDueDate, deltaCols)
        if (newDue <= drag.origStartDate) newDue = addDaysToStr(drag.origStartDate, 1)
      }

      const override = { id: drag.taskId, start_date: newStart, due_date: newDue }
      dragOverrideRef.current = override
      setDragOverride(override)
    }

    const handleMouseUp = async () => {
      const drag = dragRef.current
      if (!drag) return
      wasDraggingRef.current = drag.moved
      dragRef.current = null
      const override = dragOverrideRef.current
      dragOverrideRef.current = null
      setDragOverride(null)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      if (override && drag.moved &&
          (override.start_date !== drag.origStartDate || override.due_date !== drag.origDueDate)) {
        await updateTask(override.id, { start_date: override.start_date, due_date: override.due_date })
        showToast('課題の日程を更新しました')
      }
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [COL_WIDTH, updateTask, showToast])

  const startDrag = useCallback((e: React.MouseEvent, task: Task, type: DragState['type']) => {
    e.preventDefault()
    e.stopPropagation()
    document.body.style.cursor = type === 'move' ? 'grabbing' : 'ew-resize'
    document.body.style.userSelect = 'none'
    dragRef.current = {
      type,
      taskId: task.id,
      startX: e.clientX,
      origStartDate: task.start_date,
      origDueDate: task.due_date,
      moved: false,
    }
  }, [])

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
      showToast('科目を削除しました')
    } catch (e: unknown) {
      showToast((e as Error).message, 'error')
    }
  }

  const isFiltering = selectedStatuses.size > 0

  /** A row matches focus if any of its tasks overlaps with [today, today+30]
   *  (already started but not yet due, OR starting within the next 30 days) */
  const rowMatchesFocus = useCallback((row: TaskRow): boolean => {
    return row.tasks.some(t => t.start_date <= focusCutoffStr && t.due_date >= todayStr)
  }, [todayStr, focusCutoffStr])

  const grouped: GroupedSubject[] = subjects
    .map(subject => {
      const allRows = buildTaskRows(tasks.filter(t => t.subject_id === subject.id))
      let taskRows = allRows

      // Apply status filter
      if (isFiltering) {
        taskRows = taskRows
          .map(row => ({
            ...row,
            tasks: row.tasks.filter(t => taskMatchesFilter(t, selectedStatuses, todayStr)),
          }))
          .filter(row => row.tasks.length > 0)
      }

      // Apply focus filter
      if (viewRange !== 'all') {
        taskRows = taskRows.filter(row => rowMatchesFocus(row))
      }

      return { subject, taskRows }
    })
    .filter(g => g.taskRows.length > 0)

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
    const statusKey = isOverdue(task) ? 'overdue' : task.status
    const cfg = isDark ? DARK_BAR_CONFIG[statusKey] : (isOverdue(task) ? STATUS_CONFIG.overdue : STATUS_CONFIG[task.status])
    return { left: startI * COL_WIDTH, width: Math.max((endI - startI + 1) * COL_WIDTH, COL_WIDTH), color: cfg.color, bg: cfg.bg }
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100svh', background: 'var(--bg)' }}>

      {/* ---- Glassmorphism header ---- */}
      <header style={{
        height: 52,
        background: 'var(--header-glass)',
        backdropFilter: 'blur(20px) saturate(160%)',
        WebkitBackdropFilter: 'blur(20px) saturate(160%)',
        borderBottom: '1px solid var(--border)',
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
          <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.04em', flexShrink: 0 }}>
            River
          </span>
          <div style={{ width: 1, height: 14, background: 'var(--border)', marginLeft: 2, flexShrink: 0 }} />
          <span style={{
            fontSize: 12,
            color: 'var(--text-secondary)',
            fontWeight: 500,
            letterSpacing: '-0.01em',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            課題タイムライン
          </span>
          <span style={{
            fontSize: 10,
            color: 'var(--text-tertiary, var(--text-secondary))',
            fontWeight: 500,
            letterSpacing: '0.02em',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: 4,
            padding: '1px 5px',
            flexShrink: 0,
          }}>
            v{__APP_VERSION__}
          </span>
        </div>

        {/* Add task button */}
        <button
          onClick={() => setAddModalSubjectId('')}
          aria-label="課題を追加 (N)"
          title="課題を追加 [N]"
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
            transition: 'all 0.25s',
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            flexShrink: 0,
            fontFamily: 'inherit',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.boxShadow = '0 5px 16px rgba(59,99,255,0.42)'
            e.currentTarget.style.transform = 'translateY(-1px)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.boxShadow = '0 3px 10px rgba(59,99,255,0.3)'
            e.currentTarget.style.transform = 'translateY(0)'
          }}
        >
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
            <path d="M6 1v10M1 6h10" stroke="white" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          {!isMobile && '課題を追加'}
        </button>

        {/* Dark mode toggle */}
        <button
          onClick={toggleTheme}
          aria-label={isDark ? 'ライトモードに切り替え' : 'ダークモードに切り替え'}
          title={isDark ? 'ライトモード [D]' : 'ダークモード [D]'}
          style={{
            background: 'transparent',
            border: '1px solid var(--border)',
            borderRadius: 7,
            padding: isMobile ? '6px 8px' : '6px 10px',
            fontSize: 15,
            cursor: 'pointer',
            color: 'var(--text-secondary)',
            transition: 'all 0.2s',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            lineHeight: 1,
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-secondary)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
        >
          {isDark ? '☀️' : '🌙'}
        </button>

        {/* Logout */}
        <button
          onClick={() => signOut()}
          aria-label="ログアウト"
          style={{
            background: 'transparent',
            border: '1px solid var(--border)',
            borderRadius: 7,
            padding: isMobile ? '6px 8px' : '6px 11px',
            fontSize: 12,
            fontWeight: 500,
            cursor: 'pointer',
            color: 'var(--text-secondary)',
            transition: 'all 0.2s',
            flexShrink: 0,
            fontFamily: 'inherit',
            letterSpacing: '-0.01em',
            display: 'flex',
            alignItems: 'center',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'var(--bg-secondary)'
            e.currentTarget.style.borderColor = 'var(--border-strong)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.borderColor = 'var(--border)'
          }}
        >
          {isMobile ? (
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M10 3L15 8M15 8L10 13M15 8H5M6 2H2.5C1.67 2 1 2.67 1 3.5v9c0 .83.67 1.5 1.5 1.5H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          ) : 'ログアウト'}
        </button>
      </header>

      {/* ---- Filter bar ---- */}
      <div style={{
        height: 42,
        borderBottom: '1px solid var(--border-light)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 18px',
        gap: 6,
        flexShrink: 0,
        background: 'var(--filter-glass)',
        position: 'relative',
        zIndex: 99,
        overflowX: 'auto',
        // スクロール可能であることをさりげなく示すフェード（::after は CSS-in-JS では難しいので親に position:relative が必要）
      }}>
        {/* Today button */}
        <button
          onClick={scrollToToday}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            background: 'transparent',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border)',
            borderRadius: 9999,
            padding: '3px 10px 3px 7px',
            fontSize: 12,
            fontWeight: 500,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            transition: 'all 0.2s',
            flexShrink: 0,
            letterSpacing: '-0.01em',
            fontFamily: 'inherit',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'var(--accent-bg)'
            e.currentTarget.style.borderColor = 'rgba(59,99,255,0.3)'
            e.currentTarget.style.color = 'var(--accent)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.borderColor = 'var(--border)'
            e.currentTarget.style.color = 'var(--text-secondary)'
          }}
          title="今日にスクロール [T]"
        >
          <svg width="9" height="9" viewBox="0 0 10 10" fill="none" style={{ flexShrink: 0 }}>
            <circle cx="5" cy="5" r="3.5" stroke="currentColor" strokeWidth="1.6"/>
            <circle cx="5" cy="5" r="1.2" fill="currentColor"/>
          </svg>
          今日
        </button>

        <div style={{ width: 1, height: 14, background: 'var(--border)', flexShrink: 0 }} />

        {!isMobile && (
          <span style={{
            fontSize: 11,
            fontWeight: 700,
            color: 'var(--text-disabled)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            flexShrink: 0,
            marginRight: 2,
          }}>
            絞り込み
          </span>
        )}

        {/* View range selector */}
        {([
          { key: 'week',  label: '今週' },
          { key: 'month', label: '今月' },
          { key: 'all',   label: 'すべて' },
        ] as const).map(opt => {
          const active = viewRange === opt.key
          return (
            <button
              key={opt.key}
              onClick={() => setViewRange(opt.key)}
              style={{
                background: active ? '#FEF9EE' : 'transparent',
                color: active ? '#D97706' : 'var(--text-secondary)',
                border: `1px solid ${active ? '#D9770644' : 'var(--border)'}`,
                borderRadius: 9999,
                padding: '3px 10px',
                fontSize: 12,
                fontWeight: active ? 700 : 400,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s',
                flexShrink: 0,
                letterSpacing: '-0.01em',
                fontFamily: 'inherit',
                boxShadow: active ? '0 2px 8px rgba(217,119,6,0.18)' : 'none',
              }}
              onMouseEnter={e => {
                if (!active) {
                  e.currentTarget.style.background = '#FEF9EE'
                  e.currentTarget.style.borderColor = '#D9770633'
                  e.currentTarget.style.color = '#D97706'
                }
              }}
              onMouseLeave={e => {
                if (!active) {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.borderColor = 'var(--border)'
                  e.currentTarget.style.color = 'var(--text-secondary)'
                }
              }}
            >
              {opt.label}
            </button>
          )
        })}

        {/* Divider */}
        <div style={{ width: 1, height: 14, background: 'var(--border)', flexShrink: 0 }} />

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
                color: isActive ? cfg.color : 'var(--text-secondary)',
                border: `1px solid ${isActive ? cfg.color + '44' : 'var(--border)'}`,
                borderRadius: 9999,
                padding: '3px 10px 3px 7px',
                fontSize: 12,
                fontWeight: isActive ? 600 : 400,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s',
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
                  e.currentTarget.style.borderColor = 'var(--border)'
                  e.currentTarget.style.color = 'var(--text-secondary)'
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
            <div style={{ width: 1, height: 14, background: 'var(--border)', margin: '0 2px', flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)', flexShrink: 0, letterSpacing: '-0.01em' }}>
              {filteredTotal}件
            </span>
            <button
              onClick={() => setSelectedStatuses(new Set())}
              style={{
                background: 'none',
                border: '1px solid var(--border)',
                cursor: 'pointer',
                fontSize: 11,
                color: 'var(--text-tertiary)',
                padding: '2px 8px',
                borderRadius: 9999,
                flexShrink: 0,
                fontFamily: 'inherit',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'var(--bg-secondary)'
                e.currentTarget.style.color = 'var(--text-secondary)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'none'
                e.currentTarget.style.color = 'var(--text-tertiary)'
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
            background: 'var(--bg)',
            borderBottom: '1px solid var(--border)',
            boxShadow: '0 2px 8px rgba(20,16,10,0.04)',
          }}>
            {/* Corner cell */}
            <div style={{
              ...stickyLabel(30),
              height: HEADER_HEIGHT,
              background: 'var(--bg)',
              borderRight: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'flex-end',
              padding: '0 14px 12px',
            }}>
              <span style={{
                fontSize: 10,
                fontWeight: 700,
                color: 'var(--text-disabled)',
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
                      ? 'rgba(59,99,255,0.1)'
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
                      color: 'var(--text-secondary)',
                      letterSpacing: '0.05em',
                      whiteSpace: 'nowrap',
                    }}>
                      {day.getMonth() + 1}月
                    </div>
                  )}
                  <span style={{
                    fontSize: 9,
                    fontWeight: 600,
                    color: isSun ? '#DC2626' : isSat ? 'var(--accent)' : 'var(--text-disabled)',
                    letterSpacing: '0.02em',
                  }}>
                    {DAY_JA[dow]}
                  </span>
                  <div style={{
                    width: isToday ? 26 : 24,
                    height: isToday ? 26 : 24,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '50%',
                    background: isToday ? 'var(--accent)' : 'transparent',
                    boxShadow: isToday ? '0 2px 10px rgba(59,99,255,0.48), 0 0 0 2px rgba(59,99,255,0.18)' : 'none',
                    fontSize: isToday ? 12 : 11,
                    fontWeight: isToday ? 800 : 400,
                    color: isToday ? '#ffffff' : isSun ? '#DC2626' : isSat ? 'var(--accent)' : 'var(--text-secondary)',
                    letterSpacing: '-0.02em',
                    transition: 'all 0.2s',
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
            width: 2,
            background: 'linear-gradient(180deg, #3B63FF 0%, rgba(59,99,255,0.12) 100%)',
            zIndex: 4,
            pointerEvents: 'none',
            boxShadow: '0 0 6px 1px rgba(59,99,255,0.28)',
          }} />

          {/* ---- Subject groups ---- */}
          {loading && subjects.length === 0 ? (
            /* Skeleton loader while fetching */
            <>
              <style>{`@keyframes skPulse2{0%,100%{opacity:1}50%{opacity:.35}}`}</style>
              {[36, 52, 52, 52, 36, 52, 52].map((h, i) => (
                <div key={i} style={{ display: 'flex', height: h, borderBottom: '1px solid var(--border-light)', background: h === 36 ? 'var(--bg-secondary)' : 'var(--surface)' }}>
                  <div style={{ width: LABEL_WIDTH, flexShrink: 0, display: 'flex', alignItems: 'center', padding: h === 36 ? '0 14px' : '0 28px', borderRight: '1px solid var(--border-light)', gap: 12 }}>
                    <div style={{ width: h === 36 ? 52 : 80 + (i % 3) * 18, height: h === 36 ? 9 : 11, borderRadius: 5, background: 'var(--border)', animation: `skPulse2 1.5s ease-in-out ${i * 0.08}s infinite` }} />
                  </div>
                  {h !== 36 && (
                    <div style={{ flex: 1, position: 'relative', background: 'var(--surface)', display: 'flex', alignItems: 'center', padding: '0 12px' }}>
                      <div style={{ width: 120 + (i % 3) * 50, height: 34, borderRadius: 6, background: 'var(--border)', animation: `skPulse2 1.5s ease-in-out ${i * 0.12}s infinite` }} />
                    </div>
                  )}
                </div>
              ))}
            </>
          ) : grouped.length === 0 ? (
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
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  boxShadow: '0 2px 8px rgba(20,16,10,0.06)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 14px',
                }}>
                  <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                    <rect x="2.5" y="2.5" width="17" height="17" rx="4.5" stroke="var(--text-disabled)" strokeWidth="1.5"/>
                    <path d="M8 11h6M11 8v6" stroke="var(--text-disabled)" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </div>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0, fontWeight: 600, letterSpacing: '-0.02em' }}>
                  {viewRange !== 'all' ? `「${viewRange === 'week' ? '今週' : '今月'}」の課題がありません` : '課題を追加してはじめましょう'}
                </p>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 5, letterSpacing: '-0.01em' }}>
                  {viewRange !== 'all' ? '「すべて」に切り替えると全期間の課題が表示されます' : '右上の「課題を追加」から追加できます [N]'}
                </p>
                {viewRange !== 'all' && (
                  <button
                    onClick={() => setViewRange('all')}
                    style={{
                      marginTop: 14,
                      background: '#FEF9EE',
                      color: '#D97706',
                      border: '1px solid rgba(217,119,6,0.3)',
                      borderRadius: 9999,
                      padding: '6px 18px',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      letterSpacing: '-0.01em',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#FEF3C7'; e.currentTarget.style.borderColor = 'rgba(217,119,6,0.5)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#FEF9EE'; e.currentTarget.style.borderColor = 'rgba(217,119,6,0.3)' }}
                  >
                    「すべて」に切り替える
                  </button>
                )}
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
                      borderTop: '1px solid var(--border-light)',
                    }}
                    onMouseEnter={() => setHoveredSubjectId(subject.id)}
                    onMouseLeave={() => setHoveredSubjectId(null)}
                  >
                    {/* Sticky label */}
                    <div style={{
                      ...stickyLabel(15),
                      background: 'var(--bg-secondary)',
                      borderRight: '1px solid var(--border)',
                      display: 'flex',
                      alignItems: 'center',
                      paddingLeft: 0,
                    }}>
                      {/* Subject color stripe — クリックでカラーピッカー */}
                      <div
                        style={{
                          width: 8,
                          height: '100%',
                          background: subject.color,
                          flexShrink: 0,
                          borderRadius: '0 4px 4px 0',
                          cursor: 'pointer',
                          position: 'relative',
                        }}
                        title="クリックして色を変更"
                        onClick={e => {
                          e.stopPropagation()
                          setColorPickerSubjectId(colorPickerSubjectId === subject.id ? null : subject.id)
                        }}
                      >
                        {colorPickerSubjectId === subject.id && (
                          <ColorPicker
                            value={subject.color}
                            onChange={color => updateSubject(subject.id, { color })}
                            onClose={() => setColorPickerSubjectId(null)}
                            position={{ top: '100%', left: 0 }}
                          />
                        )}
                      </div>

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
                            transition: 'transform 0.22s cubic-bezier(0.4,0,0.2,1)',
                          }}
                        >
                          <path d="M2 3.5L5 6.5L8 3.5" stroke="var(--text-tertiary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        <span
                          title={subject.name}
                          style={{
                            fontSize: isMobile ? 10 : 11,
                            fontWeight: 700,
                            color: 'var(--text-secondary)',
                            letterSpacing: '-0.01em',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            flex: 1,
                          }}
                        >
                          {subject.name}
                        </span>
                        {!collapsed && taskRows.length > 0 && (
                          <span style={{
                            fontSize: 9,
                            color: 'var(--text-tertiary)',
                            background: 'var(--border-light)',
                            borderRadius: 9999,
                            padding: '1px 5px',
                            flexShrink: 0,
                            fontWeight: 700,
                          }}>
                            {taskRows.length}
                          </span>
                        )}
                      </div>

                      {/* Add new row to subject */}
                      {!isDeletingThis && (
                        <button
                          onClick={e => { e.stopPropagation(); setAddModalSubjectId(subject.id) }}
                          aria-label={`${subject.name}に課題を追加`}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '3px 4px 3px 2px',
                            color: 'var(--text-disabled)',
                            display: 'flex',
                            alignItems: 'center',
                            flexShrink: 0,
                            opacity: isHovered ? 1 : 0,
                            transition: 'opacity 0.2s',
                            borderRadius: 4,
                          }}
                          title="この科目に新しい課題を追加"
                        >
                          <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                            <path d="M6 1v10M1 6h10" stroke="#3B63FF" strokeWidth="2" strokeLinecap="round"/>
                          </svg>
                        </button>
                      )}

                      {/* Delete button */}
                      {!isDeletingThis && (
                        <button
                          onClick={e => { e.stopPropagation(); setDeletingSubjectId(subject.id) }}
                          aria-label={`${subject.name}を削除`}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '3px 7px 3px 2px',
                            color: 'var(--text-disabled)',
                            display: 'flex',
                            alignItems: 'center',
                            flexShrink: 0,
                            opacity: isHovered ? 1 : 0,
                            transition: 'opacity 0.2s',
                            borderRadius: 4,
                          }}
                        >
                          <svg width="11" height="11" viewBox="0 0 13 13" fill="none">
                            <path d="M2 3.5h9M5 3.5V2.5h3v1M5.5 5.5v4M7.5 5.5v4M3 3.5l.5 7h6l.5-7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
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
                              background: 'var(--border-light)',
                              color: 'var(--text-secondary)',
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

                    {/* Grid: faint color wash + 完了率バー */}
                    <div style={{
                      flex: 1,
                      background: `linear-gradient(90deg, ${subject.color}14 0%, transparent 140px)`,
                      borderBottom: `1px solid ${subject.color}20`,
                      position: 'relative',
                      overflow: 'hidden',
                    }}>
                      {(() => {
                        const subjectTasks = tasks.filter(t => t.subject_id === subject.id)
                        const total = subjectTasks.length
                        const done = subjectTasks.filter(t => t.status === 'done' || t.status === 'submitted').length
                        if (total === 0) return null
                        const pct = Math.round((done / total) * 100)
                        return (
                          <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ width: 48, height: 4, background: `${subject.color}25`, borderRadius: 9999, overflow: 'hidden' }}>
                              <div style={{ width: `${pct}%`, height: '100%', background: subject.color, borderRadius: 9999, transition: 'width 0.4s ease' }} />
                            </div>
                            <span style={{ fontSize: 9, fontWeight: 700, color: subject.color, opacity: 0.8, letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
                              {done}/{total}
                            </span>
                          </div>
                        )
                      })()}
                    </div>
                  </div>

                  {/* Task rows */}
                  {!collapsed && taskRows.map(row => {
                    const isRowHovered = hoveredRowKey === row.rowKey
                    return (
                      <div
                        key={row.rowKey}
                        style={{ display: 'flex', height: ROW_HEIGHT, borderBottom: '1px solid var(--border-light)' }}
                        onMouseEnter={() => setHoveredRowKey(row.rowKey)}
                        onMouseLeave={() => setHoveredRowKey(null)}
                      >
                        {/* Sticky task label */}
                        <div style={{
                          ...stickyLabel(10),
                          background: 'var(--surface)',
                          borderRight: '1px solid var(--border-light)',
                          display: 'flex',
                          alignItems: 'center',
                          paddingLeft: isMobile ? 10 : 22,
                          gap: isMobile ? 4 : 6,
                          paddingRight: isMobile ? 4 : 6,
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
                          <span
                            title={row.title}
                            style={{
                              fontSize: isMobile ? 10 : 12,
                              color: 'var(--text-secondary)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              flex: 1,
                              fontWeight: row.isRecurring ? 600 : 400,
                              letterSpacing: '-0.01em',
                            }}
                          >
                            {row.title}
                          </span>
                          {row.isRecurring && !isMobile && (
                            <span style={{
                              fontSize: 9,
                              color: 'var(--text-tertiary)',
                              flexShrink: 0,
                              background: 'var(--bg-secondary)',
                              borderRadius: 9999,
                              padding: '1px 5px',
                              fontWeight: 600,
                            }}>
                              {row.tasks.length}
                            </span>
                          )}
                          {/* Add task to THIS row button */}
                          <button
                            onClick={e => {
                              e.stopPropagation()
                              setAddToRow({ rowKey: row.rowKey, subjectId: subject.id })
                            }}
                            title="この行に課題を追加"
                            aria-label={`${row.title}の行に課題を追加`}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              padding: '3px 5px',
                              color: '#3B63FF',
                              display: 'flex',
                              alignItems: 'center',
                              flexShrink: 0,
                              opacity: isRowHovered ? 0.8 : 0,
                              transition: 'opacity 0.2s',
                              borderRadius: 4,
                            }}
                          >
                            <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                              <path d="M6 1v10M1 6h10" stroke="#3B63FF" strokeWidth="2" strokeLinecap="round"/>
                            </svg>
                          </button>
                        </div>

                        {/* Grid + bars */}
                        <div style={{ flex: 1, position: 'relative', background: 'var(--surface)' }}>
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
                          {row.tasks.map((task, taskIdx) => {
                            const override = dragOverride?.id === task.id ? dragOverride : null
                            const effectiveTask = override
                              ? { ...task, start_date: override.start_date, due_date: override.due_date }
                              : task
                            const bp = getBarProps(effectiveTask)
                            if (!bp) return null
                            const { left, width, color, bg } = bp
                            const occurrenceLabel = row.isRecurring ? `${taskIdx + 1}/${row.tasks.length}` : null
                            const timeLabel = task.due_time ? ` ${task.due_time}` : ''
                            const isDragging = dragRef.current?.taskId === task.id

                            return (
                              <div
                                key={task.id}
                                onMouseDown={e => startDrag(e, task, 'move')}
                                onClick={e => {
                                  if (wasDraggingRef.current) { wasDraggingRef.current = false; return }
                                  handleBarClick(e, task)
                                }}
                                title={row.isRecurring
                                  ? `${task.title}（第${taskIdx + 1}回/${row.tasks.length}回）：${effectiveTask.start_date} → ${effectiveTask.due_date}${timeLabel}`
                                  : `${task.title}：${effectiveTask.start_date} → ${effectiveTask.due_date}${timeLabel}`}
                                style={{
                                  position: 'absolute',
                                  left,
                                  width,
                                  top: '50%',
                                  transform: 'translateY(-50%)',
                                  height: 34,
                                  background: bg,
                                  borderRadius: 6,
                                  cursor: isDragging ? 'grabbing' : 'grab',
                                  display: 'flex',
                                  alignItems: 'center',
                                  paddingLeft: 8,
                                  paddingRight: 16,
                                  overflow: 'hidden',
                                  whiteSpace: 'nowrap',
                                  zIndex: isDragging ? 10 : 2,
                                  transition: isDragging ? 'none' : 'transform 0.2s, box-shadow 0.2s',
                                  borderLeft: `3px solid ${color}`,
                                  boxShadow: isDragging ? `0 6px 16px ${color}38` : `0 1px 4px ${color}18`,
                                  userSelect: 'none',
                                }}
                                onMouseEnter={e => {
                                  if (!dragRef.current) {
                                    const el = e.currentTarget as HTMLElement
                                    el.style.transform = 'translateY(-50%) translateY(-2px)'
                                    el.style.boxShadow = `0 4px 12px ${color}28`
                                    el.style.zIndex = '3'
                                  }
                                }}
                                onMouseLeave={e => {
                                  if (!dragRef.current) {
                                    const el = e.currentTarget as HTMLElement
                                    el.style.transform = 'translateY(-50%)'
                                    el.style.boxShadow = `0 1px 4px ${color}18`
                                    el.style.zIndex = '2'
                                  }
                                }}
                              >
                                {/* Left resize handle */}
                                <div
                                  onMouseDown={e => { e.stopPropagation(); startDrag(e, task, 'resize-start') }}
                                  style={{
                                    position: 'absolute', left: 0, top: 0, bottom: 0, width: 10,
                                    cursor: 'ew-resize', zIndex: 4, borderRadius: '6px 0 0 6px',
                                  }}
                                />
                                {/* Right resize handle */}
                                <div
                                  onMouseDown={e => { e.stopPropagation(); startDrag(e, task, 'resize-end') }}
                                  style={{
                                    position: 'absolute', right: 0, top: 0, bottom: 0, width: 10,
                                    cursor: 'ew-resize', zIndex: 4,
                                  }}
                                />

                                {/* Arrow right-end */}
                                <div style={{
                                  position: 'absolute',
                                  right: 0, top: 0, bottom: 0, width: 18,
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  background: `linear-gradient(90deg, transparent, ${bg} 60%)`,
                                  pointerEvents: 'none',
                                }}>
                                  <svg width="5" height="9" viewBox="0 0 6 10" fill="none">
                                    <path d="M1 1L5 5L1 9" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>
                                </div>

                                {occurrenceLabel && (
                                  <span style={{
                                    fontSize: 9, fontWeight: 700, color,
                                    background: `${color}22`,
                                    borderRadius: 4, padding: '1px 4px',
                                    flexShrink: 0, letterSpacing: '0.02em', lineHeight: 1, marginRight: 4,
                                    pointerEvents: 'none',
                                  }}>
                                    {occurrenceLabel}
                                  </span>
                                )}
                                <span style={{
                                  fontSize: 11, fontWeight: 600, color,
                                  overflow: 'hidden', textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  letterSpacing: '-0.02em', lineHeight: 1,
                                  pointerEvents: 'none',
                                  flex: 1,
                                  minWidth: 0,
                                }}>
                                  {task.title}
                                  {task.due_time && (
                                    <span style={{ opacity: 0.7, fontWeight: 400, marginLeft: 4 }}>
                                      {task.due_time}
                                    </span>
                                  )}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}

                  {/* Empty subject */}
                  {!collapsed && taskRows.length === 0 && (
                    <div style={{ display: 'flex', height: ROW_HEIGHT, borderBottom: '1px solid var(--border-light)' }}>
                      <div
                        style={{
                          ...stickyLabel(10),
                          background: 'var(--surface)',
                          borderRight: '1px solid var(--border-light)',
                          display: 'flex',
                          alignItems: 'center',
                          paddingLeft: 22,
                          gap: 7,
                          cursor: 'pointer',
                        }}
                        onClick={() => setAddModalSubjectId(subject.id)}
                      >
                        <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                          <path d="M6 1v10M1 6h10" stroke="var(--text-disabled)" strokeWidth="2" strokeLinecap="round"/>
                        </svg>
                        <span style={{ fontSize: 11, color: 'var(--text-disabled)', fontStyle: 'italic', letterSpacing: '-0.01em' }}>課題を追加</span>
                      </div>
                      <div style={{ flex: 1, background: 'var(--surface)' }} />
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
      {addModalSubjectId !== null && (
        <AddTaskModal
          subjects={subjects}
          onClose={() => setAddModalSubjectId(null)}
          defaultSubjectId={addModalSubjectId || undefined}
        />
      )}
      {addToRow !== null && (
        <AddTaskModal
          subjects={subjects}
          onClose={() => setAddToRow(null)}
          defaultSubjectId={addToRow.subjectId}
          targetRowId={addToRow.rowKey}
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
