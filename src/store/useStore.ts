import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type {
  Subject, Task, Recurrence, Profile, TaskProgress, LectureTerm, LectureVisibility,
  SharedTaskField, PersonalTaskField,
} from '../types'
import { toDateString, emptyProgress } from '../types'
import { toMessage } from '../lib/errors'
import { getStoredTheme, applyTheme, type ThemeMode } from '../lib/theme'
import { currentSemester, parseSemesterKey, semesterKey, type Semester } from '../lib/semester'

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
  start_date: string | null
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
}

interface LectureInput {
  title: string
  year: number
  term: LectureTerm
  professor?: string | null
}

type LectureSettings = Partial<Pick<LectureRow, 'title' | 'year' | 'term' | 'professor' | 'visibility' | 'apply_open'>>

type TaskInput = Pick<Task, 'subject_id' | 'title' | 'start_date' | 'due_date' | 'due_time' | 'status' | 'memo'> &
  Partial<Pick<Task, 'description' | 'url'>>

type TaskUpdates = Partial<Pick<Task, SharedTaskField | PersonalTaskField>>

const SHARED_FIELDS: SharedTaskField[] = ['title', 'due_date', 'due_time', 'description', 'url', 'subject_id']

/** Supabase のエラーを画面表示用の Error にして投げる */
function fail(error: unknown): never {
  throw new Error(toMessage(error))
}

function toSubject(
  lecture: LectureRow,
  color: string,
  order: number,
  visibleParties: Subject['visible_parties'] = [],
): Subject {
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
    visible_parties: visibleParties,
  }
}

const TASK_COLUMNS = 'id, lecture_id, recurrence_id, title, start_date, due_date, due_time, description, url, created_at'

