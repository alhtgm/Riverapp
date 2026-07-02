import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type { Subject, Task, Recurrence, TaskStatus, Profile, Template, TemplateMeta } from '../types'
import { toDateString } from '../types'
import { getStoredTheme, applyTheme, type ThemeMode } from '../lib/theme'

interface AppState {
  subjects: Subject[]
  tasks: Task[]
  loading: boolean
  error: string | null

  // Account / profile
  profile: Profile | null
  profileLoaded: boolean
  fetchProfile: () => Promise<void>
  completeOnboarding: (schoolEmail: string, displayName: string) => Promise<void>

  // Templates (学校スコープ共有)
  templates: Template[]
  fetchTemplates: () => Promise<void>
  importTemplate: (templateId: string) => Promise<void>
  createTemplateFromSubject: (subjectId: string, meta?: TemplateMeta) => Promise<void>
  deleteTemplate: (templateId: string) => Promise<void>

  // Theme
  isDark: boolean
  toggleTheme: () => void

  fetchAll: () => Promise<void>
  signOut: () => Promise<void>

  // Subject
  addSubject: (name: string, color: string) => Promise<void>
  updateSubject: (id: string, updates: Partial<Pick<Subject, 'name' | 'color' | 'order'>>) => Promise<void>
  deleteSubject: (id: string) => Promise<void>

  // Task
  addTask: (task: Omit<Task, 'id' | 'user_id' | 'created_at'>) => Promise<void>
  addRecurringTasks: (
    recurrence: Omit<Recurrence, 'id' | 'user_id' | 'created_at'>,
    subjectId: string
  ) => Promise<void>
  updateTask: (id: string, updates: Partial<Pick<Task, 'title' | 'status' | 'start_date' | 'due_date' | 'due_time' | 'memo' | 'subject_id'>>) => Promise<void>
  updateTasksFromRecurrence: (
    recurrenceId: string,
    fromDate: string,
    updates: Partial<Pick<Task, 'title' | 'status' | 'memo'>>
  ) => Promise<void>
  deleteTask: (id: string) => Promise<void>
  deleteTasksFromRecurrence: (recurrenceId: string, fromDate: string) => Promise<void>
}

