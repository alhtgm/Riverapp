import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type {
  Subject, Task, Recurrence, Profile, TaskProgress, LectureTerm, LectureVisibility,
  SharedTaskField, PersonalTaskField,
} from '../types'
import { toDateString, parseLocalDate, emptyProgress } from '../types'
import { toMessage } from '../lib/errors'
import { getStoredTheme, applyTheme, type ThemeMode } from '../lib/theme'

interface LectureRow {
  id: string
  title: string
  year: number
  term: LectureTerm
  professor: string | null
  visibility: LectureVisibility
  apply_open: boolean
  created_at: string
}

interface LectureTaskRow {
  id: string
  lecture_id: string
  recurrence_id: string | null
  title: string
  due_date: string
  due_time: string | null
  description: string | null
  url: string | null
  created_at: string
}

interface TaskStateRow {
  task_id: string
  status: Task['status']
  work_start_date: string | null
  memo: string | null
  row_id: string | null
}

export interface LectureInput {
  title: string
  year: number
  term: LectureTerm
  professor?: string | null
}

export type LectureSettings = Partial<Pick<LectureRow, 'title' | 'year' | 'term' | 'professor' | 'visibility' | 'apply_open'>>

type TaskInput = Pick<Task, 'subject_id' | 'title' | 'start_date' | 'due_date' | 'due_time' | 'status' | 'memo' | 'row_id'> &
  Partial<Pick<Task, 'description' | 'url'>>

type TaskUpdates = Partial<Pick<Task, SharedTaskField | PersonalTaskField>>

const SHARED_FIELDS: SharedTaskField[] = ['title', 'due_date', 'due_time', 'description', 'url', 'subject_id']

/** Supabase のエラーを画面表示用の Error にして投げる */
function fail(error: unknown): never {
  throw new Error(toMessage(error))
}

function toSubject(lecture: LectureRow, color: string, order: number): Subject {
  return {
    id: lecture.id,
    name: lecture.title,
    color,
    order,
    year: lecture.year,
    term: lecture.term,
    professor: lecture.professor,
    visibility: lecture.visibility,
    apply_open: lecture.apply_open,
    created_at: lecture.created_at,
  }
}

function toTask(t: LectureTaskRow, st: TaskStateRow | undefined): Task {
  // 作業予定の開始が未設定、または締切より後になっている場合は締切日だけを表示する
  const workStart = st?.work_start_date && st.work_start_date <= t.due_date ? st.work_start_date : null
  return {
    id: t.id,
    subject_id: t.lecture_id,
    recurrence_id: t.recurrence_id,
    row_id: st?.row_id ?? null,
    title: t.title,
    start_date: workStart ?? t.due_date,
    due_date: t.due_date,
    due_time: t.due_time,
    status: st?.status ?? 'todo',
    memo: st?.memo ?? null,
    description: t.description,
    url: t.url,
    has_work_period: workStart !== null,
    created_at: t.created_at,
  }
}

function addDays(dateStr: string, days: number): string {
  const d = parseLocalDate(dateStr)
  d.setDate(d.getDate() + days)
  return toDateString(d)
}

async function requireUserId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('ログインが必要です')
  return user.id
}

interface AppState {
  userId: string | null
  subjects: Subject[]
  tasks: Task[]
  /** 課題ごとの「取り組み中」「完了」の人（7章） */
  progress: Record<string, TaskProgress>
  loading: boolean
  error: string | null

  // Account / profile
  profile: Profile | null
  profileLoaded: boolean
  schoolName: string | null
  fetchProfile: () => Promise<void>
  completeOnboarding: (schoolEmail: string, displayName: string, handle: string) => Promise<void>
  updateMyProfile: (updates: { handle?: string; display_name?: string }) => Promise<void>

  // Theme
  isDark: boolean
  toggleTheme: () => void

  fetchAll: () => Promise<void>
  fetchProgress: () => Promise<void>
  signOut: () => Promise<void>

  // Subject（= 参加中の講義）
  addSubject: (input: LectureInput, color: string) => Promise<Subject>
  updateSubject: (id: string, updates: Partial<Pick<Subject, 'name' | 'color' | 'order'>>) => Promise<void>
  updateLectureSettings: (id: string, settings: LectureSettings) => Promise<void>
  /** 講義から退出する（課題は自分のRiverから消え、進捗は保持される） */
  deleteSubject: (id: string) => Promise<void>

