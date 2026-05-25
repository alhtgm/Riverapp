import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type { Subject, Task, Recurrence, TaskStatus } from '../types'
import { toDateString } from '../types'
import { getStoredTheme, applyTheme, type ThemeMode } from '../lib/theme'

interface AppState {
  subjects: Subject[]
  tasks: Task[]
  loading: boolean
  error: string | null

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

  isDark: getStoredTheme() === 'dark',
  toggleTheme: () => {
    const next: ThemeMode = get().isDark ? 'light' : 'dark'
    applyTheme(next)
    set({ isDark: next === 'dark' })
  },

  signOut: async () => {
    await supabase.auth.signOut()
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
