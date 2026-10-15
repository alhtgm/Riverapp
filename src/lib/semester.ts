import type { Task } from '../types'
import { toDateString } from '../types'

/** 画面上だけの学期絞り込み (Supabase には保存しない) */
export type Semester = 'all' | 'first' | 'second'

export const SEMESTER_OPTIONS: { key: Semester; label: string }[] = [
  { key: 'all',    label: '全期間' },
  { key: 'first',  label: '前期' },
  { key: 'second', label: '後期' },
]

/** 年度: 4月始まり (1〜3月は前年度) */
function getAcademicYear(date: Date): number {
  return date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1
}

/** 今日の日付から初期値を決める: 4〜9月 = 前期, 10〜3月 = 後期 */
export function getCurrentSemester(date: Date = new Date()): Semester {
  const m = date.getMonth() + 1
  return m >= 4 && m <= 9 ? 'first' : 'second'
}

/** 今年度の学期の範囲 (YYYY-MM-DD, 両端含む)。'all' は null */
export function getSemesterRange(semester: Semester, today: Date = new Date()): { from: string; to: string } | null {
  if (semester === 'all') return null
  const y = getAcademicYear(today)
  if (semester === 'first') {
    return { from: toDateString(new Date(y, 3, 1)), to: toDateString(new Date(y, 8, 30)) }
  }
  return { from: toDateString(new Date(y, 9, 1)), to: toDateString(new Date(y + 1, 2, 31)) }
}

/** 期限日が学期内に入る課題かどうか */
export function isInSemester(task: Task, semester: Semester, today: Date = new Date()): boolean {
  const range = getSemesterRange(semester, today)
  if (!range) return true
  return task.due_date >= range.from && task.due_date <= range.to
}

/** 選択肢のラベル補足 (例: "10〜3月") */
export function getSemesterHint(semester: Semester): string {
  if (semester === 'first') return '4〜9月'
  if (semester === 'second') return '10〜3月'
  return ''
}