  // Task
  addTask: (task: TaskInput) => Promise<void>
  addRecurringTasks: (recurrence: Recurrence, subjectId: string) => Promise<void>
  updateTask: (id: string, updates: TaskUpdates) => Promise<void>
  updateTasksFromRecurrence: (
    recurrenceId: string,
    fromDueDate: string,
    updates: Partial<Pick<Task, 'title' | 'status' | 'memo'>>
  ) => Promise<void>
  deleteTask: (id: string) => Promise<void>
  deleteTasksFromRecurrence: (recurrenceId: string, fromDueDate: string) => Promise<void>
  restoreTask: (id: string) => Promise<void>
}

export const useStore = create<AppState>((set, get) => ({
  userId: null,
  subjects: [],
  tasks: [],
  progress: {},
  loading: false,
  error: null,

  profile: null,
  profileLoaded: false,
  schoolName: null,

  isDark: getStoredTheme() === 'dark',
  toggleTheme: () => {
    const next: ThemeMode = get().isDark ? 'light' : 'dark'
    applyTheme(next)
    set({ isDark: next === 'dark' })
  },

  fetchProfile: async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      set({ profile: null, profileLoaded: true, userId: null })
      return
    }
    const { data, error } = await supabase
      .from('profiles')
      .select('*, schools(name)')
      .eq('id', user.id)
      .maybeSingle()
    if (error) {
      set({ error: error.message, profileLoaded: true })
      return
    }
    if (!data) {
      set({ profile: null, schoolName: null, profileLoaded: true, userId: user.id })
      return
    }
    const row = { ...(data as Record<string, unknown>) }
    const sf = row.schools as { name?: string } | { name?: string }[] | null | undefined
    const sName = Array.isArray(sf) ? (sf[0]?.name ?? null) : (sf?.name ?? null)
    delete row.schools
    set({ profile: row as unknown as Profile, schoolName: sName, profileLoaded: true, userId: user.id })
  },

  completeOnboarding: async (schoolEmail, displayName, handle) => {
    const userId = await requireUserId()

    const email = schoolEmail.trim().toLowerCase()
    const name = displayName.trim()
    const h = handle.trim().replace(/^@/, '')
    const domain = email.split('@')[1] ?? ''
    if (!domain) throw new Error('メールアドレスの形式が正しくありません')
    if (!name) throw new Error('表示名を入力してください')
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(h)) {
      throw new Error('ユーザーIDは英数字とアンダースコアで3〜20文字にしてください')
    }

    // ドメインを許可リストと照合して学校を特定
    const { data: domainRow, error: domainErr } = await supabase
      .from('school_domains')
      .select('school_id, schools(name)')
      .eq('domain', domain)
      .maybeSingle()
    if (domainErr) fail(domainErr)
    if (!domainRow) {
      throw new Error(`未対応の学校ドメインです（${domain}）`)
    }
    const sf = (domainRow as Record<string, unknown>).schools as { name?: string } | { name?: string }[] | null | undefined
    const schoolName = Array.isArray(sf) ? (sf[0]?.name ?? null) : (sf?.name ?? null)

    const { data, error } = await supabase
      .from('profiles')
      .insert({
        id: userId,
        school_email: email,
        school_id: domainRow.school_id,
        display_name: name,
        handle: h,
      })
      .select()
      .single()
    if (error) fail(error)
    set({ profile: data, schoolName, profileLoaded: true, userId })
  },

  updateMyProfile: async (updates) => {
    const userId = await requireUserId()
    const payload: Record<string, string> = {}
    if (updates.handle !== undefined) {
      const h = updates.handle.trim().replace(/^@/, '')
      if (!/^[a-zA-Z0-9_]{3,20}$/.test(h)) {
        throw new Error('ユーザーIDは英数字とアンダースコアで3〜20文字にしてください')
      }
      payload.handle = h
    }
    if (updates.display_name !== undefined) {
      const n = updates.display_name.trim()
      if (!n) throw new Error('表示名を入力してください')
      payload.display_name = n
    }
    const { data, error } = await supabase.from('profiles').update(payload).eq('id', userId).select().single()
    if (error) fail(error)
    set(s => ({ profile: s.profile ? { ...s.profile, ...data } : data }))
  },

  signOut: async () => {
    await supabase.auth.signOut()
    set({ profile: null, profileLoaded: false, schoolName: null, subjects: [], tasks: [], progress: {}, userId: null })
  },

  fetchAll: async () => {
    set({ loading: true, error: null })
    try {
      const userId = await requireUserId()

      const { data: parts, error: partErr } = await supabase
        .from('lecture_participants')
        .select('color, order, lectures(*)')
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('order')
      if (partErr) fail(partErr)

      const subjects: Subject[] = []
      for (const p of parts ?? []) {
        const raw = (p as Record<string, unknown>).lectures as LectureRow | LectureRow[] | null
        const lecture = Array.isArray(raw) ? raw[0] : raw
        if (!lecture) continue
        subjects.push(toSubject(lecture, p.color as string, p.order as number))
      }

      const lectureIds = subjects.map(s => s.id)
      let tasks: Task[] = []
      if (lectureIds.length > 0) {
        const [taskRes, stateRes] = await Promise.all([
          supabase
            .from('lecture_tasks')
            .select('id, lecture_id, recurrence_id, title, due_date, due_time, description, url, created_at')
            .in('lecture_id', lectureIds)
            .is('deleted_at', null)
            .order('due_date'),
          supabase
            .from('task_user_state')
            .select('task_id, status, work_start_date, memo, row_id')
            .eq('user_id', userId),
        ])
        if (taskRes.error) fail(taskRes.error)
        if (stateRes.error) fail(stateRes.error)
        const stateMap = new Map<string, TaskStateRow>()
        for (const st of (stateRes.data ?? []) as TaskStateRow[]) stateMap.set(st.task_id, st)
        tasks = ((taskRes.data ?? []) as LectureTaskRow[]).map(t => toTask(t, stateMap.get(t.id)))
      }

      // 締切から30日以上たった行は表示しない（共有課題なので削除はしない）
      const cutoff = new Date()
      cutoff.setHours(0, 0, 0, 0)
      cutoff.setDate(cutoff.getDate() - 30)
      const cutoffStr = toDateString(cutoff)
      const rowLastDue = new Map<string, string>()
      for (const t of tasks) {
        const key = t.recurrence_id ?? t.id
        const cur = rowLastDue.get(key) ?? ''
        if (t.due_date > cur) rowLastDue.set(key, t.due_date)
      }
      const visibleTasks = tasks.filter(t => (rowLastDue.get(t.recurrence_id ?? t.id) ?? '') >= cutoffStr)

      set({ subjects, tasks: visibleTasks, loading: false, userId })
      void get().fetchProgress()
    } catch (e: unknown) {
      set({ error: (e as Error).message, loading: false })
    }
  },

  fetchProgress: async () => {
    const lectureIds = get().subjects.map(s => s.id)
    if (lectureIds.length === 0) {
      set({ progress: {} })
      return
    }
    const { data, error } = await supabase.rpc('get_lectures_progress', { p_lecture_ids: lectureIds })
    if (error) return // 進捗表示は補助情報なので、失敗してもタイムラインは表示する
    const progress: Record<string, TaskProgress> = {}
    for (const row of (data ?? []) as { task_id: string; status: string; user_id: string | null; display_name: string | null }[]) {
      const p = progress[row.task_id] ?? (progress[row.task_id] = emptyProgress())
      const status = row.status as Task['status']
      if (p[status]) p[status].push({ userId: row.user_id, name: row.display_name })
    }
    set({ progress })
  },

  addSubject: async (input, color) => {
    const { data, error } = await supabase.rpc('create_lecture', {
      p_title: input.title.trim(),
      p_year: input.year,
      p_term: input.term,
      p_professor: input.professor?.trim() || null,
      p_visibility: 'party',
      p_color: color,
    })
    if (error) fail(error)
    const lecture = data as LectureRow
    const order = Math.max(0, ...get().subjects.map(s => s.order)) + 1
    // create_lecture は並び順 0 で作るので、末尾に回す
    await supabase.rpc('update_my_lecture_prefs', { p_lecture_id: lecture.id, p_order: order })
    const subject = toSubject(lecture, color, order)
    set(s => ({ subjects: [...s.subjects, subject] }))
    return subject
  },

  updateSubject: async (id, updates) => {
    if (updates.color !== undefined || updates.order !== undefined) {
      const { error } = await supabase.rpc('update_my_lecture_prefs', {
        p_lecture_id: id,
        p_color: updates.color ?? null,
        p_order: updates.order ?? null,
      })
      if (error) fail(error)
    }
    if (updates.name !== undefined) {
      const { error } = await supabase.from('lectures').update({ title: updates.name.trim() }).eq('id', id)
      if (error) fail(error)
    }
    set(s => ({ subjects: s.subjects.map(sub => (sub.id === id ? { ...sub, ...updates } : sub)) }))
  },

  updateLectureSettings: async (id, settings) => {
    const payload: LectureSettings = { ...settings }
    if (payload.title !== undefined) payload.title = payload.title.trim()
    if (payload.professor !== undefined) payload.professor = payload.professor?.trim() || null
    const { data, error } = await supabase.from('lectures').update(payload).eq('id', id).select().single()
    if (error) fail(error)
    const lecture = data as LectureRow
    set(s => ({
      subjects: s.subjects.map(sub => (sub.id === id ? toSubject(lecture, sub.color, sub.order) : sub)),
    }))
  },

  deleteSubject: async (id) => {
    const { error } = await supabase.rpc('leave_lecture', { p_lecture_id: id })
    if (error) fail(error)
    set(s => ({
      subjects: s.subjects.filter(sub => sub.id !== id),
      tasks: s.tasks.filter(t => t.subject_id !== id),
    }))
  },

  addTask: async (task) => {
    const userId = await requireUserId()
    const { data, error } = await supabase
      .from('lecture_tasks')
      .insert({
        lecture_id: task.subject_id,
        title: task.title,
        due_date: task.due_date,
        due_time: task.due_time,
        description: task.description ?? null,
        url: task.url ?? null,
        created_by: userId,
      })
      .select('id, lecture_id, recurrence_id, title, due_date, due_time, description, url, created_at')
      .single()
    if (error) fail(error)

    // 追加した本人の作業予定・進捗・メモ（他の参加者は未設定から始まる）
    const state: TaskStateRow = {
      task_id: data.id,
      status: task.status,
      work_start_date: task.start_date < task.due_date ? task.start_date : null,
      memo: task.memo,
      row_id: task.row_id,
    }
    const { error: stErr } = await supabase
      .from('task_user_state')
      .update({ status: state.status, work_start_date: state.work_start_date, memo: state.memo, row_id: state.row_id })
      .eq('task_id', data.id)
      .eq('user_id', userId)
    if (stErr) fail(stErr)

    set(s => ({ tasks: [...s.tasks, toTask(data as LectureTaskRow, state)] }))
  },

  addRecurringTasks: async (recurrence, subjectId) => {
    const userId = await requireUserId()
    const { data, error } = await supabase.rpc('add_lecture_recurring_tasks', {
      p_lecture_id: subjectId,
      p_title: recurrence.title,
      p_start_from: recurrence.start_from,
      p_interval_weeks: recurrence.interval_weeks,
      p_duration_days: recurrence.duration_days,
      p_count: recurrence.count,
    })
    if (error) fail(error)
    const rows = (data ?? []) as LectureTaskRow[]

    // 追加した本人は、各回の発生日を作業予定の開始にする
    const states: TaskStateRow[] = rows.map(r => ({
      task_id: r.id,
      status: 'todo',
      work_start_date: addDays(r.due_date, -recurrence.duration_days),
      memo: null,
      row_id: null,
    }))
    const results = await Promise.all(
      states.map(st =>
        supabase
          .from('task_user_state')
          .update({ work_start_date: st.work_start_date })
          .eq('task_id', st.task_id)
          .eq('user_id', userId)
      )
    )
    const stErr = results.find(r => r.error)?.error
    if (stErr) fail(stErr)

    set(s => ({ tasks: [...s.tasks, ...rows.map((r, i) => toTask(r, states[i]))] }))
  },

  updateTask: async (id, updates) => {
    const userId = await requireUserId()
    const current = get().tasks.find(t => t.id === id)

    const shared: Record<string, unknown> = {}
    for (const f of SHARED_FIELDS) {
      if (updates[f] !== undefined) shared[f === 'subject_id' ? 'lecture_id' : f] = updates[f]
    }
    if (Object.keys(shared).length > 0) {
      shared.updated_at = new Date().toISOString()
      const { error } = await supabase.from('lecture_tasks').update(shared).eq('id', id)
      if (error) fail(error)
    }

    const personal: Record<string, unknown> = {}
    if (updates.status !== undefined) personal.status = updates.status
    if (updates.memo !== undefined) personal.memo = updates.memo
    if (updates.row_id !== undefined) personal.row_id = updates.row_id
    if (updates.start_date !== undefined) {
      const due = updates.due_date ?? current?.due_date
      // 開始日が締切日と同じなら「作業予定期間は未設定」として扱う
      personal.work_start_date = due && updates.start_date < due ? updates.start_date : null
    }
    if (Object.keys(personal).length > 0) {
      personal.updated_at = new Date().toISOString()
      const { error } = await supabase.from('task_user_state').update(personal).eq('task_id', id).eq('user_id', userId)
      if (error) fail(error)
    }

    set(s => ({
      tasks: s.tasks.map(t => {
        if (t.id !== id) return t
        const next = { ...t, ...updates }
        if (next.start_date > next.due_date) next.start_date = next.due_date
        next.has_work_period = next.start_date < next.due_date
        return next
      }),
    }))
    if (updates.status !== undefined) void get().fetchProgress()
  },

  updateTasksFromRecurrence: async (recurrenceId, fromDueDate, updates) => {
    const userId = await requireUserId()
    const targets = get().tasks.filter(t => t.recurrence_id === recurrenceId && t.due_date >= fromDueDate)
    const ids = targets.map(t => t.id)
    if (ids.length === 0) return

    if (updates.title !== undefined) {
      const { error } = await supabase
        .from('lecture_tasks')
        .update({ title: updates.title, updated_at: new Date().toISOString() })
        .in('id', ids)
      if (error) fail(error)
    }
    const personal: Record<string, unknown> = {}
    if (updates.status !== undefined) personal.status = updates.status
    if (updates.memo !== undefined) personal.memo = updates.memo
    if (Object.keys(personal).length > 0) {
      const { error } = await supabase.from('task_user_state').update(personal).in('task_id', ids).eq('user_id', userId)
      if (error) fail(error)
    }
    const idSet = new Set(ids)
    set(s => ({ tasks: s.tasks.map(t => (idSet.has(t.id) ? { ...t, ...updates } : t)) }))
    if (updates.status !== undefined) void get().fetchProgress()
  },

  deleteTask: async (id) => {
    const userId = await requireUserId()
    const { error } = await supabase
      .from('lecture_tasks')
      .update({ deleted_at: new Date().toISOString(), deleted_by: userId })
      .eq('id', id)
    if (error) fail(error)
    set(s => ({ tasks: s.tasks.filter(t => t.id !== id) }))
  },

  deleteTasksFromRecurrence: async (recurrenceId, fromDueDate) => {
    const userId = await requireUserId()
    const ids = get().tasks.filter(t => t.recurrence_id === recurrenceId && t.due_date >= fromDueDate).map(t => t.id)
    if (ids.length === 0) return
    const { error } = await supabase
      .from('lecture_tasks')
      .update({ deleted_at: new Date().toISOString(), deleted_by: userId })
      .in('id', ids)
    if (error) fail(error)
    const idSet = new Set(ids)
    set(s => ({ tasks: s.tasks.filter(t => !idSet.has(t.id)) }))
  },

  restoreTask: async (id) => {
    const { error } = await supabase.from('lecture_tasks').update({ deleted_at: null, deleted_by: null }).eq('id', id)
    if (error) fail(error)
    await get().fetchAll()
  },
}))
