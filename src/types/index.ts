export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'submitted'

export interface School {
  id: string
  name: string
  created_at: string
}

export interface Profile {
  id: string
  school_email: string | null
  school_email_verified: boolean
  school_id: string | null
  display_name: string
  created_at: string
}

export interface Subject {
  id: string
  user_id: string
  name: string
  color: string
  order: number
  created_at: string
}

export interface Recurrence {
  id: string
  user_id: string
  subject_id: string
  title: string
  start_from: string // YYYY-MM-DD
  interval_weeks: number
  duration_days: number
  count: number
  created_at: string
}

export interface Task {
  id: string
  user_id: string
  subject_id: string
  recurrence_id: string | null
  row_id: string | null
  source_template_id: string | null
  source_item_id: string | null
  title: string
  start_date: string // YYYY-MM-DD
  due_date: string   // YYYY-MM-DD
  due_time: string | null // HH:MM (optional)
  status: TaskStatus
  memo: string | null
  created_at: string
}

export interface Template {
  id: string
  school_id: string
  created_by: string | null
  title: string
  color: string
  description: string | null
  professor: string | null
  department: string | null
  schedule: string | null
  import_count: number
  version: number
  created_at: string
  // join で付与（一覧表示用）
  item_count?: number
  creator_name?: string | null
  // クライアント側で付与（自分の取り込み状況）
  imported?: boolean
  applied_version?: number | null
}

export interface TemplateMeta {
  description?: string
  professor?: string
  department?: string
  schedule?: string
}

export interface TemplateItem {
  id: string
  template_id: string
  title: string
  start_date: string // YYYY-MM-DD
  due_date: string   // YYYY-MM-DD
  due_time: string | null
  sort_order: number
  created_at: string
}

/** テンプレート編集フォームで扱う項目（id があれば既存、なければ新規） */
export interface TemplateItemDraft {
  id?: string
  title: string
  start_date: string
  due_date: string
  due_time: string | null
}

/** テンプレートに更新があるか（version > applied_version） */
export function hasTemplateUpdate(t: Template): boolean {
  return !!t.imported && (t.applied_version ?? 0) < t.version
}

export const STATUS_CONFIG: Record<
  TaskStatus | 'overdue',
  { label: string; color: string; bg: string; darkColor: string; darkBg: string }
> = {
  todo:        { label: '未着手',   color: '#6F6862', bg: '#EEEAE3', darkColor: '#B8B2AB', darkBg: 'rgba(155,149,144,0.20)' },
  in_progress: { label: '進行中',   color: '#0779A0', bg: '#E5F8FC', darkColor: '#38D6F0', darkBg: 'rgba(8,145,178,0.22)' },
  done:        { label: '完了',     color: '#14913F', bg: '#E4FAEE', darkColor: '#34D46A', darkBg: 'rgba(22,163,74,0.22)'   },
  submitted:   { label: '提出済み', color: '#7233DE', bg: '#F1EDFE', darkColor: '#B368F9', darkBg: 'rgba(124,58,237,0.22)' },
  overdue:     { label: '期限切れ', color: '#D42222', bg: '#FDECEC', darkColor: '#F26565', darkBg: 'rgba(239,68,68,0.20)'  },
}

export const STATUS_ORDER: TaskStatus[] = ['todo', 'in_progress', 'done', 'submitted']

export function isOverdue(task: Task): boolean {
  if (task.status === 'done' || task.status === 'submitted') return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = parseLocalDate(task.due_date)
  return due < today
}

export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function formatDate(dateStr: string): string {
  const d = parseLocalDate(dateStr)
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

export function toDateString(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function todayString(): string {
  return toDateString(new Date())
}
