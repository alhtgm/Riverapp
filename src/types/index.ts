export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'submitted'

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
  title: string
  start_date: string // YYYY-MM-DD
  due_date: string   // YYYY-MM-DD
  due_time: string | null // HH:MM (optional)
  status: TaskStatus
  memo: string | null
  created_at: string
}

export const STATUS_CONFIG: Record<
  TaskStatus | 'overdue',
  { label: string; color: string; bg: string; darkColor: string; darkBg: string }
> = {
  todo:        { label: '未着手',   color: '#9B9590', bg: '#F2EFE9', darkColor: '#A8A29E', darkBg: 'rgba(155,149,144,0.16)' },
  in_progress: { label: '進行中',   color: '#3B63FF', bg: '#EEF2FF', darkColor: '#6B84FF', darkBg: 'rgba(107,132,255,0.18)' },
  done:        { label: '完了',     color: '#16A34A', bg: '#ECFDF5', darkColor: '#22C55E', darkBg: 'rgba(22,163,74,0.18)'   },
  submitted:   { label: '提出済み', color: '#7C3AED', bg: '#F5F3FF', darkColor: '#A855F7', darkBg: 'rgba(124,58,237,0.18)' },
  overdue:     { label: '期限切れ', color: '#DC2626', bg: '#FEF2F2', darkColor: '#EF4444', darkBg: 'rgba(239,68,68,0.16)'  },
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
