import type { LectureTerm, Subject } from '../types'

/**
 * 学期 = 講義の「年度 × 学期」で区切った1枚のシート。
 * 通年の講義は、その年度の前期・後期の両方のシートに表示する。
 */
export type SemesterTerm = Exclude<LectureTerm, 'full_year'>

export interface Semester {
  year: number
  term: SemesterTerm
}

export const SEMESTER_TERMS: SemesterTerm[] = ['spring', 'fall', 'other']

export const SEMESTER_TERM_LABEL: Record<SemesterTerm, string> = {
  spring: '前期',
  fall: '後期',
  other: 'その他',
}

/** 学期内での並び順（新しい順に並べるときに後ろの学期ほど大きい） */
const TERM_RANK: Record<SemesterTerm, number> = { spring: 0, fall: 1, other: 2 }

export function semesterKey(s: Semester): string {
  return `${s.year}-${s.term}`
}

export function parseSemesterKey(key: string | null | undefined): Semester | null {
  const m = /^(\d{4})-(spring|fall|other)$/.exec(key ?? '')
  return m ? { year: Number(m[1]), term: m[2] as SemesterTerm } : null
}

export function semesterLabel(s: Semester): string {
  return `${s.year}年度 ${SEMESTER_TERM_LABEL[s.term]}`
}

/** 4月始まりの年度と、4〜9月なら前期・それ以外は後期を今の学期にする */
export function currentSemester(now = new Date()): Semester {
  const m = now.getMonth() + 1
  return { year: m >= 4 ? now.getFullYear() : now.getFullYear() - 1, term: m >= 4 && m <= 9 ? 'spring' : 'fall' }
}

export function subjectInSemester(subject: Pick<Subject, 'year' | 'term'>, s: Semester): boolean {
  if (subject.year !== s.year) return false
  if (subject.term === 'full_year') return s.term === 'spring' || s.term === 'fall'
  return subject.term === s.term
}

/** 学期のおおよその期間（前期 4/1〜9/30、後期 10/1〜3/31。その他は年度全体） */
export function semesterRange(s: Semester): { start: Date; end: Date } {
  if (s.term === 'spring') return { start: new Date(s.year, 3, 1), end: new Date(s.year, 8, 30) }
  if (s.term === 'fall') return { start: new Date(s.year, 9, 1), end: new Date(s.year + 1, 2, 31) }
  return { start: new Date(s.year, 3, 1), end: new Date(s.year + 1, 2, 31) }
}

/** 講義がある学期と、今の学期・選択中の学期を新しい順に並べる */
export function listSemesters(subjects: Pick<Subject, 'year' | 'term'>[], extra: Semester[]): Semester[] {
  const map = new Map<string, Semester>()
  const add = (s: Semester) => map.set(semesterKey(s), s)
  for (const sub of subjects) {
    if (sub.term === 'full_year') {
      add({ year: sub.year, term: 'spring' })
      add({ year: sub.year, term: 'fall' })
    } else {
      add({ year: sub.year, term: sub.term })
    }
  }
  extra.forEach(add)
  return [...map.values()].sort((a, b) => b.year - a.year || TERM_RANK[b.term] - TERM_RANK[a.term])
}