export const useStore = create<AppState>((set, get) => ({
  subjects: [],
  tasks: [],
  loading: false,
  error: null,

  profile: null,
  profileLoaded: false,
  templates: [],

  isDark: getStoredTheme() === 'dark',
  toggleTheme: () => {
    const next: ThemeMode = get().isDark ? 'light' : 'dark'
    applyTheme(next)
    set({ isDark: next === 'dark' })
  },

  fetchProfile: async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      set({ profile: null, profileLoaded: true })
      return
    }
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle()
    if (error) {
      set({ error: error.message, profileLoaded: true })
      return
    }
    set({ profile: data ?? null, profileLoaded: true })
  },

  completeOnboarding: async (schoolEmail, displayName) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('ログインが必要です')

    const email = schoolEmail.trim().toLowerCase()
    const name = displayName.trim()
    const domain = email.split('@')[1] ?? ''
    if (!domain) throw new Error('メールアドレスの形式が正しくありません')
    if (!name) throw new Error('表示名を入力してください')

    // ドメインを許可リストと照合して学校を特定
    const { data: domainRow, error: domainErr } = await supabase
      .from('school_domains')
      .select('school_id')
      .eq('domain', domain)
      .maybeSingle()
    if (domainErr) throw domainErr
    if (!domainRow) {
      throw new Error(`未対応の学校ドメインです（${domain}）`)
    }

    const { data, error } = await supabase
      .from('profiles')
      .insert({
        id: user.id,
        school_email: email,
        school_id: domainRow.school_id,
        display_name: name,
      })
      .select()
      .single()
    if (error) throw error
    set({ profile: data, profileLoaded: true })
  },

  fetchTemplates: async () => {
    // RLS で自分の学校のテンプレートだけ返る。件数は埋め込みで取得
    const { data, error } = await supabase
      .from('templates')
      .select('*, template_items(count)')
      .order('created_at', { ascending: false })
    if (error) {
      set({ error: error.message })
      return
    }
    const templates: Template[] = (data ?? []).map((row: Record<string, unknown>) => {
      const items = row.template_items as { count: number }[] | undefined
      return {
        id: row.id as string,
        school_id: row.school_id as string,
        created_by: (row.created_by as string) ?? null,
        title: row.title as string,
        color: row.color as string,
        description: (row.description as string) ?? null,
        professor: (row.professor as string) ?? null,
        department: (row.department as string) ?? null,
        schedule: (row.schedule as string) ?? null,
        import_count: (row.import_count as number) ?? 0,
        created_at: row.created_at as string,
        creator_name: (row.creator_name as string) ?? null,
        item_count: items?.[0]?.count ?? 0,
      }
    })
    set({ templates })
  },

  importTemplate: async (templateId) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('ログインが必要です')

    // テンプレート本体と課題を取得
    const tmpl = get().templates.find(t => t.id === templateId)
    const { data: items, error: itemsErr } = await supabase
      .from('template_items')
      .select('*')
      .eq('template_id', templateId)
      .order('sort_order')
    if (itemsErr) throw itemsErr

    const title = tmpl?.title ?? '取り込んだ講義'
    const color = tmpl?.color ?? '#0891B2'

    // 取り込み先の科目を新規作成
    const maxOrder = Math.max(0, ...get().subjects.map(s => s.order))
    const { data: subject, error: subErr } = await supabase
      .from('subjects')
      .insert({ user_id: user.id, name: title, color, order: maxOrder + 1 })
      .select()
      .single()
    if (subErr) throw subErr

    // 課題を自分のタスクとしてコピー（元と切り離し、source_template_id だけ保持）
    const newTasks = (items ?? []).map(it => ({
      user_id: user.id,
      subject_id: subject.id,
      recurrence_id: null,
      row_id: null,
      source_template_id: templateId,
      title: it.title,
      start_date: it.start_date,
      due_date: it.due_date,
      due_time: it.due_time,
      status: 'todo' as TaskStatus,
      memo: null,
    }))

    let insertedTasks: Task[] = []
    if (newTasks.length > 0) {
      const { data: tasksData, error: tasksErr } = await supabase
        .from('tasks')
        .insert(newTasks)
        .select()
      if (tasksErr) throw tasksErr
      insertedTasks = tasksData
    }

    // 取り込み記録（ユニーク人数。同じ人の2回目以降は加算されない）
    await supabase.rpc('import_template_once', { p_template_id: templateId })

    set(s => ({
      subjects: [...s.subjects, subject],
      tasks: [...s.tasks, ...insertedTasks],
    }))
    // 正確なユニーク人数を反映するため再取得
    await get().fetchTemplates()
  },

  createTemplateFromSubject: async (subjectId, meta) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('ログインが必要です')
    const profile = get().profile
    if (!profile?.school_id) throw new Error('学校が設定されていません')

    const subject = get().subjects.find(s => s.id === subjectId)
    if (!subject) throw new Error('科目が見つかりません')
    const subjectTasks = get().tasks.filter(t => t.subject_id === subjectId)
    if (subjectTasks.length === 0) throw new Error('この科目には課題がありません')

    const clean = (v?: string) => {
      const s = v?.trim()
      return s ? s : null
    }

    // テンプレート本体
    const { data: tmpl, error: tmplErr } = await supabase
      .from('templates')
      .insert({
        school_id: profile.school_id,
        created_by: user.id,
        creator_name: profile.display_name,
        title: subject.name,
        color: subject.color,
        description: clean(meta?.description),
        professor: clean(meta?.professor),
        department: clean(meta?.department),
        schedule: clean(meta?.schedule),
      })
      .select()
      .single()
    if (tmplErr) throw tmplErr

    // 課題を items としてコピー
    const items = subjectTasks
      .slice()
      .sort((a, b) => (a.start_date < b.start_date ? -1 : 1))
      .map((t, i) => ({
        template_id: tmpl.id,
        title: t.title,
        start_date: t.start_date,
        due_date: t.due_date,
        due_time: t.due_time,
        sort_order: i,
      }))
    const { error: itemsErr } = await supabase.from('template_items').insert(items)
    if (itemsErr) throw itemsErr

    await get().fetchTemplates()
  },

  deleteTemplate: async (templateId) => {
    const { error } = await supabase.from('templates').delete().eq('id', templateId)
    if (error) throw error
    set(s => ({ templates: s.templates.filter(t => t.id !== templateId) }))
  },

  signOut: async () => {
    await supabase.auth.signOut()
    set({ profile: null, profileLoaded: false, subjects: [], tasks: [], templates: [] })
  },

  fetchAll: async () => {
    set({ loading: true, error: null })
    try {
      const [subRes, taskRes] = await Promise.all([
        supabase.from('subjects').select('*').order('"order"'),
        supabase.from('tasks').select('*').order('start_date'),
      ])
      if (subRes.error) throw subRes.error
      if (taskRes.error) throw taskRes.error

      const allTasks: Task[] = taskRes.data

      // Auto-cleanup: delete rows where the last task's due_date is > 30 days ago
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const cutoff = new Date(today)
      cutoff.setDate(cutoff.getDate() - 30)
      const cutoffStr = toDateString(cutoff)

      const rowGroups = new Map<string, Task[]>()
      for (const t of allTasks) {
        const key = t.recurrence_id ?? t.id
        const arr = rowGroups.get(key) ?? []
        arr.push(t)
        rowGroups.set(key, arr)
      }
      const toDelete: string[] = []
      for (const [, rowTasks] of rowGroups) {
        const lastDue = rowTasks.reduce((max, t) => (t.due_date > max ? t.due_date : max), '')
        if (lastDue < cutoffStr) {
          toDelete.push(...rowTasks.map(t => t.id))
        }
      }
      let finalTasks = allTasks
      if (toDelete.length > 0) {
        await supabase.from('tasks').delete().in('id', toDelete)
        finalTasks = allTasks.filter(t => !toDelete.includes(t.id))
      }

      set({ subjects: subRes.data, tasks: finalTasks, loading: false })
    } catch (e: unknown) {
      set({ error: (e as Error).message, loading: false })
    }
  },

  addSubject: async (name, color) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const maxOrder = Math.max(0, ...get().subjects.map(s => s.order))
    const { data, error } = await supabase
      .from('subjects')
      .insert({ user_id: user.id, name, color, order: maxOrder + 1 })
      .select()
      .single()
    if (error) throw error
    set(s => ({ subjects: [...s.subjects, data] }))
  },

  updateSubject: async (id, updates) => {
    const { data, error } = await supabase
      .from('subjects')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    set(s => ({ subjects: s.subjects.map(sub => sub.id === id ? data : sub) }))
  },

  deleteSubject: async (id) => {
    const { error } = await supabase.from('subjects').delete().eq('id', id)
    if (error) throw error
    set(s => ({
      subjects: s.subjects.filter(sub => sub.id !== id),
      tasks: s.tasks.filter(t => t.subject_id !== id),
    }))
  },

  addTask: async (task) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data, error } = await supabase
      .from('tasks')
      .insert({ ...task, user_id: user.id })
      .select()
      .single()
    if (error) throw error
    set(s => ({ tasks: [...s.tasks, data] }))
  },

  addRecurringTasks: async (recurrence, subjectId) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Create recurrence rule
    const { data: recData, error: recErr } = await supabase
      .from('recurrences')
      .insert({ ...recurrence, user_id: user.id, subject_id: subjectId })
      .select()
      .single()
    if (recErr) throw recErr

    // Generate tasks
    const tasks = []
    const [y, m, d] = recurrence.start_from.split('-').map(Number)
    for (let i = 0; i < recurrence.count; i++) {
      const startDate = new Date(y, m - 1, d + i * recurrence.interval_weeks * 7)
      const dueDate = new Date(startDate)
      dueDate.setDate(dueDate.getDate() + recurrence.duration_days)
      tasks.push({
        user_id: user.id,
        subject_id: subjectId,
        recurrence_id: recData.id,
        title: recurrence.title,
        start_date: toDateString(startDate),
        due_date: toDateString(dueDate),
        status: 'todo' as TaskStatus,
        memo: null,
      })
    }

    const { data: tasksData, error: tasksErr } = await supabase
      .from('tasks')
      .insert(tasks)
      .select()
    if (tasksErr) throw tasksErr
    set(s => ({ tasks: [...s.tasks, ...tasksData] }))
  },

  updateTask: async (id, updates) => {
    const { data, error } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    set(s => ({ tasks: s.tasks.map(t => t.id === id ? data : t) }))
  },

  deleteTask: async (id) => {
    const { error } = await supabase.from('tasks').delete().eq('id', id)
    if (error) throw error
    set(s => ({ tasks: s.tasks.filter(t => t.id !== id) }))
  },

  updateTasksFromRecurrence: async (recurrenceId, fromDate, updates) => {
    const { error } = await supabase
      .from('tasks')
      .update(updates)
      .eq('recurrence_id', recurrenceId)
      .gte('start_date', fromDate)
    if (error) throw error
    set(s => ({
      tasks: s.tasks.map(t =>
        t.recurrence_id === recurrenceId && t.start_date >= fromDate
          ? { ...t, ...updates }
          : t
      ),
    }))
  },

  deleteTasksFromRecurrence: async (recurrenceId, fromDate) => {
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('recurrence_id', recurrenceId)
      .gte('start_date', fromDate)
    if (error) throw error
    set(s => ({
      tasks: s.tasks.filter(
        t => !(t.recurrence_id === recurrenceId && t.start_date >= fromDate)
      ),
    }))
  },
}))