function toTask(t: LectureTaskRow, st: TaskStateRow | undefined): Task {
  // 本人の作業開始日 → 講義で共有している発生日 → 締切日 の順に使う（締切より後の日付は使わない）
  const sharedStart = t.start_date && t.start_date <= t.due_date ? t.start_date : null
  const workStart = st?.work_start_date && st.work_start_date <= t.due_date ? st.work_start_date : null
  const start = workStart ?? sharedStart ?? t.due_date
  return {
    id: t.id,
    subject_id: t.lecture_id,
    recurrence_id: t.recurrence_id,
    title: t.title,
    start_date: start,
    due_date: t.due_date,
    due_time: t.due_time,
    status: st?.status ?? 'todo',
    memo: st?.memo ?? null,
    description: t.description,
    url: t.url,
    shared_start_date: sharedStart,
    has_work_period: start < t.due_date,
    created_at: t.created_at,
  }
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
  /** プロフィールを作り、本人が選んだ学期を最初の学期にする。ユーザーIDはデータベースが自動で決める（本人は変更できない） */
  completeOnboarding: (displayName: string, semester: Semester) => Promise<void>
  /** 大学を任意で登録する（null で登録を外す）。ドメインから大学を判定するだけで、ほかの機能には影響しない */
  setMySchoolEmail: (schoolEmail: string | null) => Promise<void>
  updateMyProfile: (updates: { display_name: string }) => Promise<void>

  // Theme
  isDark: boolean
  toggleTheme: () => void

  /** 表示中の学期（最後に選んだ学期をアカウントに保存し、次回も同じ学期を開く） */
  semester: Semester
  setSemester: (semester: Semester) => void

  /** silent: 読み込み中の表示を出さずに読み直す（リアルタイム更新用） */
  fetchAll: (options?: { silent?: boolean }) => Promise<void>
  /** 講義・課題を読み直すたびに増える番号。講義画面の履歴などの再読み込みに使う */
  dataVersion: number
  /**
   * 参加中の講義の課題・設定・参加者・進捗の変化をリアルタイムで受け取り、自動で読み直す。
   * 戻り値で購読を止める。参加する講義が変わったら購読し直す
   */
  subscribeRealtime: () => () => void
  fetchProgress: () => Promise<void>
  signOut: () => Promise<void>

  // Subject（= 参加中の講義）
  addSubject: (input: LectureInput, color: string) => Promise<Subject>
  updateSubject: (id: string, updates: Partial<Pick<Subject, 'name' | 'color' | 'order'>>) => Promise<void>
  /** 講義の並び順を保存する（ids の順に order を 0, 1, 2… と振り直す。失敗したら元に戻す） */
  reorderSubjects: (ids: string[]) => Promise<void>
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

const SEMESTER_STORAGE_KEY = 'river:semester'

function readStoredSemester(): Semester | null {
  try { return parseSemesterKey(localStorage.getItem(SEMESTER_STORAGE_KEY)) } catch { return null }
}

function storeSemesterLocally(s: Semester) {
  try { localStorage.setItem(SEMESTER_STORAGE_KEY, semesterKey(s)) } catch { /* 保存できなくても表示は続ける */ }
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

  semester: readStoredSemester() ?? currentSemester(),
  setSemester: (semester) => {
    if (semesterKey(semester) === semesterKey(get().semester)) return
    set({ semester })
    storeSemesterLocally(semester)
    // ほかのブラウザでも同じ学期を開けるよう、アカウントにも保存する（失敗しても表示は切り替える）
    void supabase.auth.updateUser({ data: { last_semester: semesterKey(semester) } })
  },

  fetchProfile: async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      set({ profile: null, profileLoaded: true, userId: null })
      return
    }
    const saved = parseSemesterKey(user.user_metadata?.last_semester as string | undefined)
    if (saved && semesterKey(saved) !== semesterKey(get().semester)) {
      set({ semester: saved })
      storeSemesterLocally(saved)
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

  completeOnboarding: async (displayName, semester) => {
    const userId = await requireUserId()
    const name = displayName.trim()
    if (!name) throw new Error('表示名を入力してください')
    const { data, error } = await supabase
      .from('profiles')
      .insert({ id: userId, display_name: name })
      .select()
      .single()
    if (error) fail(error)
    // setSemester は今の学期と同じだと保存しないので、ここでは必ず保存する
    set({ profile: data, schoolName: null, profileLoaded: true, userId, semester })
    storeSemesterLocally(semester)
    void supabase.auth.updateUser({ data: { last_semester: semesterKey(semester) } })
  },

  setMySchoolEmail: async (schoolEmail) => {
    const userId = await requireUserId()
    if (schoolEmail === null) {
      const { error } = await supabase.from('profiles').update({ school_email: null, school_id: null }).eq('id', userId)
      if (error) fail(error)
      set(s => ({ profile: s.profile ? { ...s.profile, school_email: null, school_id: null } : s.profile, schoolName: null }))
      return
    }
    const email = schoolEmail.trim().toLowerCase()
    const domain = email.split('@')[1] ?? ''
    if (!domain) throw new Error('メールアドレスの形式が正しくありません')

    // ドメインを許可リストと照合して大学を特定
    const { data: domainRow, error: domainErr } = await supabase
      .from('school_domains')
      .select('school_id, schools(name)')
      .eq('domain', domain)
      .maybeSingle()
    if (domainErr) fail(domainErr)
    if (!domainRow) throw new Error(`まだ対応していない大学のドメインです（${domain}）`)
    const sf = (domainRow as Record<string, unknown>).schools as { name?: string } | { name?: string }[] | null | undefined
    const schoolName = Array.isArray(sf) ? (sf[0]?.name ?? null) : (sf?.name ?? null)

    const { error } = await supabase
      .from('profiles')
      .update({ school_email: email, school_id: domainRow.school_id })
      .eq('id', userId)
    if (error) fail(error)
    set(s => ({
      profile: s.profile ? { ...s.profile, school_email: email, school_id: domainRow.school_id } : s.profile,
      schoolName,
    }))
  },

  updateMyProfile: async (updates) => {
    const userId = await requireUserId()
    // ユーザーIDは変更できないので、表示名だけを保存する
    const name = updates.display_name.trim()
    if (!name) throw new Error('表示名を入力してください')
    const { data, error } = await supabase.from('profiles').update({ display_name: name }).eq('id', userId).select().single()
    if (error) fail(error)
    set(s => ({ profile: s.profile ? { ...s.profile, ...data } : data }))
  },

  signOut: async () => {
    await supabase.auth.signOut()
    try { localStorage.removeItem(SEMESTER_STORAGE_KEY) } catch { /* 無視 */ }
    set({
      profile: null, profileLoaded: false, schoolName: null, subjects: [], tasks: [], progress: {}, userId: null,
      semester: currentSemester(),
    })
  },

  dataVersion: 0,

  fetchAll: async (options) => {
    if (!options?.silent) set({ loading: true, error: null })
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
        const [taskRes, stateRes, partyRes] = await Promise.all([
          supabase
            .from('lecture_tasks')
            .select(TASK_COLUMNS)
            .in('lecture_id', lectureIds)
            .is('deleted_at', null)
            .order('due_date'),
          supabase
            .from('task_user_state')
            .select('task_id, status, work_start_date, memo')
            .eq('user_id', userId),
          // パーティー名は parties の RLS により、自分が所属するものだけ読める（それ以外は null）
          supabase
            .from('lecture_visible_parties')
            .select('lecture_id, party_id, parties(name)')
            .in('lecture_id', lectureIds)
            .order('created_at'),
        ])
        if (taskRes.error) fail(taskRes.error)
        if (stateRes.error) fail(stateRes.error)
        if (partyRes.error) fail(partyRes.error)
        const partiesByLecture = new Map<string, Subject['visible_parties']>()
        for (const row of (partyRes.data ?? []) as Record<string, unknown>[]) {
          const raw = row.parties as { name: string } | { name: string }[] | null
          const party = Array.isArray(raw) ? raw[0] : raw
          const arr = partiesByLecture.get(row.lecture_id as string) ?? []
          arr.push({ id: row.party_id as string, name: party?.name ?? null })
          partiesByLecture.set(row.lecture_id as string, arr)
        }
        for (const sub of subjects) sub.visible_parties = partiesByLecture.get(sub.id) ?? []
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

      set(s => ({ subjects, tasks: visibleTasks, loading: false, error: null, userId, dataVersion: s.dataVersion + 1 }))
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

  subscribeRealtime: () => {
    let channel: ReturnType<typeof supabase.channel> | null = null
    let allTimer: number | undefined
    let progressTimer: number | undefined
    let stopped = false
    // 1つの操作で何行も変わる（繰り返し課題の一括追加など）ので、まとめて1回だけ読み直す
    const refreshAll = () => {
      window.clearTimeout(allTimer)
      allTimer = window.setTimeout(() => { void get().fetchAll({ silent: true }) }, 400)
    }
    const refreshProgress = () => {
      window.clearTimeout(progressTimer)
      progressTimer = window.setTimeout(() => { void get().fetchProgress() }, 400)
    }

    void (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || stopped) return
      const me = user.id
      // 全体公開の講義も RLS 上は読めるため、自分が参加している講義だけに絞る（Realtime の in フィルタは100件まで）
      const ids = get().subjects.map(s => s.id)
      const inIds = ids.length > 0 && ids.length <= 100 ? `in.(${ids.join(',')})` : null
      let ch = supabase.channel(`lectures:${me}`)
        // 自分の参加・退出・除外（別の端末での操作や、参加申請の承認を含む）
        .on('postgres_changes', { event: '*', schema: 'public', table: 'lecture_participants', filter: `user_id=eq.${me}` }, refreshAll)
        // 自分の進捗・メモ・作業開始日（別の端末での操作）
        .on('postgres_changes', { event: '*', schema: 'public', table: 'task_user_state', filter: `user_id=eq.${me}` }, refreshAll)
        // ほかの参加者の進捗（RLS で参加中の講義の分だけ届く）
        .on('postgres_changes', { event: '*', schema: 'public', table: 'task_user_state' }, payload => {
          const row = (payload.new ?? payload.old) as { user_id?: string } | null
          if (row?.user_id !== me) refreshProgress()
        })
      if (inIds) {
        ch = ch
          .on('postgres_changes', { event: '*', schema: 'public', table: 'lecture_tasks', filter: `lecture_id=${inIds}` }, refreshAll)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'lectures', filter: `id=${inIds}` }, refreshAll)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'lecture_participants', filter: `lecture_id=${inIds}` }, refreshProgress)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'lecture_visible_parties', filter: `lecture_id=${inIds}` }, refreshAll)
      }
      channel = ch.subscribe()
    })()

    return () => {
      stopped = true
      window.clearTimeout(allTimer)
      window.clearTimeout(progressTimer)
      if (channel) void supabase.removeChannel(channel)
    }
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

  reorderSubjects: async (ids) => {
    const prev = get().subjects
    const nextOrder = new Map(ids.map((id, i) => [id, i]))
    const changed = prev.filter(s => nextOrder.has(s.id) && s.order !== nextOrder.get(s.id))
    if (changed.length === 0) return
    // 先に画面へ反映し、保存に失敗したら元の順に戻す
    set({
      subjects: prev
        .map(s => (nextOrder.has(s.id) ? { ...s, order: nextOrder.get(s.id)! } : s))
        .sort((a, b) => a.order - b.order),
    })
    const results = await Promise.all(changed.map(s => supabase.rpc('update_my_lecture_prefs', {
      p_lecture_id: s.id,
      p_color: null,
      p_order: nextOrder.get(s.id)!,
    })))
    const failed = results.find(r => r.error)
    if (failed?.error) {
      set({ subjects: prev })
      fail(failed.error)
    }
  },

  updateLectureSettings: async (id, settings) => {
    const payload: LectureSettings = { ...settings }
    if (payload.title !== undefined) payload.title = payload.title.trim()
    if (payload.professor !== undefined) payload.professor = payload.professor?.trim() || null
    const { data, error } = await supabase.from('lectures').update(payload).eq('id', id).select().single()
    if (error) fail(error)
    const lecture = data as LectureRow
    set(s => ({
      subjects: s.subjects.map(sub => (sub.id === id ? toSubject(lecture, sub.color, sub.order, sub.visible_parties) : sub)),
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
        // 開始日は発生日として参加者全員に共有する
        start_date: task.start_date < task.due_date ? task.start_date : null,
        due_date: task.due_date,
        due_time: task.due_time,
        description: task.description ?? null,
        url: task.url ?? null,
        created_by: userId,
      })
      .select(TASK_COLUMNS)
      .single()
    if (error) fail(error)

    // 追加した本人の進捗・メモ（作業開始日は共有の発生日に従う）
    const state: TaskStateRow = {
      task_id: data.id,
      status: task.status,
      work_start_date: null,
      memo: task.memo,
    }
    const { error: stErr } = await supabase
      .from('task_user_state')
      .update({ status: state.status, work_start_date: state.work_start_date, memo: state.memo })
      .eq('task_id', data.id)
      .eq('user_id', userId)
    if (stErr) fail(stErr)

    set(s => ({ tasks: [...s.tasks, toTask(data as LectureTaskRow, state)] }))
  },

  addRecurringTasks: async (recurrence, subjectId) => {
    const { data, error } = await supabase.rpc('add_lecture_recurring_tasks', {
      p_lecture_id: subjectId,
      p_title: recurrence.title,
      p_start_from: recurrence.start_from,
      p_interval_weeks: recurrence.interval_weeks,
      p_duration_days: recurrence.duration_days,
      p_count: recurrence.count,
    })
    if (error) fail(error)
    // 各回の発生日は RPC が共有の start_date として保存する
    const rows = (data ?? []) as LectureTaskRow[]
    set(s => ({ tasks: [...s.tasks, ...rows.map(r => toTask(r, undefined))] }))
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
    if (updates.start_date !== undefined) {
      // 共有の発生日（なければ締切日）と同じなら上書きを外し、講義の発生日に従う
      const defaultStart = current?.shared_start_date ?? updates.due_date ?? current?.due_date
      personal.work_start_date = updates.start_date === defaultStart ? null : updates.start_date
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
