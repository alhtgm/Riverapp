import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type { Subject, Task, Recurrence, TaskStatus, Profile, Template, TemplateMeta, TemplateItem, TemplateItemDraft } from '../types'
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
  schoolName: string | null
  fetchProfile: () => Promise<void>
  completeOnboarding: (schoolEmail: string, displayName: string) => Promise<void>

  // Templates (学校スコープ共有)
  templates: Template[]
  fetchTemplates: () => Promise<void>
  getTemplateItems: (templateId: string) => Promise<TemplateItem[]>
  importTemplate: (templateId: string) => Promise<void>
  createTemplateFromSubject: (subjectId: string, meta?: TemplateMeta) => Promise<void>
  updateTemplate: (templateId: string, meta: TemplateMeta & { title?: string }, items: TemplateItemDraft[]) => Promise<void>
  applyTemplateUpdate: (templateId: string) => Promise<{ added: number; changed: number; removed: number }>
  dismissTemplateUpdate: (templateId: string) => Promise<void>
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
  schoolName: null,
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
      .select('*, schools(name)')
      .eq('id', user.id)
      .maybeSingle()
    if (error) {
      set({ error: error.message, profileLoaded: true })
      return
    }
    if (!data) {
      set({ profile: null, schoolName: null, profileLoaded: true })
      return
    }
    const row = { ...(data as Record<string, unknown>) }
    const sf = row.schools as { name?: string } | { name?: string }[] | null | undefined
    const sName = Array.isArray(sf) ? (sf[0]?.name ?? null) : (sf?.name ?? null)
    delete row.schools
    set({ profile: row as unknown as Profile, schoolName: sName, profileLoaded: true })
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
      .select('school_id, schools(name)')
      .eq('domain', domain)
      .maybeSingle()
    if (domainErr) throw domainErr
    if (!domainRow) {
      throw new Error(`未対応の学校ドメインです（${domain}）`)
    }
    const sf = (domainRow as Record<string, unknown>).schools as { name?: string } | { name?: string }[] | null | undefined
    const schoolName = Array.isArray(sf) ? (sf[0]?.name ?? null) : (sf?.name ?? null)

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
    set({ profile: data, schoolName, profileLoaded: true })
  },

  fetchTemplates: async () => {
    // RLS で自分の学校のテンプレートだけ返る。件数は埋め込みで取得
    const [tmplRes, importsRes] = await Promise.all([
      supabase
        .from('templates')
        .select('*, template_items(count)')
        .order('created_at', { ascending: false }),
      // 自分の取り込み状況（RLS で自分の行のみ）
      supabase.from('template_imports').select('template_id, applied_version'),
    ])
    if (tmplRes.error) {
      set({ error: tmplRes.error.message })
      return
    }
    const importMap = new Map<string, number>()
    for (const row of importsRes.data ?? []) {
      importMap.set(row.template_id as string, (row.applied_version as number) ?? 1)
    }
    const templates: Template[] = (tmplRes.data ?? []).map((row: Record<string, unknown>) => {
      const items = row.template_items as { count: number }[] | undefined
      const id = row.id as string
      const imported = importMap.has(id)
      return {
        id,
        school_id: row.school_id as string,
        created_by: (row.created_by as string) ?? null,
        title: row.title as string,
        color: row.color as string,
        description: (row.description as string) ?? null,
        professor: (row.professor as string) ?? null,
        department: (row.department as string) ?? null,
        schedule: (row.schedule as string) ?? null,
        import_count: (row.import_count as number) ?? 0,
        version: (row.version as number) ?? 1,
        created_at: row.created_at as string,
        creator_name: (row.creator_name as string) ?? null,
        item_count: items?.[0]?.count ?? 0,
        imported,
        applied_version: imported ? importMap.get(id)! : null,
      }
    })
    set({ templates })
  },

  getTemplateItems: async (templateId) => {
    const { data, error } = await supabase
      .from('template_items')
      .select('*')
      .eq('template_id', templateId)
      .order('sort_order')
    if (error) throw error
    return (data ?? []) as TemplateItem[]
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

    // 課題を自分のタスクとしてコピー（進捗は自分で管理。source_item_id で項目に紐付け）
    const newTasks = (items ?? []).map(it => ({
      user_id: user.id,
      subject_id: subject.id,
      recurrence_id: null,
      row_id: null,
      source_template_id: templateId,
      source_item_id: it.id,
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

  updateTemplate: async (templateId, meta, items) => {
    const clean = (v?: string) => {
      const s = v?.trim()
      return s ? s : null
    }
    // 既存項目の id 集合（残っているものだけ保持し、消えたものは削除）
    const existing = await get().getTemplateItems(templateId)
    const keptIds = new Set(items.filter(i => i.id).map(i => i.id as string))
    const toDelete = existing.filter(e => !keptIds.has(e.id)).map(e => e.id)

    // 既存項目は id を保って更新（取り込み側の紐付けを壊さない）
    const updates = items
      .filter(i => i.id)
      .map((i, idx) =>
        supabase.from('template_items').update({
          title: i.title,
          start_date: i.start_date,
          due_date: i.due_date,
          due_time: i.due_time,
          sort_order: idx,
        }).eq('id', i.id!)
      )
    // 新規項目は挿入
    const inserts = items
      .map((i, idx) => ({ i, idx }))
      .filter(({ i }) => !i.id)
      .map(({ i, idx }) => ({
        template_id: templateId,
        title: i.title,
        start_date: i.start_date,
        due_date: i.due_date,
        due_time: i.due_time,
        sort_order: idx,
      }))

    for (const u of updates) { const { error } = await u; if (error) throw error }
    if (inserts.length > 0) {
      const { error } = await supabase.from('template_items').insert(inserts)
      if (error) throw error
    }
    if (toDelete.length > 0) {
      const { error } = await supabase.from('template_items').delete().in('id', toDelete)
      if (error) throw error
    }

    // メタ情報を更新し、バージョンを上げる（取り込み側に「更新あり」が出る）
    const current = get().templates.find(t => t.id === templateId)
    const nextVersion = (current?.version ?? 1) + 1
    const metaUpdate: Record<string, unknown> = {
      description: clean(meta.description),
      professor: clean(meta.professor),
      department: clean(meta.department),
      schedule: clean(meta.schedule),
      version: nextVersion,
    }
    if (meta.title !== undefined) metaUpdate.title = meta.title.trim() || current?.title
    const { error: tmplErr } = await supabase.from('templates').update(metaUpdate).eq('id', templateId)
    if (tmplErr) throw tmplErr

    await get().fetchTemplates()
  },

  applyTemplateUpdate: async (templateId) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('ログインが必要です')

    const tmpl = get().templates.find(t => t.id === templateId)
    const currentItems = await get().getTemplateItems(templateId)
    const myTasks = get().tasks.filter(t => t.source_template_id === templateId)

    // 取り込み先の科目を決定（無ければ作成）
    let subjectId = myTasks[0]?.subject_id
    let createdSubject: Subject | null = null
    if (!subjectId) {
      const maxOrder = Math.max(0, ...get().subjects.map(s => s.order))
      const { data: subject, error: subErr } = await supabase
        .from('subjects')
        .insert({ user_id: user.id, name: tmpl?.title ?? '講義', color: tmpl?.color ?? '#0891B2', order: maxOrder + 1 })
        .select().single()
      if (subErr) throw subErr
      createdSubject = subject
      subjectId = subject.id
    }

    const byItemId = new Map<string, Task>()
    for (const t of myTasks) if (t.source_item_id) byItemId.set(t.source_item_id, t)
    const usedTaskIds = new Set<string>()

    const differs = (t: Task, i: TemplateItem) =>
      t.title !== i.title || t.start_date !== i.start_date || t.due_date !== i.due_date || t.due_time !== i.due_time

    let added = 0, changed = 0
    const updatedTasks: Task[] = []
    const insertRows: Record<string, unknown>[] = []

    for (const item of currentItems) {
      let task = byItemId.get(item.id)
      // 旧データ（source_item_id 無し）はタイトル一致でひも付けを引き継ぐ
      if (!task) {
        task = myTasks.find(t => !t.source_item_id && t.title === item.title && !usedTaskIds.has(t.id))
      }
      if (task) {
        usedTaskIds.add(task.id)
        if (differs(task, item) || task.source_item_id !== item.id) {
          const { data, error } = await supabase
            .from('tasks')
            .update({
              title: item.title,
              start_date: item.start_date,
              due_date: item.due_date,
              due_time: item.due_time,
              source_item_id: item.id,
            })
            .eq('id', task.id)
            .select().single()
          if (error) throw error
          updatedTasks.push(data)
          if (differs(task, item)) changed++
        }
      } else {
        insertRows.push({
          user_id: user.id,
          subject_id: subjectId,
          recurrence_id: null,
          row_id: null,
          source_template_id: templateId,
          source_item_id: item.id,
          title: item.title,
          start_date: item.start_date,
          due_date: item.due_date,
          due_time: item.due_time,
          status: 'todo',
          memo: null,
        })
        added++
      }
    }

    // テンプレートから削除された項目に対応するタスクを削除（source_item_id がある＝テンプレ由来のみ）
    const currentItemIds = new Set(currentItems.map(i => i.id))
    const removeTasks = myTasks.filter(
      t => t.source_item_id && !currentItemIds.has(t.source_item_id) && !usedTaskIds.has(t.id)
    )
    const removed = removeTasks.length

    let insertedTasks: Task[] = []
    if (insertRows.length > 0) {
      const { data, error } = await supabase.from('tasks').insert(insertRows).select()
      if (error) throw error
      insertedTasks = data
    }
    if (removeTasks.length > 0) {
      const { error } = await supabase.from('tasks').delete().in('id', removeTasks.map(t => t.id))
      if (error) throw error
    }

    // 適用済みバージョンを更新
    await supabase
      .from('template_imports')
      .update({ applied_version: tmpl?.version ?? 1 })
      .eq('template_id', templateId)
      .eq('user_id', user.id)

    // ストア更新
    const updatedMap = new Map(updatedTasks.map(t => [t.id, t]))
    const removedIds = new Set(removeTasks.map(t => t.id))
    set(s => ({
      subjects: createdSubject ? [...s.subjects, createdSubject] : s.subjects,
      tasks: [
        ...s.tasks.filter(t => !removedIds.has(t.id)).map(t => updatedMap.get(t.id) ?? t),
        ...insertedTasks,
      ],
    }))
    await get().fetchTemplates()
    return { added, changed, removed }
  },

  dismissTemplateUpdate: async (templateId) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('ログインが必要です')
    const tmpl = get().templates.find(t => t.id === templateId)
    await supabase
      .from('template_imports')
      .update({ applied_version: tmpl?.version ?? 1 })
      .eq('template_id', templateId)
      .eq('user_id', user.id)
    set(s => ({
      templates: s.templates.map(t =>
        t.id === templateId ? { ...t, applied_version: t.version } : t
      ),
    }))
  },

  deleteTemplate: async (templateId) => {
    const { error } = await supabase.from('templates').delete().eq('id', templateId)
    if (error) throw error
    set(s => ({ templates: s.templates.filter(t => t.id !== templateId) }))
  },

  signOut: async () => {
    await supabase.auth.signOut()
    set({ profile: null, profileLoaded: false, schoolName: null, subjects: [], tasks: [], templates: [] })
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
