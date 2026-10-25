import { Fragment, useRef, useEffect, useState, useCallback, useMemo } from 'react'
import type { Subject, Task, TaskStatus } from '../../types'
import { STATUS_CONFIG, isOverdue, toDateString, parseLocalDate, withAlpha } from '../../types'
import TaskDetailPanel from '../task/TaskDetailPanel'
import AddTaskModal from '../task/AddTaskModal'
import InboxPanel from '../social/InboxPanel'
import PeoplePanel, { type PeopleTab } from '../social/PeoplePanel'
import ProfileView from '../social/ProfileView'
import PartyHome from '../social/PartyHome'
import LectureScreen from '../lecture/LectureScreen'
import AppNavigation, { type AppDestination } from './AppNavigation'
import { FilterMenuChip, MenuOption } from './FilterMenu'
import AccountSheet, { NewSemesterSheet, SemesterSwitcher } from './AccountSheet'
import SettingsSheet from '../settings/SettingsSheet'
import TaskQuickMenu from '../task/TaskQuickMenu'
import ReAddCard, { type ReAddTemplate } from '../task/ReAddCard'
import ColorPicker from '../ui/ColorPicker'
import { useStore } from '../../store/useStore'
import { useSocialStore } from '../../store/useSocialStore'
import { useToast } from '../ui/Toast'
import { Button, Chip, Fab, IconButton } from '../ui/m3'
import { EmptyState, Section } from '../ui/kit'
import Sheet from '../ui/Sheet'
import { BREAKPOINTS } from '../../theme/breakpoints'
import { semesterKey, semesterLabel, semesterRange, subjectInSemester } from '../../lib/semester'
import { describeNotification, notificationUserIds } from '../../lib/notificationText'

const COL_WIDTH_DESKTOP = 44
const COL_WIDTH_MOBILE = 36
const ROW_HEIGHT = 52
const HEADER_HEIGHT = 56
const SUBJECT_SEP_HEIGHT = 40

function getDays(start: Date, end: Date): Date[] {
  const days: Date[] = []
  const d = new Date(start)
  d.setHours(0, 0, 0, 0)
  while (d <= end) {
    days.push(new Date(d))
    d.setDate(d.getDate() + 1)
  }
  return days
}

