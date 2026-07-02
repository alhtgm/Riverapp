import { useRef, useEffect, useState, useCallback } from 'react'
import type { Subject, Task } from '../../types'
import { STATUS_CONFIG, isOverdue, toDateString, parseLocalDate } from '../../types'
import TaskDetailPanel from '../task/TaskDetailPanel'
import AddTaskModal from '../task/AddTaskModal'
import TemplateLibrary from '../template/TemplateLibrary'
import TaskQuickMenu from '../task/TaskQuickMenu'
import ColorPicker from '../ui/ColorPicker'
import { useStore } from '../../store/useStore'
import { useToast } from '../ui/Toast'

const COL_WIDTH_DESKTOP = 44
const COL_WIDTH_MOBILE = 36
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

interface SubjectRow {
  rowIndex: number
  tasks: Task[]
  isRecurring: boolean
  title: string
}

interface GroupedSubject {
  subject: Subject
  subjectRows: SubjectRow[]
}

/**
 * Greedy interval scheduling per subject (applies to ALL tasks — both single and recurring).
 * Tasks are sorted by start_date, then each is placed in the row whose last due_date is
 * earliest and strictly before this task's start_date (= no overlap).
 * If no such row exists, a new row is created.
 */
function buildSubjectRows(tasks: Task[]): SubjectRow[] {
  if (tasks.length === 0) return []

  const sorted = [...tasks].sort((a, b) => a.start_date.localeCompare(b.start_date))

  const rowEnds: string[] = []   // due_date of last task in each row
  const assignments: { task: Task; rowIdx: number }[] = []

  for (const task of sorted) {
    let assignedRow = -1
    let earliestEnd = '9999-12-31'  // sentinel = "no qualifying row yet"

    for (let i = 0; i < rowEnds.length; i++) {
      // no overlap: row's last due_date must be strictly before this task's start_date
      if (rowEnds[i] < task.start_date && rowEnds[i] < earliestEnd) {
        assignedRow = i
        earliestEnd = rowEnds[i]
      }
    }

    if (assignedRow === -1) {
      assignedRow = rowEnds.length
      rowEnds.push(task.due_date)
    } else {
      rowEnds[assignedRow] = task.due_date
    }

    assignments.push({ task, rowIdx: assignedRow })
  }

  // Debug: log row assignments
  if (typeof window !== 'undefined' && tasks.length > 0) {
    console.log('[buildSubjectRows]', assignments.map(a => ({
      title: a.task.title,
      start: a.task.start_date,
      due: a.task.due_date,
      row: a.rowIdx,
    })))
  }

  // Group by rowIdx
  const buckets = new Map<number, Task[]>()
  for (const { task, rowIdx } of assignments) {
    const arr = buckets.get(rowIdx) ?? []
    arr.push(task)
    buckets.set(rowIdx, arr)
  }

  const rows: SubjectRow[] = []
  for (const [, rowTasks] of [...buckets.entries()].sort(([a], [b]) => a - b)) {
    const sortedTasks = [...rowTasks].sort((a, b) => a.start_date.localeCompare(b.start_date))
    const recurrenceIds = new Set(sortedTasks.filter(t => t.recurrence_id).map(t => t.recurrence_id!))
    // isRecurring = all tasks in this row share exactly one recurrence_id
    const isRecurring = recurrenceIds.size === 1 && sortedTasks.every(t => t.recurrence_id)
    const title = (sortedTasks.length === 1 || isRecurring) ? sortedTasks[0].title : ''
    rows.push({ rowIndex: rows.length, tasks: sortedTasks, isRecurring, title })
  }

  return rows
}


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
  const [showTemplates, setShowTemplates] = useState(false)
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 640)
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set())
  const [deletingSubjectId, setDeletingSubjectId] = useState<string | null>(null)
  const [quickMenu, setQuickMenu] = useState<{ task: Task; x: number; y: number } | null>(null)
  const [hoveredSubjectId, setHoveredSubjectId] = useState<string | null>(null)
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

  // ---- Scroll to today ----
  const scrollToToday = useCallback(() => {
    if (scrollRef.current && todayIdx >= 0) {
      const target = todayIdx * COL_WIDTH - scrollRef.current.clientWidth / 2 + COL_WIDTH / 2
      scrollRef.current.scrollTo({ left: Math.max(0, target), behavior: 'smooth' })
    }
  }, [todayIdx, COL_WIDTH])

  useEffect(() => {
    if (scrollRef.current && todayIdx >= 0) {
      const target = todayIdx * COL_WIDTH - scrollRef.current.clientWidth / 2 + COL_WIDTH / 2
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
  const rowMatchesFocus = useCallback((row: SubjectRow): boolean => {
    return row.tasks.some(t => t.start_date <= focusCutoffStr && t.due_date >= todayStr)
  }, [todayStr, focusCutoffStr])

  const grouped: GroupedSubject[] = subjects
    .map(subject => {
      const allRows = buildSubjectRows(tasks.filter(t => t.subject_id === subject.id))
      let subjectRows = allRows

      // Apply status filter
      if (isFiltering) {
        subjectRows = subjectRows
          .map(row => ({
            ...row,
            tasks: row.tasks.filter(t => taskMatchesFilter(t, selectedStatuses, todayStr)),
          }))
          .filter(row => row.tasks.length > 0)
      }

      // Apply focus filter
      if (viewRange !== 'all') {
        subjectRows = subjectRows.filter(row => rowMatchesFocus(row))
      }

      return { subject, subjectRows }
    })
    .filter(g => g.subjectRows.length > 0)

  const filteredTotal = grouped.reduce(
    (sum, g) => sum + g.subjectRows.reduce((s, r) => s + r.tasks.length, 0), 0
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
    const cfg = isOverdue(task) ? STATUS_CONFIG.overdue : STATUS_CONFIG[task.status]
    const color = isDark ? cfg.darkColor : cfg.color
    const bg    = isDark ? cfg.darkBg    : cfg.bg
    return { left: startI * COL_WIDTH, width: Math.max((endI - startI + 1) * COL_WIDTH, COL_WIDTH), color, bg }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100svh', background: 'var(--bg)' }}>

      {/* ---- Brand header ---- */}
      <header style={{
        height: 52,
        background: 'linear-gradient(135deg, #2f2963 0%, #454372 100%)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        boxShadow: '0 2px 12px rgba(28,22,60,0.45)',
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
          <img
            src="/river-icon.png"
            width={30}
            height={30}
            alt="River"
            style={{ borderRadius: 8, objectFit: 'cover', flexShrink: 0, boxShadow: '0 3px 10px rgba(112,135,127,0.35)' }}
          />
          <span style={{ fontSize: 17, fontWeight: 700, color: '#ffffff', letterSpacing: '-0.04em', flexShrink: 0 }}>
            River
          </span>
          <div style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.18)', marginLeft: 2, flexShrink: 0 }} />
          <span style={{
            fontSize: 12,
            color: 'rgba(255,255,255,0.55)',
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
            color: 'rgba(255,255,255,0.4)',
            fontWeight: 500,
            letterSpacing: '0.02em',
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 4,
            padding: '1px 5px',
            flexShrink: 0,
          }}>
            v{__APP_VERSION__}
          </span>
        </div>

        {/* Template library button */}
        <button
          onClick={() => setShowTemplates(true)}
          aria-label="テンプレート"
          title="テンプレート"
          style={{
            background: 'rgba(255,255,255,0.07)',
            color: 'rgba(255,255,255,0.85)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 8,
            padding: isMobile ? '7px 8px' : '7px 13px',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            letterSpacing: '-0.02em',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            flexShrink: 0,
            fontFamily: 'inherit',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.14)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)' }}
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            <rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5"/>
            <rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5"/>
            <rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5"/>
            <rect x="9" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5"/>
          </svg>
          {!isMobile && 'テンプレート'}
        </button>

        {/* Add task button */}
        <button
          onClick={() => setAddModalSubjectId('')}
          aria-label="課題を追加 (N)"
          title="課題を追加 [N]"
          style={{
            background: 'linear-gradient(135deg, #ef946c 0%, #d4794f 100%)',
            color: '#ffffff',
            border: 'none',
            borderRadius: 8,
            padding: isMobile ? '7px 10px' : '7px 15px',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            letterSpacing: '-0.02em',
            boxShadow: '0 3px 10px rgba(239,148,108,0.35)',
            transition: 'all 0.25s',
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            flexShrink: 0,
            fontFamily: 'inherit',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.boxShadow = '0 5px 16px rgba(239,148,108,0.48)'
            e.currentTarget.style.transform = 'translateY(-1px)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.boxShadow = '0 3px 10px rgba(239,148,108,0.35)'
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
            background: 'rgba(255,255,255,0.07)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 7,
            padding: isMobile ? '6px 8px' : '6px 10px',
            fontSize: 15,
            cursor: 'pointer',
            color: 'rgba(255,255,255,0.75)',
            transition: 'all 0.2s',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            lineHeight: 1,
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.14)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)' }}
        >
          <img
            src={isDark ? '/sun.png' : '/moon.png'}
            width={17}
            height={17}
            alt={isDark ? 'ライトモード' : 'ダークモード'}
            style={{ display: 'block', filter: 'brightness(0) invert(1)', opacity: 0.75 }}
          />
        </button>

        {/* Logout */}
        <button
          onClick={() => signOut()}
          aria-label="ログアウト"
          style={{
            background: 'rgba(255,255,255,0.07)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 7,
            padding: isMobile ? '6px 8px' : '6px 11px',
            fontSize: 12,
            fontWeight: 500,
            cursor: 'pointer',
            color: 'rgba(255,255,255,0.75)',
            transition: 'all 0.2s',
            flexShrink: 0,
            fontFamily: 'inherit',
            letterSpacing: '-0.01em',
            display: 'flex',
            alignItems: 'center',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.14)'
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.07)'
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'
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
            e.currentTarget.style.background = 'rgba(112,135,127,0.1)'
            e.currentTarget.style.borderColor = 'rgba(112,135,127,0.35)'
            e.currentTarget.style.color = '#70877f'
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
          const activeBg    = isDark ? 'rgba(196,167,125,0.18)' : 'rgba(196,167,125,0.12)'
          const activeColor = '#c4a77d'
          return (
            <button
              key={opt.key}
              onClick={() => setViewRange(opt.key)}
              style={{
                background: active ? activeBg : 'transparent',
                color: active ? activeColor : 'var(--text-secondary)',
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
                boxShadow: active ? '0 2px 8px rgba(196,167,125,0.25)' : 'none',
              }}
              onMouseEnter={e => {
                if (!active) {
                  e.currentTarget.style.background = activeBg
                  e.currentTarget.style.borderColor = 'rgba(196,167,125,0.35)'
                  e.currentTarget.style.color = activeColor
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
          const pillColor = isDark ? cfg.darkColor : cfg.color
          const pillBg    = isDark ? cfg.darkBg    : cfg.bg
          return (
            <button
              key={pill.key}
              onClick={() => toggleStatus(pill.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                background: isActive ? pillBg : 'transparent',
                color: isActive ? pillColor : 'var(--text-secondary)',
                border: `1px solid ${isActive ? pillColor + '44' : 'var(--border)'}`,
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
                boxShadow: isActive ? `0 2px 8px ${pillColor}22` : 'none',
              }}
              onMouseEnter={e => {
                if (!isActive) {
                  e.currentTarget.style.background = pillBg
                  e.currentTarget.style.borderColor = pillColor + '33'
                  e.currentTarget.style.color = pillColor
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
                background: pillColor,
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
        <div style={{ width: days.length * COL_WIDTH, minHeight: '100%' }}>

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
                      ? 'rgba(59,130,246,0.08)'
                      : (isSun || isSat)
                      ? 'rgba(20,16,10,0.015)'
                      : 'transparent',
                    borderRight: '1px solid rgba(20,16,10,0.04)',
                    position: 'relative',
                  }}
                >
                  <span style={{
                    fontSize: 9,
                    fontWeight: (isFirst || i === 0) ? 700 : 600,
                    color: (isFirst || i === 0)
                      ? 'var(--text-secondary)'
                      : isSun ? '#DC2626'
                      : isSat ? '#c4a77d'
                      : 'var(--text-disabled)',
                    letterSpacing: (isFirst || i === 0) ? '0.04em' : '0.02em',
                    whiteSpace: 'nowrap',
                  }}>
                    {(isFirst || i === 0) ? `${day.getMonth() + 1}月` : DAY_JA[dow]}
                  </span>
                  <div style={{
                    width: isToday ? 26 : 24,
                    height: isToday ? 26 : 24,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '50%',
                    background: isToday ? '#70877f' : 'transparent',
                    boxShadow: isToday ? '0 2px 10px rgba(112,135,127,0.48), 0 0 0 2px rgba(112,135,127,0.18)' : 'none',
                    fontSize: isToday ? 12 : 11,
                    fontWeight: isToday ? 800 : 400,
                    color: isToday ? '#ffffff' : isSun ? '#DC2626' : isSat ? '#c4a77d' : 'var(--text-secondary)',
                    letterSpacing: '-0.02em',
                    transition: 'all 0.2s',
                  }}>
                    {day.getDate()}
                  </div>
                </div>
              )
            })}
          </div>

          {/* ---- Subject groups ---- */}
          {loading && subjects.length === 0 ? (
            /* Skeleton loader while fetching */
            <>
              <style>{`@keyframes skPulse2{0%,100%{opacity:1}50%{opacity:.35}}`}</style>
              {[36, 52, 52, 52, 36, 52, 52].map((h, i) => (
                <div key={i} style={{ display: 'flex', height: h, borderBottom: '1px solid var(--border-light)', background: h === 36 ? 'var(--bg-secondary)' : 'var(--surface)', position: 'relative' }}>
                  <div style={{ flex: 1, position: 'relative', background: h === 36 ? 'var(--bg-secondary)' : 'var(--surface)', display: 'flex', alignItems: 'center', padding: '0 16px' }}>
                    <div style={{ width: h === 36 ? 52 : 120 + (i % 3) * 50, height: h === 36 ? 9 : 34, borderRadius: h === 36 ? 5 : 6, background: 'var(--border)', animation: `skPulse2 1.5s ease-in-out ${i * 0.08}s infinite` }} />
                  </div>
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
                      background: 'rgba(196,167,125,0.1)',
                      color: '#c4a77d',
                      border: '1px solid rgba(196,167,125,0.35)',
                      borderRadius: 9999,
                      padding: '6px 18px',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      letterSpacing: '-0.01em',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(196,167,125,0.2)'; e.currentTarget.style.borderColor = 'rgba(196,167,125,0.55)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(196,167,125,0.1)'; e.currentTarget.style.borderColor = 'rgba(196,167,125,0.35)' }}
                  >
                    「すべて」に切り替える
                  </button>
                )}
              </div>
            </div>
          ) : (
            grouped.map(({ subject, subjectRows }) => {
              const collapsed = collapsedIds.has(subject.id)
              const isDeletingThis = deletingSubjectId === subject.id
              const isHovered = hoveredSubjectId === subject.id

              return (
                <div key={subject.id}>
                  {/* Subject separator row — full width, name sticky at left */}
                  <div
                    style={{
                      height: SUBJECT_SEP_HEIGHT,
                      borderTop: '1px solid var(--border-light)',
                      borderBottom: `1px solid ${subject.color}20`,
                      background: `linear-gradient(90deg, ${subject.color}18 0%, transparent 320px)`,
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                    onMouseEnter={() => setHoveredSubjectId(subject.id)}
                    onMouseLeave={() => setHoveredSubjectId(null)}
                  >
                    {/* Sticky name area — overlays timeline, stays at left edge during scroll */}
                    <div style={{
                      position: 'sticky',
                      left: 0,
                      zIndex: 15,
                      display: 'flex',
                      alignItems: 'center',
                      height: '100%',
                      background: `linear-gradient(90deg, var(--bg-secondary) 85%, transparent 100%)`,
                      paddingLeft: 0,
                      flexShrink: 0,
                    }}>
                      {/* Color stripe — クリックでカラーピッカー */}
                      <div
                        style={{
                          width: 6,
                          height: '100%',
                          background: subject.color,
                          flexShrink: 0,
                          borderRadius: '0 3px 3px 0',
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

                      {/* Collapse toggle + name (no truncation) */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '0 6px 0 8px',
                          cursor: 'pointer',
                          height: '100%',
                          userSelect: 'none',
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
                          style={{
                            fontSize: isMobile ? 10 : 11,
                            fontWeight: 700,
                            color: 'var(--text-secondary)',
                            letterSpacing: '-0.01em',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {subject.name}
                        </span>
                        {!collapsed && subjectRows.length > 0 && (
                          <span style={{
                            fontSize: 9,
                            color: 'var(--text-tertiary)',
                            background: 'var(--border-light)',
                            borderRadius: 9999,
                            padding: '1px 5px',
                            flexShrink: 0,
                            fontWeight: 700,
                          }}>
                            {subjectRows.reduce((s, r) => s + r.tasks.length, 0)}
                          </span>
                        )}
                      </div>

                      {/* Add button */}
                      {!isDeletingThis && (
                        <button
                          onClick={e => { e.stopPropagation(); setAddModalSubjectId(subject.id) }}
                          aria-label={`${subject.name}に課題を追加`}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '3px 4px',
                            display: 'flex',
                            alignItems: 'center',
                            flexShrink: 0,
                            opacity: isHovered ? 1 : 0,
                            transition: 'opacity 0.2s',
                            borderRadius: 4,
                          }}
                          title="この科目に課題を追加"
                        >
                          <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                            <path d="M6 1v10M1 6h10" stroke="#ef946c" strokeWidth="2" strokeLinecap="round"/>
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
                            padding: '3px 6px 3px 2px',
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 8px 0 2px', flexShrink: 0 }}>
                          <span style={{ fontSize: 9, color: '#DC2626', fontWeight: 700, whiteSpace: 'nowrap', letterSpacing: '-0.01em' }}>削除?</span>
                          <button
                            onClick={e => { e.stopPropagation(); handleDeleteSubject(subject.id) }}
                            style={{ background: '#DC2626', color: '#fff', border: 'none', borderRadius: 4, padding: '2px 7px', fontSize: 9, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
                          >はい</button>
                          <button
                            onClick={e => { e.stopPropagation(); setDeletingSubjectId(null) }}
                            style={{ background: 'var(--border-light)', color: 'var(--text-secondary)', border: 'none', borderRadius: 4, padding: '2px 7px', fontSize: 9, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                          >否</button>
                        </div>
                      )}
                    </div>

                    {/* 完了率バー — absolute right */}
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

                  {/* Task rows */}
                  {!collapsed && subjectRows.map(row => {
                    return (
                      <div
                        key={row.rowIndex}
                        style={{ height: ROW_HEIGHT, borderBottom: '1px solid var(--border-light)', position: 'relative', background: 'var(--surface)' }}
                      >
                        {/* Grid + bars */}
                        <div style={{ position: 'absolute', inset: 0 }}>
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
                                    ? 'rgba(59,130,246,0.08)'
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
                  {!collapsed && subjectRows.length === 0 && (
                    <div
                      style={{
                        height: ROW_HEIGHT,
                        borderBottom: '1px solid var(--border-light)',
                        background: 'var(--surface)',
                        display: 'flex',
                        alignItems: 'center',
                        paddingLeft: 20,
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

      {showTemplates && (
        <TemplateLibrary onClose={() => setShowTemplates(false)} />
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