function shiftDate(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

/** 学期の期間の前後に付ける余白（日） */
const RANGE_MARGIN_DAYS = 14

const DAY_JA = ['日', '月', '火', '水', '木', '金', '土']


type EffectiveStatus = 'todo' | 'in_progress' | 'done' | 'submitted' | 'overdue'

/** 文字の役割（tokens.css の M3 type scale）をインラインスタイルで使う */
const typeRole = (role: string): React.CSSProperties => ({
  fontSize: `var(--type-${role}-size)`,
  lineHeight: `var(--type-${role}-line)`,
  fontWeight: `var(--type-${role}-weight)`,
  letterSpacing: `var(--type-${role}-tracking)`,
})

/** 表の線・土日・今日の列の色。文字色を薄く混ぜるので、ライト/ダークどちらでもそのまま合う */
const gridLine = 'color-mix(in srgb, var(--text-primary) 7%, transparent)'
const weekendColumn = 'color-mix(in srgb, var(--text-primary) 4%, transparent)'
const todayColumn = 'color-mix(in srgb, var(--accent) 14%, transparent)'

/** 講義の行の小さいアイコンボタン（見た目 32px・押せる範囲は 48px） */
const rowIconButton: React.CSSProperties = { width: 32, height: 32, marginLeft: 'var(--space-1)' }

/** 絞り込みバーの区切り線 */
const filterDivider: React.CSSProperties = { width: 1, height: 24, background: 'var(--border)', flexShrink: 0 }

/** 「今日」チップのアイコン */
const todayIcon = (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
    <circle cx="9" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.6" />
    <circle cx="9" cy="9" r="1.8" fill="currentColor" />
  </svg>
)

/** 絞り込みバーのチップのアイコン（並べ替え・期間・ステータス） */
const sortIcon = (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
    <path d="M3 5h12M3 9h8M3 13h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
)
const rangeIcon = (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
    <rect x="2.5" y="3.5" width="13" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
    <path d="M2.5 7.5h13M6 2v3M12 2v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
)
const statusIcon = (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
    <path d="M2.5 4.5h13l-5 6v4l-3 1.5v-5.5l-5-6Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
  </svg>
)

const LECTURE_SORT_OPTIONS = [
  { key: 'due',    label: '期限が近い順', description: 'まだ終わっていない課題の締切が近い講義から並べます' },
  { key: 'custom', label: '自分の順', description: '講義の左のつまみをドラッグして順番を入れ替えられます' },
] as const

const VIEW_RANGE_OPTIONS = [
  { key: 'all',   label: 'すべての期間' },
  { key: 'week',  label: '今週' },
  { key: 'month', label: '今月' },
] as const

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

/** 講義の並べ方: 'custom'=自分で決めた順（ドラッグで入れ替え）, 'due'=期限が近い順 */
type LectureSort = 'custom' | 'due'

const LECTURE_SORT_STORAGE_KEY = 'river:lecture-sort'

/** 既定は期限が近い順（自分の順に切り替えた人だけ、その選択を覚えておく） */
function readStoredLectureSort(): LectureSort {
  try { return localStorage.getItem(LECTURE_SORT_STORAGE_KEY) === 'custom' ? 'custom' : 'due' } catch { return 'due' }
}

function storeLectureSort(sort: LectureSort) {
  try { localStorage.setItem(LECTURE_SORT_STORAGE_KEY, sort) } catch { /* 保存できなくても表示は切り替える */ }
}

/**
 * 講義の「次の締切」。まだ終わっていない課題のうち、一番近い締切（時刻まで含めて比べる）。
 * 締切を過ぎてまだ終わっていない課題がいちばん急ぐので、それも含める（期限切れの講義が上に来る）。
 * 該当がなければ null（期限が近い順では後ろに回す）
 */
function nextDueKey(subjectTasks: Task[]): string | null {
  let min: string | null = null
  for (const t of subjectTasks) {
    if (t.status === 'done' || t.status === 'submitted') continue
    const key = `${t.due_date} ${t.due_time ?? '99:99'}`
    if (min === null || key < min) min = key
  }
  return min
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

// 再追加用: 元の締切と同じ曜日の「翌週」の日付を返す（週始まり=日曜）
function nextWeekSameWeekdayStr(origDueStr: string): string {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const origDow = parseLocalDate(origDueStr).getDay() // 0=日
  const d = new Date(today)
  d.setDate(today.getDate() + (7 - today.getDay()) + origDow) // 次の日曜 + 元の曜日
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
  const {
    subjects: allSubjects, tasks: allTasks, semester,
    fetchAll, updateSubject, reorderSubjects, updateTask, addTask, loading, isDark, toggleTheme, schoolName, userId,
  } = useStore()
  // 表示中の学期の講義・課題だけを扱う（学期 = Excel のシート）
  const subjects = useMemo(
    () => allSubjects.filter(s => subjectInSemester(s, semester)).sort((a, b) => a.order - b.order),
    [allSubjects, semester],
  )
  const tasks = useMemo(() => {
    const ids = new Set(subjects.map(s => s.id))
    return allTasks.filter(t => ids.has(t.subject_id))
  }, [allTasks, subjects])
  const { showToast } = useToast()
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [addModalSubjectId, setAddModalSubjectId] = useState<string | null>(null)
  /** 受信箱（返事が必要な申請・招待とお知らせ） */
  const [inboxOpen, setInboxOpen] = useState(false)
  /** 仲間（フレンド・パーティー）。開いているタブ */
  const [peopleTab, setPeopleTab] = useState<PeopleTab | null>(null)
  const [profileUserId, setProfileUserId] = useState<string | null>(null)
  const [partyId, setPartyId] = useState<string | null>(null)
  const [lectureId, setLectureId] = useState<string | null>(null)
  const fetchSocial = useSocialStore(s => s.fetchSocial)
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < BREAKPOINTS.medium)
  /** 840px 以上（M3 の expanded）。課題の詳細をタイムラインの右に並べる */
  const [isExpanded, setIsExpanded] = useState(() => window.innerWidth >= BREAKPOINTS.expanded)
  const [accountOpen, setAccountOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  /** スマホの並べ方・絞り込みのシート */
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false)
  const [newSemesterOpen, setNewSemesterOpen] = useState(false)
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set())
  const [quickMenu, setQuickMenu] = useState<{ task: Task; x: number; y: number } | null>(null)
  const [selectedStatuses, setSelectedStatuses] = useState<Set<EffectiveStatus>>(new Set())
  /** 表示範囲: 'week'=今週, 'month'=今月(30日), 'all'=すべて */
  const [viewRange, setViewRange] = useState<'week' | 'month' | 'all'>('all')
  const [lectureSort, setLectureSort] = useState<LectureSort>(readStoredLectureSort)
  const changeLectureSort = (sort: LectureSort) => {
    setLectureSort(sort)
    storeLectureSort(sort)
  }
  /** 講義のドラッグでの並べ替え中: 動かしている講義と、落とす位置（表示中の講義の何番目の前か） */
  const [lectureDrag, setLectureDrag] = useState<{ id: string; dropIndex: number } | null>(null)
  const lectureDragRef = useRef<{ id: string; dropIndex: number } | null>(null)
  const groupRefs = useRef(new Map<string, HTMLDivElement>())
  /** 科目カラーピッカー: subjectId */
  const [colorPickerSubjectId, setColorPickerSubjectId] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  /** スクロール領域の見えている大きさ（講義・課題がないときの案内を中央に置くため） */
  const [scrollViewport, setScrollViewport] = useState<{ width: number; height: number } | null>(null)
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const measure = () => setScrollViewport({ width: el.clientWidth, height: el.clientHeight })
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // ---- 再追加カード（課題の完了/期限切れ時に右下へ表示） ----
  const [reAdd, setReAdd] = useState<{ subjectId: string; reason: 'completed' | 'overdue' } | null>(null)
  const prevStatusRef = useRef<Map<string, TaskStatus> | null>(null)
  /** Shift+Rで再追加カードを強制表示する際、科目を順送りするためのインデックス */
  const reAddCycleRef = useRef(0)

  // ---- Drag state ----
  const dragRef = useRef<DragState | null>(null)
  const dragOverrideRef = useRef<{ id: string; start_date: string; due_date: string } | null>(null)
  const [dragOverride, setDragOverride] = useState<{ id: string; start_date: string; due_date: string } | null>(null)
  const wasDraggingRef = useRef(false)

  // 表示する日付: 学期の期間（前後に余白）。期間外の課題があればそこまで広げる
  const days = useMemo(() => {
    const range = semesterRange(semester)
    let start = shiftDate(range.start, -RANGE_MARGIN_DAYS)
    let end = shiftDate(range.end, RANGE_MARGIN_DAYS)
    for (const t of tasks) {
      const s = shiftDate(parseLocalDate(t.start_date), -7)
      const e = shiftDate(parseLocalDate(t.due_date), 7)
      if (s < start) start = s
      if (e > end) end = e
    }
    return getDays(start, end)
  }, [semester, tasks])
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

  // 読み込みに失敗したときは、黙って空の画面にせずトーストで知らせる
  const loadError = useStore(s => s.error)
  useEffect(() => {
    if (loadError) showToast(`読み込みに失敗しました：${loadError}`, 'error')
  }, [loadError, showToast])

  // 通知・申請・フレンド・パーティーの変化をリアルタイムで反映する（再読み込み不要）。
  // 新しい通知はトーストでも知らせる。接続が切れていた間の分は、画面に戻ったときと5分ごとに読み直して補う
  const subscribeRealtime = useSocialStore(s => s.subscribeRealtime)
  useEffect(() => {
    void fetchSocial()
    const stop = subscribeRealtime(n => {
      void (async () => {
        await useSocialStore.getState().ensureUsers(notificationUserIds(n))
        const { users } = useSocialStore.getState()
        showToast(describeNotification(n, users, useStore.getState().subjects), 'info')
      })()
    })
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      void fetchSocial()
      void useStore.getState().fetchAll({ silent: true })
    }
    document.addEventListener('visibilitychange', onVisible)
    const id = window.setInterval(() => { void fetchSocial() }, 5 * 60_000)
    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVisible)
      window.clearInterval(id)
    }
  }, [fetchSocial, subscribeRealtime, showToast])

  // 課題・講義・進捗の変化をリアルタイムで反映する。参加する講義が変わったら購読し直す
  const subscribeLectures = useStore(s => s.subscribeRealtime)
  const lectureIdsKey = allSubjects.map(s => s.id).sort().join(',')
  useEffect(() => subscribeLectures(), [subscribeLectures, lectureIdsKey])

  // 再追加カードのトリガー: 初回ロード時に期限切れをチェック、以降は完了への遷移を検知
  useEffect(() => {
    const prev = prevStatusRef.current
    if (prev === null) {
      // 初回: 期限切れ課題があればその科目を提案
      const overdueTask = tasks.find(t => isOverdue(t))
      if (overdueTask) setReAdd({ subjectId: overdueTask.subject_id, reason: 'overdue' })
    } else {
      // 以降: 未完了→完了/提出済み への遷移を検知
      for (const t of tasks) {
        const before = prev.get(t.id)
        const beforeDone = before === 'done' || before === 'submitted'
        const nowDone = t.status === 'done' || t.status === 'submitted'
        if (before !== undefined && nowDone && !beforeDone) {
          setReAdd({ subjectId: t.subject_id, reason: 'completed' })
          break
        }
      }
    }
    const next = new Map<string, TaskStatus>()
    for (const t of tasks) next.set(t.id, t.status)
    prevStatusRef.current = next
  }, [tasks])

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < BREAKPOINTS.medium)
      setIsExpanded(window.innerWidth >= BREAKPOINTS.expanded)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    const root = document.documentElement.style
    root.setProperty('--bottom-bar-height', isMobile ? 'calc(80px + env(safe-area-inset-bottom))' : '0px')
    // スマホは右下に FAB（56px）があるので、そのぶん上に出す
    root.setProperty('--fab-clearance', isMobile ? '72px' : '0px')
    return () => { root.removeProperty('--bottom-bar-height'); root.removeProperty('--fab-clearance') }
  }, [isMobile])

  /** ナビゲーションで選ばれている行き先（開いている画面から決める） */
  const activeDestination: AppDestination = inboxOpen ? 'inbox' : peopleTab ? 'people' : accountOpen ? 'me' : 'timeline'
  const selectDestination = (key: AppDestination) => {
    setInboxOpen(key === 'inbox')
    setPeopleTab(key === 'people' ? 'friends' : null)
    setAccountOpen(key === 'me')
  }

  const COL_WIDTH = isMobile ? COL_WIDTH_MOBILE : COL_WIDTH_DESKTOP

  // 見えている範囲の真ん中の日（日付の見出しには毎月1日にしか月が出ないので、今何月を見ているかを別に出す）
  const [viewCenterIndex, setViewCenterIndex] = useState<number | null>(null)
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    let frame = 0
    const update = () => {
      frame = 0
      setViewCenterIndex(Math.floor((el.scrollLeft + el.clientWidth / 2) / COL_WIDTH))
    }
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update) }
    update()
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => { el.removeEventListener('scroll', onScroll); if (frame) cancelAnimationFrame(frame) }
  }, [COL_WIDTH])
  const viewMonthDay = viewCenterIndex !== null ? days[Math.min(Math.max(viewCenterIndex, 0), days.length - 1)] : undefined
  const viewMonthLabel = viewMonthDay ? `${viewMonthDay.getFullYear()}年${viewMonthDay.getMonth() + 1}月` : null

  // ---- Scroll to today ----
  const scrollToToday = useCallback(() => {
    if (scrollRef.current && todayIdx >= 0) {
      const target = todayIdx * COL_WIDTH - scrollRef.current.clientWidth / 2 + COL_WIDTH / 2
      scrollRef.current.scrollTo({ left: Math.max(0, target), behavior: 'smooth' })
    }
  }, [todayIdx, COL_WIDTH])

  // 初回表示と学期の切り替え時: 今日が学期内なら今日へ、そうでなければ学期の最初の課題へスクロールする
  const currentSemesterKey = semesterKey(semester)
  const scrolledSemesterRef = useRef<string | null>(null)
  /** 最初の読み込みが始まったか（読み込み前に表示位置を決めないようにする） */
  const loadStartedRef = useRef(false)
  useEffect(() => {
    if (loading) { loadStartedRef.current = true; return }
    const el = scrollRef.current
    if (!el || !loadStartedRef.current || scrolledSemesterRef.current === currentSemesterKey) return
    scrolledSemesterRef.current = currentSemesterKey
    let idx = todayIdx
    if (idx < 0) {
      const first = tasks.reduce<string | null>((min, t) => (min === null || t.start_date < min ? t.start_date : min), null)
      idx = first ? days.findIndex(d => toDateString(d) === first) : RANGE_MARGIN_DAYS
    }
    const target = idx * COL_WIDTH - el.clientWidth / 2 + COL_WIDTH / 2
    el.scrollLeft = Math.max(0, target)
  }, [currentSemesterKey, todayIdx, tasks, days, loading, COL_WIDTH])

  // Keyboard shortcuts: N = new task, T = scroll to today, D = dark mode
  // Shift+R = 再追加カードを強制表示（科目を順送り）。本番環境でも有効。
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
      } else if (e.shiftKey && (e.key === 'r' || e.key === 'R')) {
        // Shift+R: 再追加カードを強制表示（課題を持つ科目を順送り）
        e.preventDefault()
        const candidates = subjects.filter(s => tasks.some(t => t.subject_id === s.id))
        if (candidates.length === 0) return
        const subject = candidates[reAddCycleRef.current % candidates.length]
        reAddCycleRef.current += 1
        setReAdd({ subjectId: subject.id, reason: 'completed' })
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [scrollToToday, subjects, tasks])

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

  // 講義をドラッグしている間は、画面全体を「つかんでいる」カーソルにして文字の選択を止める
  const isLectureDragging = lectureDrag !== null
  useEffect(() => {
    if (!isLectureDragging) return
    const body = document.body.style
    body.cursor = 'grabbing'
    body.userSelect = 'none'
    return () => { body.cursor = ''; body.userSelect = '' }
  }, [isLectureDragging])

  const toggleCollapse = useCallback((id: string) => {
    setCollapsedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const isFiltering = selectedStatuses.size > 0
  // ステータスのチップの文字: 2 つまでは名前を並べ、3 つ以上は数だけ出す
  const selectedStatusLabels = STATUS_PILLS.filter(p => selectedStatuses.has(p.key)).map(p => p.label)
  const statusChipLabel = selectedStatusLabels.length === 0 ? 'ステータス'
    : selectedStatusLabels.length <= 2 ? selectedStatusLabels.join('・')
    : `ステータス ${selectedStatusLabels.length}つ`

  /** A row matches focus if any of its tasks overlaps with [today, today+30]
   *  (already started but not yet due, OR starting within the next 30 days) */
  const rowMatchesFocus = useCallback((row: SubjectRow): boolean => {
    return row.tasks.some(t => t.start_date <= focusCutoffStr && t.due_date >= todayStr)
  }, [todayStr, focusCutoffStr])

  // 並べ方を反映した講義の順（期限が近い順でも、次の締切が同じなら自分の順を保つ）
  const sortedSubjects = useMemo(() => {
    if (lectureSort === 'custom') return subjects
    const keys = new Map(subjects.map(s => [s.id, nextDueKey(tasks.filter(t => t.subject_id === s.id))]))
    return [...subjects].sort((a, b) => {
      const ka = keys.get(a.id) ?? null
      const kb = keys.get(b.id) ?? null
      if (ka === kb) return 0
      if (ka === null) return 1
      if (kb === null) return -1
      return ka < kb ? -1 : 1
    })
  }, [lectureSort, subjects, tasks])

  const grouped: GroupedSubject[] = sortedSubjects
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

  /**
   * 表示中の講義を from 番目から「to 番目の前」へ動かし、並び順を保存する。
   * 絞り込みで隠れている講義は、今の位置関係を保ったまま残す。
   * 期限が近い順で動かしたときは、今見えている順を自分の順として保存し、自分の順に切り替える
   */
  const moveLecture = async (id: string, to: number) => {
    const shown = grouped.map(g => g.subject.id)
    const from = shown.indexOf(id)
    if (from < 0 || to < 0 || to > shown.length || to === from || to === from + 1) return
    const nextShown = shown.filter(s => s !== id)
    const insertAt = to > from ? to - 1 : to
    nextShown.splice(insertAt, 0, id)

    const all = sortedSubjects.map(s => s.id).filter(s => s !== id)
    const after = nextShown[insertAt + 1]
    if (after) all.splice(all.indexOf(after), 0, id)
    else all.splice(all.indexOf(nextShown[insertAt - 1]) + 1, 0, id)

    if (lectureSort !== 'custom') {
      changeLectureSort('custom')
      showToast('並べ替えを「自分の順」に切り替えました')
    }
    try {
      await reorderSubjects(all)
    } catch (e: unknown) {
      showToast(`並べ替えを保存できませんでした：${(e as Error).message}`, 'error')
    }
  }

  // ---- 講義のドラッグ（つまみを押したまま上下に動かす。マウス・タッチ・ペン共通） ----
  const handleLecturePointerDown = (e: React.PointerEvent<HTMLElement>, id: string) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    const state = { id, dropIndex: grouped.findIndex(g => g.subject.id === id) }
    lectureDragRef.current = state
    setLectureDrag(state)
  }

  const handleLecturePointerMove = (e: React.PointerEvent<HTMLElement>) => {
    const drag = lectureDragRef.current
    if (!drag) return
    // 各講義の中央より上にいれば、その講義の前に落とす
    let dropIndex = grouped.length
    for (let i = 0; i < grouped.length; i++) {
      const rect = groupRefs.current.get(grouped[i].subject.id)?.getBoundingClientRect()
      if (rect && e.clientY < rect.top + rect.height / 2) { dropIndex = i; break }
    }
    // 上下の端に近づいたら自動でスクロールする
    const area = scrollRef.current
    if (area) {
      const r = area.getBoundingClientRect()
      if (e.clientY < r.top + HEADER_HEIGHT + 32) area.scrollBy({ top: -16 })
      else if (e.clientY > r.bottom - 32) area.scrollBy({ top: 16 })
    }
    if (dropIndex !== drag.dropIndex) {
      const next = { ...drag, dropIndex }
      lectureDragRef.current = next
      setLectureDrag(next)
    }
  }

  const endLectureDrag = (commit: boolean) => {
    const drag = lectureDragRef.current
    lectureDragRef.current = null
    setLectureDrag(null)
    if (commit && drag) void moveLecture(drag.id, drag.dropIndex)
  }

  // つまみにフォーカスして ↑↓ キーでも 1 つずつ動かせる
  const handleLectureHandleKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
    e.preventDefault()
    const from = grouped.findIndex(g => g.subject.id === id)
    void moveLecture(id, e.key === 'ArrowUp' ? from - 1 : from + 2)
  }

  const filteredTotal = grouped.reduce(
    (sum, g) => sum + g.subjectRows.reduce((s, r) => s + r.tasks.length, 0), 0
  )

  const toggleStatus = (key: EffectiveStatus) => {
    setSelectedStatuses(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const handleBarClick = (e: React.MouseEvent, task: Task) => {
    e.stopPropagation()
    setQuickMenu({ task, x: e.clientX, y: e.clientY })
  }

  // 再追加カード: 対象科目と、その科目の過去課題（タイトル重複を除き最新5件）をテンプレ化
  const reAddSubject = reAdd ? subjects.find(s => s.id === reAdd.subjectId) ?? null : null
  const reAddTemplates: ReAddTemplate[] = (() => {
    if (!reAdd) return []
    const seen = new Set<string>()
    return tasks
      .filter(t => t.subject_id === reAdd.subjectId)
      .sort((a, b) => b.due_date.localeCompare(a.due_date))
      .filter(t => { const k = t.title.trim(); if (seen.has(k)) return false; seen.add(k); return true })
      .slice(0, 5)
      .map(t => ({ key: t.id, title: t.title, dueTime: t.due_time, nextDue: nextWeekSameWeekdayStr(t.due_date) }))
  })()

  // 過去課題をワンタップで再追加（開始=今日 / 締切=翌週の同じ曜日 / 時刻は引き継ぎ）
  const handleReAdd = async (t: ReAddTemplate) => {
    if (!reAdd) return
    setReAdd(null)
    try {
      await addTask({
        subject_id: reAdd.subjectId,
        title: t.title,
        start_date: todayStr,
        due_date: t.nextDue,
        due_time: t.dueTime,
        status: 'todo',
        memo: null,
      })
      showToast(`「${t.title}」を追加しました（締切 ${t.nextDue.slice(5).replace('-', '/')}）`)
    } catch (e: unknown) {
      showToast((e as Error).message, 'error')
    }
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

  // 並べ方・期間・ステータスの選択肢（パソコンはチップのメニュー、スマホは下から出るシートで同じものを使う）
  const sortOptions = (after?: () => void) => LECTURE_SORT_OPTIONS.map(opt => (
    <MenuOption key={opt.key} checked={lectureSort === opt.key} description={opt.description} onSelect={() => { changeLectureSort(opt.key); after?.() }}>
      {opt.label}
    </MenuOption>
  ))
  const rangeOptions = (after?: () => void) => VIEW_RANGE_OPTIONS.map(opt => (
    <MenuOption key={opt.key} checked={viewRange === opt.key} onSelect={() => { setViewRange(opt.key); after?.() }}>
      {opt.label}
    </MenuOption>
  ))
  const statusOptions = () => STATUS_PILLS.map(pill => (
    <MenuOption
      key={pill.key}
      multi
      checked={selectedStatuses.has(pill.key)}
      onSelect={() => toggleStatus(pill.key)}
      leading={<span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 'var(--shape-full)', background: STATUS_CONFIG[pill.key].color, flexShrink: 0 }} />}
    >
      {pill.label}
    </MenuOption>
  ))
  /** 既定から変えている並べ方・絞り込みの数（スマホの「絞り込み」チップに出す） */
  const changedFilterCount = (lectureSort !== 'due' ? 1 : 0) + (viewRange !== 'all' ? 1 : 0) + (isFiltering ? 1 : 0)

  return (
    <div style={{ display: 'flex', height: '100svh', background: 'var(--bg)' }}>
      {!isMobile && (
        <AppNavigation
          variant="rail" active={activeDestination} onSelect={selectDestination} onAdd={() => setAddModalSubjectId('')}
          onOpenSettings={() => { setAccountOpen(false); setSettingsOpen(true) }} settingsOpen={settingsOpen}
        />
      )}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>

      {/* ---- Brand header（M3 の top app bar: 高さ 64px） ---- */}
      <header style={{
        height: 64,
        background: 'linear-gradient(135deg, var(--brand-deep) 0%, var(--brand-header) 100%)',
        boxShadow: 'var(--elevation-1)',
        display: 'flex',
        alignItems: 'center',
        padding: isMobile ? '0 var(--space-4)' : '0 var(--space-6)',
        gap: 'var(--space-3)',
        flexShrink: 0,
        position: 'relative',
        zIndex: 100,
      }}>

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flex: 1, minWidth: 0 }}>
          <img
            src="/river-icon.png"
            width={32}
            height={32}
            alt=""
            style={{ borderRadius: 'var(--shape-sm)', objectFit: 'cover', flexShrink: 0 }}
          />
          <h1 style={{
            margin: 0, flexShrink: 0, color: 'var(--on-brand)',
            fontSize: 'var(--type-title-large-size)', lineHeight: 'var(--type-title-large-line)',
            fontWeight: 'var(--type-weight-emphasized)', letterSpacing: 'var(--type-title-large-tracking)',
          }}>
            River
          </h1>
          <span
            style={{
              fontSize: 'var(--type-body-small-size)',
              lineHeight: 'var(--type-body-small-line)',
              color: 'color-mix(in srgb, var(--on-brand) 80%, transparent)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              minWidth: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-1)',
              paddingLeft: 'var(--space-2)',
              borderLeft: '1px solid color-mix(in srgb, var(--on-brand) 28%, transparent)',
            }}
            title={schoolName ?? '課題タイムライン'}
          >
            {schoolName ? (
              <>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, opacity: 0.75 }} aria-hidden="true">
                  <path d="M8 2L15 5.5L8 9L1 5.5L8 2Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
                  <path d="M4 7v3.5c0 .8 1.8 1.5 4 1.5s4-.7 4-1.5V7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                </svg>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{schoolName}</span>
              </>
            ) : '課題タイムライン'}
          </span>
          {/* バージョンはスマホでは場所を取るので出さない */}
          {!isMobile && (
            <span style={{
              fontSize: 'var(--type-label-small-size)',
              lineHeight: 'var(--type-label-small-line)',
              color: 'color-mix(in srgb, var(--on-brand) 70%, transparent)',
              background: 'color-mix(in srgb, var(--on-brand) 10%, transparent)',
              borderRadius: 'var(--shape-full)',
              padding: '0 var(--space-2)',
              flexShrink: 0,
            }}>
              v{__APP_VERSION__}
            </span>
          )}
          {/* 学期（押すと一覧が開き、その場で切り替えられる） */}
          <SemesterSwitcher compact={isMobile} onCreate={() => setNewSemesterOpen(true)} />
        </div>

      </header>

      {/* ---- Filter bar（チップを並べる。高さ 56px・横にスクロールできる） ---- */}
      <div className="no-scrollbar" style={{
        height: 56,
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 var(--space-4)',
        gap: 'var(--space-2)',
        flexShrink: 0,
        background: 'var(--filter-glass)',
        position: 'relative',
        zIndex: 99,
        overflowX: 'auto',
      }}>
        <Chip icon={todayIcon} onClick={scrollToToday} title="今日にスクロール [T]">今日</Chip>

        <div style={filterDivider} />

        {/* スマホ: チップを横に並べると画面の外に隠れて押せないので、「絞り込み」1つから下のシートを開く */}
        {isMobile && (
          <Chip
            selected={changedFilterCount > 0}
            icon={statusIcon}
            aria-haspopup="dialog"
            onClick={() => setMobileFilterOpen(true)}
            style={{ whiteSpace: 'nowrap' }}
          >
            {changedFilterCount > 0 ? `並べ方・絞り込み（${changedFilterCount}）` : '並べ方・絞り込み'}
          </Chip>
        )}

        {/* 講義の並べ方（どれか 1 つ） */}
        {!isMobile && <FilterMenuChip
          label={LECTURE_SORT_OPTIONS.find(o => o.key === lectureSort)!.label}
          active={lectureSort !== 'due'}
          icon={sortIcon}
          menuLabel="講義の並べ方"
          width={300}
        >
          {close => sortOptions(close)}
        </FilterMenuChip>}

        {/* 表示する期間（どれか 1 つ） */}
        {!isMobile && <FilterMenuChip
          label={VIEW_RANGE_OPTIONS.find(o => o.key === viewRange)!.label}
          active={viewRange !== 'all'}
          icon={rangeIcon}
          menuLabel="表示する期間"
        >
          {close => rangeOptions(close)}
        </FilterMenuChip>}

        {/* ステータス（複数選べる。選んでもメニューは開いたまま） */}
        {!isMobile && <FilterMenuChip
          label={statusChipLabel}
          active={isFiltering}
          icon={statusIcon}
          menuLabel="表示するステータス（複数選べます）"
        >
          {() => (
            <>
              {statusOptions()}
              {isFiltering && (
                <>
                  <div className="m3-menu__divider" />
                  <button type="button" role="menuitem" className="m3-menu-item m3-state" style={{ color: 'var(--accent-dark)' }}
                    onClick={() => setSelectedStatuses(new Set())}>
                    <span style={{ width: 20, flexShrink: 0 }} />
                    すべてのステータスを表示
                  </button>
                </>
              )}
            </>
          )}
        </FilterMenuChip>}

        {!isMobile && (isFiltering || viewRange !== 'all') && (
          <>
            <div style={filterDivider} />
            <span style={{
              fontSize: 'var(--type-label-large-size)', lineHeight: 'var(--type-label-large-line)',
              fontWeight: 'var(--type-label-large-weight)', color: 'var(--text-secondary)', flexShrink: 0,
            }}>
              {filteredTotal}件
            </span>
            <Button variant="text" size="xs" onClick={() => { setSelectedStatuses(new Set()); setViewRange('all') }}>
              絞り込みを解除
            </Button>
          </>
        )}
        {/* 今見ている年月（スマホは場所がないので出さない） */}
        {!isMobile && viewMonthLabel && (
          <span aria-live="polite" style={{
            marginLeft: 'auto', paddingLeft: 'var(--space-4)', flexShrink: 0, whiteSpace: 'nowrap',
            fontSize: 'var(--type-title-small-size)', lineHeight: 'var(--type-title-small-line)', fontWeight: 600, color: 'var(--text-secondary)',
          }}>
            {viewMonthLabel}
          </span>
        )}
      </div>

      {/* ---- Main scroll area（840px 以上では右に課題の詳細を並べる） ---- */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          minWidth: 0,
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
                    paddingBottom: 'var(--space-1)',
                    gap: 2,
                    background: isToday ? todayColumn : (isSun || isSat) ? weekendColumn : 'transparent',
                    borderRight: `1px solid ${gridLine}`,
                    position: 'relative',
                  }}
                >
                  <span style={{
                    ...typeRole('label-small'),
                    fontWeight: (isFirst || i === 0) ? 'var(--type-weight-emphasized)' : 'var(--type-label-small-weight)',
                    color: (isFirst || i === 0)
                      ? 'var(--text-primary)'
                      : isSun ? 'var(--danger)'
                      : isSat ? 'var(--saturday)'
                      : 'var(--text-tertiary)',
                    whiteSpace: 'nowrap',
                  }}>
                    {(isFirst || i === 0) ? `${day.getMonth() + 1}月` : DAY_JA[dow]}
                  </span>
                  <div style={{
                    width: 32,
                    height: 32,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 'var(--shape-full)',
                    background: isToday ? 'var(--accent-solid)' : 'transparent',
                    ...typeRole('label-large'),
                    fontWeight: isToday ? 'var(--type-weight-emphasized)' : 'var(--type-label-large-weight)',
                    color: isToday ? 'var(--on-accent)' : isSun ? 'var(--danger)' : isSat ? 'var(--saturday)' : 'var(--text-secondary)',
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
              position: 'sticky', left: 0,
              width: scrollViewport?.width ?? '100%',
              height: scrollViewport ? Math.max(0, scrollViewport.height - HEADER_HEIGHT) : undefined,
              // 真ん中だと下に寄って見えるので、下の余白を多くして少し上に置く
              boxSizing: 'border-box', padding: 'var(--space-8) var(--space-4)',
              paddingBottom: scrollViewport ? Math.round((scrollViewport.height - HEADER_HEIGHT) * 0.5) : undefined,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{ width: '100%', maxWidth: 560 }}>
              <EmptyState
                title={viewRange !== 'all'
                  ? `「${viewRange === 'week' ? '今週' : '今月'}」の課題がありません`
                  : subjects.length === 0 ? `${semesterLabel(semester)}の講義はまだありません` : '課題を追加してはじめましょう'}
                description={viewRange !== 'all'
                  ? '「すべて」に切り替えると全期間の課題が表示されます'
                  : subjects.length === 0
                    ? '右下の「＋」（課題を追加）から講義を作成できます。ほかの学期はメニューから切り替えられます'
                    : '右下の「＋」から追加できます [N]'}
                action={viewRange !== 'all' ? <Button variant="tonal" onClick={() => setViewRange('all')}>「すべて」に切り替える</Button> : undefined}
              />
              </div>
            </div>
          ) : (
            grouped.map(({ subject, subjectRows }, groupIdx) => {
              const collapsed = collapsedIds.has(subject.id)
              const isDraggingLecture = lectureDrag?.id === subject.id
              // 落とす位置の線（この講義の前、または最後の講義の後ろ）
              const dropBefore = lectureDrag !== null && lectureDrag.dropIndex === groupIdx
              const dropAfter = lectureDrag !== null && groupIdx === grouped.length - 1 && lectureDrag.dropIndex === grouped.length

              return (
                <div
                  key={subject.id}
                  ref={el => { if (el) groupRefs.current.set(subject.id, el); else groupRefs.current.delete(subject.id) }}
                  style={{
                    position: 'relative',
                    opacity: isDraggingLecture ? 0.5 : 1,
                    transition: 'opacity var(--motion-duration-short4) var(--motion-easing-standard)',
                  }}
                >
                  {(dropBefore || dropAfter) && (
                    <div aria-hidden="true" style={{
                      position: 'absolute', left: 0, right: 0, [dropBefore ? 'top' : 'bottom']: -2,
                      height: 4, borderRadius: 'var(--shape-full)', background: 'var(--accent-solid)',
                      zIndex: 30, pointerEvents: 'none',
                    }} />
                  )}
                  {/* Subject separator row — full width, name sticky at left */}
                  <div
                    style={{
                      height: SUBJECT_SEP_HEIGHT,
                      borderTop: '1px solid var(--border)',
                      borderBottom: `1px solid ${subject.color}20`,
                      background: `linear-gradient(90deg, ${subject.color}18 0%, transparent 320px)`,
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    {/* Sticky name area — overlays timeline, stays at left edge during scroll */}
                    {/* カラーピッカーを開いている間は、この科目のスタッキングコンテキストを
                        持ち上げて、下の科目セクションがパレットの下に回り込むようにする */}
                    <div style={{
                      position: 'sticky',
                      left: 0,
                      zIndex: colorPickerSubjectId === subject.id ? 200 : 15,
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
                          borderRadius: '0 var(--shape-xs) var(--shape-xs) 0',
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

                      {/* 並べ替えのつまみ（ドラッグ、またはフォーカスして ↑↓ キー） */}
                      <button
                        type="button"
                        aria-label={`${subject.name}の順番を入れ替える（ドラッグ、または ↑↓ キー）`}
                        title="ドラッグして順番を入れ替え"
                        className="m3-state"
                        onPointerDown={e => handleLecturePointerDown(e, subject.id)}
                        onPointerMove={handleLecturePointerMove}
                        onPointerUp={() => endLectureDrag(true)}
                        onPointerCancel={() => endLectureDrag(false)}
                        onKeyDown={e => handleLectureHandleKeyDown(e, subject.id)}
                        style={{
                          width: 24,
                          height: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          border: 'none',
                          background: 'transparent',
                          color: 'var(--text-tertiary)',
                          cursor: isDraggingLecture ? 'grabbing' : 'grab',
                          touchAction: 'none',
                          flexShrink: 0,
                          padding: 0,
                        }}
                      >
                        <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor" aria-hidden="true">
                          <circle cx="3" cy="3" r="1.3" /><circle cx="7" cy="3" r="1.3" />
                          <circle cx="3" cy="8" r="1.3" /><circle cx="7" cy="8" r="1.3" />
                          <circle cx="3" cy="13" r="1.3" /><circle cx="7" cy="13" r="1.3" />
                        </svg>
                      </button>

                      {/* Collapse toggle + name (no truncation) */}
                      <button
                        type="button"
                        aria-expanded={!collapsed}
                        title={collapsed ? '課題を表示する' : '課題を隠す'}
                        className="m3-state"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 'var(--space-2)',
                          padding: '0 var(--space-2)',
                          cursor: 'pointer',
                          height: '100%',
                          userSelect: 'none',
                          border: 'none',
                          background: 'transparent',
                          color: 'var(--text-primary)',
                        }}
                        onClick={() => toggleCollapse(subject.id)}
                      >
                        <svg
                          width="12" height="12" viewBox="0 0 10 10" fill="none" aria-hidden="true"
                          style={{
                            flexShrink: 0,
                            transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                            transition: 'transform var(--motion-duration-short4) var(--motion-easing-standard)',
                          }}
                        >
                          <path d="M2 3.5L5 6.5L8 3.5" stroke="var(--text-secondary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        <span
                          style={{
                            ...typeRole('title-small'),
                            fontWeight: 'var(--type-weight-emphasized)',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {subject.name}
                        </span>
                        {!collapsed && subjectRows.length > 0 && (
                          <span style={{
                            ...typeRole('label-small'),
                            color: 'var(--text-secondary)',
                            background: 'var(--bg-secondary)',
                            borderRadius: 'var(--shape-full)',
                            padding: '0 var(--space-2)',
                            flexShrink: 0,
                          }}>
                            {subjectRows.reduce((s, r) => s + r.tasks.length, 0)}
                          </span>
                        )}
                      </button>

                      {/* この講義に課題を追加 */}
                      <IconButton
                        label={`${subject.name}に課題を追加`}
                        variant="tonal"
                        onClick={e => { e.stopPropagation(); setAddModalSubjectId(subject.id) }}
                        style={rowIconButton}
                      >
                        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                          <path d="M9 4v10M4 9h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                        </svg>
                      </IconButton>

                      {/* 講義の画面（設定・参加者・進捗・履歴・退出） */}
                      <IconButton
                        label={`${subject.name}の講義画面を開く（設定・参加者・進捗・履歴）`}
                        onClick={e => { e.stopPropagation(); setLectureId(subject.id) }}
                        style={{ ...rowIconButton, marginRight: 'var(--space-2)' }}
                      >
                        <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                          <circle cx="6" cy="5.5" r="2.3" stroke="currentColor" strokeWidth="1.3"/>
                          <path d="M1.8 13c.4-2.3 2.2-3.6 4.2-3.6s3.8 1.3 4.2 3.6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                          <circle cx="11.5" cy="6.2" r="1.8" stroke="currentColor" strokeWidth="1.2"/>
                          <path d="M11.2 9.6c1.6 0 2.8 1 3.1 2.7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                        </svg>
                      </IconButton>

                      <SharedPartiesBadge
                        subject={subject}
                        isMobile={isMobile}
                        onClick={() => setLectureId(subject.id)}
                      />
                    </div>

                    {/* 完了率バー — absolute right */}
                    {(() => {
                      const subjectTasks = tasks.filter(t => t.subject_id === subject.id)
                      const total = subjectTasks.length
                      const done = subjectTasks.filter(t => t.status === 'done' || t.status === 'submitted').length
                      if (total === 0) return null
                      const pct = Math.round((done / total) * 100)
                      return (
                        <div style={{ position: 'absolute', right: 'var(--space-3)', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                          <div style={{ width: 56, height: 4, background: `${subject.color}30`, borderRadius: 'var(--shape-full)', overflow: 'hidden' }}>
                            <div style={{ width: `${pct}%`, height: '100%', background: subject.color, borderRadius: 'var(--shape-full)', transition: 'width var(--motion-duration-long2) var(--motion-easing-emphasized)' }} />
                          </div>
                          <span style={{ ...typeRole('label-small'), color: subject.color, whiteSpace: 'nowrap' }}>
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
                        style={{ height: ROW_HEIGHT, borderBottom: `1px solid ${gridLine}`, position: 'relative', background: 'var(--surface)' }}
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
                                  background: isTodayCol ? todayColumn : weekendColumn,
                                  borderRight: `1px solid ${gridLine}`,
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
                            // 詳細やメニューを開いている課題は、講義の色の枠で目立たせる
                            const isSelected = selectedTask?.id === task.id || quickMenu?.task.id === task.id
                            const restShadow = isSelected ? `0 0 0 2px ${color}` : 'var(--elevation-0)'
                            // バーが細くて名前が入らないときは、名前をバーの右の空いている所に出す（次のバーにはかからない幅まで）
                            const nextLeft = row.tasks
                              .filter(t => t.id !== task.id)
                              .map(t => getBarProps(t)?.left ?? Infinity)
                              .filter(l => l > left)
                              .reduce((a, b) => Math.min(a, b), days.length * COL_WIDTH)
                            const outsideLabelWidth = nextLeft - (left + width) - 8
                            const labelOutside = width < COL_WIDTH * 3 && outsideLabelWidth >= 40

                            return (
                              <Fragment key={task.id}>
                              <div
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
                                  height: 36,
                                  background: bg,
                                  borderRadius: 'var(--shape-sm)',
                                  cursor: isDragging ? 'grabbing' : 'grab',
                                  display: 'flex',
                                  alignItems: 'center',
                                  paddingLeft: 'var(--space-2)',
                                  paddingRight: 'var(--space-4)',
                                  // hidden だと中の名前の sticky が効かないので clip で切り取る
                                  overflow: 'clip',
                                  whiteSpace: 'nowrap',
                                  zIndex: isDragging ? 10 : isSelected ? 3 : 2,
                                  transition: isDragging ? 'none' : 'box-shadow var(--motion-duration-short4) var(--motion-easing-standard)',
                                  borderLeft: `3px solid ${color}`,
                                  boxShadow: isDragging ? 'var(--elevation-3)' : restShadow,
                                  userSelect: 'none',
                                }}
                                onMouseEnter={e => {
                                  if (!dragRef.current) {
                                    const el = e.currentTarget as HTMLElement
                                    el.style.boxShadow = isSelected ? `${restShadow}, var(--elevation-1)` : 'var(--elevation-1)'
                                    el.style.zIndex = '3'
                                  }
                                }}
                                onMouseLeave={e => {
                                  if (!dragRef.current) {
                                    const el = e.currentTarget as HTMLElement
                                    el.style.boxShadow = restShadow
                                    el.style.zIndex = isSelected ? '3' : '2'
                                  }
                                }}
                              >
                                {/* Left resize handle */}
                                <div
                                  onMouseDown={e => { e.stopPropagation(); startDrag(e, task, 'resize-start') }}
                                  style={{
                                    position: 'absolute', left: 0, top: 0, bottom: 0, width: 10,
                                    cursor: 'ew-resize', zIndex: 4, borderRadius: 'var(--shape-sm) 0 0 var(--shape-sm)',
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

                                {/* 名前（バーの左端が画面の外に出たら、画面の左端についてきて見えたままになる） */}
                                {!labelOutside && <span style={{
                                  position: 'sticky',
                                  left: 'var(--space-2)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  minWidth: 0,
                                  pointerEvents: 'none',
                                }}>
                                  {occurrenceLabel && (
                                    <span style={{
                                      ...typeRole('label-small'), color,
                                      background: withAlpha(color, '22'),
                                      borderRadius: 'var(--shape-xs)', padding: '0 var(--space-1)',
                                      flexShrink: 0, marginRight: 'var(--space-1)',
                                    }}>
                                      {occurrenceLabel}
                                    </span>
                                  )}
                                  <span style={{
                                    ...typeRole('label-medium'), color,
                                    overflow: 'hidden', textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    minWidth: 0,
                                  }}>
                                    {task.title}
                                    {task.due_time && (
                                      <span style={{ opacity: 0.75, fontWeight: 400, marginLeft: 'var(--space-1)' }}>
                                        {task.due_time}
                                      </span>
                                    )}
                                  </span>
                                </span>}
                              </div>
                              {labelOutside && (
                                <span
                                  aria-hidden="true"
                                  style={{
                                    position: 'absolute', left: left + width + 4, top: '50%', transform: 'translateY(-50%)',
                                    maxWidth: outsideLabelWidth, display: 'flex', alignItems: 'center', gap: 'var(--space-1)',
                                    pointerEvents: 'none', whiteSpace: 'nowrap', zIndex: 1,
                                  }}
                                >
                                  {occurrenceLabel && (
                                    <span style={{
                                      ...typeRole('label-small'), color,
                                      background: withAlpha(color, '22'),
                                      borderRadius: 'var(--shape-xs)', padding: '0 var(--space-1)', flexShrink: 0,
                                    }}>
                                      {occurrenceLabel}
                                    </span>
                                  )}
                                  <span style={{ ...typeRole('label-medium'), color, overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
                                    {task.title}
                                    {task.due_time && <span style={{ opacity: 0.75, fontWeight: 400, marginLeft: 'var(--space-1)' }}>{task.due_time}</span>}
                                  </span>
                                </span>
                              )}
                              </Fragment>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}

                  {/* Empty subject */}
                  {!collapsed && subjectRows.length === 0 && (
                    <button
                      type="button"
                      className="m3-state"
                      style={{
                        height: ROW_HEIGHT,
                        width: '100%',
                        border: 'none',
                        borderBottom: `1px solid ${gridLine}`,
                        background: 'var(--surface)',
                        display: 'flex',
                        alignItems: 'center',
                        padding: '0 var(--space-5)',
                        gap: 'var(--space-2)',
                        cursor: 'pointer',
                        color: 'var(--text-secondary)',
                        ...typeRole('body-medium'),
                      }}
                      onClick={() => setAddModalSubjectId(subject.id)}
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                        <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                      </svg>
                      {subject.name}に課題を追加
                    </button>
                  )}
                </div>
              )
            })
          )}
          {/* 右下の追加ボタンに最後の行が隠れないようにする余白 */}
          <div aria-hidden="true" style={{ height: isMobile ? 88 : 24 }} />
        </div>
      </div>
      {selectedTask && isExpanded && (
        <TaskDetailPanel
          task={selectedTask}
          subjects={subjects}
          onClose={() => setSelectedTask(null)}
          docked
        />
      )}
      </div>

      {isMobile && (
        <AppNavigation variant="bar" active={activeDestination} onSelect={selectDestination} onAdd={() => setAddModalSubjectId('')} />
      )}
      </div>

      {/* 課題を追加（右下の FAB。M3 の FAB: 56px・角 16px） */}
      {isMobile && !reAdd && (
        <Fab
          label="課題を追加 [N]"
          icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>}
          onClick={() => setAddModalSubjectId('')}
          style={{
            position: 'fixed',
            right: 'var(--space-4)',
            bottom: 'calc(var(--space-4) + var(--bottom-bar-height, 0px))',
            zIndex: 120,
          }}
        />
      )}

      {/* ---- Overlays ---- */}
      {selectedTask && !isExpanded && (
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

      {inboxOpen && (
        <InboxPanel
          onClose={() => setInboxOpen(false)}
          onOpenProfile={setProfileUserId}
          onOpenParty={setPartyId}
          onOpenLecture={setLectureId}
        />
      )}
      {peopleTab && (
        <PeoplePanel
          initialTab={peopleTab}
          onClose={() => setPeopleTab(null)}
          onOpenProfile={setProfileUserId}
          onOpenParty={setPartyId}
          onOpenInbox={() => { setPeopleTab(null); setInboxOpen(true) }}
        />
      )}
      {partyId && (
        <PartyHome
          partyId={partyId}
          onClose={() => setPartyId(null)}
          onOpenLecture={setLectureId}
          onOpenProfile={setProfileUserId}
        />
      )}
      {profileUserId && (
        <ProfileView
          userId={profileUserId}
          onClose={() => setProfileUserId(null)}
          onOpenLecture={setLectureId}
        />
      )}
      {lectureId && (
        <LectureScreen
          lectureId={lectureId}
          onClose={() => setLectureId(null)}
          onOpenProfile={setProfileUserId}
        />
      )}

      {accountOpen && (
        <AccountSheet
          onClose={() => setAccountOpen(false)}
          onOpenMyProfile={() => { if (userId) setProfileUserId(userId) }}
          onOpenSettings={isMobile ? () => setSettingsOpen(true) : undefined}
          onNewSemester={() => setNewSemesterOpen(true)}
        />
      )}
      {settingsOpen && <SettingsSheet onClose={() => setSettingsOpen(false)} />}

      {/* スマホの並べ方・絞り込み（下から出るシート。選ぶとすぐ反映され、タイムラインの件数も下に出す） */}
      {mobileFilterOpen && (
        <Sheet
          title="並べ方と絞り込み"
          subtitle="選ぶとすぐタイムラインに反映されます"
          onClose={() => setMobileFilterOpen(false)}
          zIndex={320}
          footer={
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <span style={{ flex: 1, color: 'var(--text-secondary)', fontSize: 'var(--type-body-medium-size)' }}>
                {(isFiltering || viewRange !== 'all') ? `${filteredTotal}件を表示中` : 'すべての課題を表示中'}
              </span>
              {changedFilterCount > 0 && (
                <Button variant="text" onClick={() => { changeLectureSort('due'); setViewRange('all'); setSelectedStatuses(new Set()) }}>
                  元に戻す
                </Button>
              )}
              <Button onClick={() => setMobileFilterOpen(false)}>閉じる</Button>
            </div>
          }
        >
          <Section title="講義の並べ方">
            <div role="group" aria-label="講義の並べ方" className="m3-menu m3-menu--inline">{sortOptions()}</div>
          </Section>
          <Section title="表示する期間">
            <div role="group" aria-label="表示する期間" className="m3-menu m3-menu--inline">{rangeOptions()}</div>
          </Section>
          <Section title="ステータス" description="複数選べます。何も選ばなければすべて表示します">
            <div role="group" aria-label="表示するステータス" className="m3-menu m3-menu--inline">{statusOptions()}</div>
          </Section>
        </Sheet>
      )}
      {newSemesterOpen && <NewSemesterSheet onClose={() => setNewSemesterOpen(false)} />}

      {quickMenu && (
        <TaskQuickMenu
          task={quickMenu.task}
          position={{ x: quickMenu.x, y: quickMenu.y }}
          onClose={() => setQuickMenu(null)}
          onOpenDetail={() => { setSelectedTask(quickMenu.task); setQuickMenu(null) }}
          asSheet={isMobile}
        />
      )}

      {reAdd && reAddSubject && reAddTemplates.length > 0 && (
        <ReAddCard
          subject={reAddSubject}
          templates={reAddTemplates}
          onAdd={handleReAdd}
          onClose={() => setReAdd(null)}
        />
      )}
    </div>
  )
}

/** 講義を見せているパーティーのタグ。クリックで講義の画面（共有先の変更）を開く */
function SharedPartiesBadge({ subject, isMobile, onClick }: { subject: Subject; isMobile: boolean; onClick: () => void }) {
  if (subject.visibility === 'private') return null

  const named = subject.visible_parties.filter(p => p.name !== null).map(p => p.name as string)
  const othersCount = subject.visible_parties.length - named.length
  const maxShown = isMobile ? 1 : 2
  const shown = named.slice(0, maxShown)
  const rest = named.length - shown.length + othersCount
  const isPublic = subject.visibility === 'public'
  if (!isPublic && subject.visible_parties.length === 0) return null

  const title = [
    isPublic ? '全体に公開中' : null,
    named.length > 0 ? `共有中のパーティー: ${named.join('、')}` : null,
    othersCount > 0 ? `ほかの参加者のパーティー ${othersCount}件` : null,
    subject.visibility === 'friends' ? '参加者のフレンドにも表示' : null,
  ].filter(Boolean).join('\n')

  const chip: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 'var(--space-1)',
    height: 24,
    padding: '0 var(--space-2)',
    borderRadius: 'var(--shape-xs)',
    ...typeRole('label-medium'),
    whiteSpace: 'nowrap',
    flexShrink: 0,
  }

  return (
    <button
      type="button"
      onClick={e => { e.stopPropagation(); onClick() }}
      title={`${title}\nクリックで共有先を変更`}
      aria-label={`${subject.name}の共有先: ${title.replace(/\n/g, '、')}`}
      className="m3-state"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-1)',
        marginRight: 'var(--space-2)',
        padding: 'var(--space-1)',
        border: 'none',
        background: 'none',
        borderRadius: 'var(--shape-sm)',
        cursor: 'pointer',
      }}
    >
      {isPublic && (
        <span style={{ ...chip, background: 'var(--public-bg)', color: 'var(--public)' }}>全体公開</span>
      )}
      {shown.map((name, i) => (
        <span
          key={i}
          style={{
            ...chip,
            background: 'var(--share-bg)',
            color: 'var(--share)',
            maxWidth: isMobile ? 72 : 120,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: 'inline-block',
            lineHeight: '24px',
          }}
        >
          {name}
        </span>
      ))}
      {rest > 0 && (
        <span style={{ ...chip, background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>+{rest}</span>
      )}
    </button>
  )
}
