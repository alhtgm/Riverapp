import { supabase } from './supabase'
import { toMessage } from './errors'

/** 開発者へのメッセージの種類 */
export type FeedbackCategory = 'bug' | 'request' | 'other'
export const FEEDBACK_CATEGORY_LABEL: Record<FeedbackCategory, string> = {
  bug: 'バグ報告',
  request: '要望',
  other: 'その他',
}

export type FeedbackStatus = 'open' | 'in_progress' | 'done'
export const FEEDBACK_STATUS_LABEL: Record<FeedbackStatus, string> = {
  open: '未対応',
  in_progress: '対応中',
  done: '完了',
}

export const FEEDBACK_MAX_LENGTH = 2000

async function call<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw new Error(toMessage(error))
  return data as T
}

/** 開発者にメッセージを送る。調べやすいように、アプリのバージョンと端末の情報も一緒に送る */
export function submitFeedback(category: FeedbackCategory, body: string): Promise<string> {
  const context = {
    version: __APP_VERSION__,
    user_agent: navigator.userAgent,
    screen: `${window.innerWidth}x${window.innerHeight}`,
    theme: document.documentElement.dataset.theme ?? null,
  }
  return call<string>('submit_feedback', { p_category: category, p_body: body, p_context: context })
}

/** 自分が管理者か（設定に管理者画面への入口を出すかどうか） */
export function fetchIsAdmin(): Promise<boolean> {
  return call<boolean>('is_admin')
}

// ─── 管理者画面 ─────────────────────────────────────────

export interface AdminStats {
  users_total: number
  users_new_7d: number
  users_active_7d: number
  lectures_total: number
  tasks_total: number
  tasks_new_7d: number
  feedback_open: number
  feedback_in_progress: number
  users_suspended: number
}

export interface AdminFeedback {
  id: string
  user_id: string | null
  display_name: string | null
  handle: string | null
  category: FeedbackCategory
  body: string
  context: Record<string, unknown>
  status: FeedbackStatus
  admin_note: string | null
  created_at: string
  updated_at: string
  reply_count: number
}

export interface AdminFeedbackReply {
  id: string
  body: string
  admin_name: string | null
  created_at: string
}

export interface AdminUser {
  id: string
  display_name: string
  handle: string
  school_name: string | null
  created_at: string
  last_sign_in_at: string | null
  lecture_count: number
  feedback_count: number
  is_admin: boolean
  suspended_at: string | null
  suspended_reason: string | null
  total_count: number
}

export interface AdminAnnouncement {
  id: string
  title: string
  body: string
  sender_name: string | null
  recipients: number
  created_at: string
}

export const adminApi = {
  stats: () => call<AdminStats>('admin_stats'),
  listFeedback: (status: FeedbackStatus | null) => call<AdminFeedback[]>('admin_list_feedback', { p_status: status }),
  feedbackReplies: (feedbackId: string) => call<AdminFeedbackReply[]>('admin_feedback_replies', { p_feedback_id: feedbackId }),
  updateFeedback: (id: string, status: FeedbackStatus, note: string) =>
    call<void>('admin_update_feedback', { p_id: id, p_status: status, p_note: note }),
  replyFeedback: (id: string, body: string) => call<void>('admin_reply_feedback', { p_id: id, p_body: body }),
  listUsers: (query: string, limit: number, offset: number) =>
    call<AdminUser[]>('admin_list_users', { p_query: query, p_limit: limit, p_offset: offset }),
  setSuspended: (userId: string, suspended: boolean, reason?: string) =>
    call<void>('admin_set_suspended', { p_user_id: userId, p_suspended: suspended, p_reason: reason ?? null }),
  sendAnnouncement: (title: string, body: string) => call<number>('admin_send_announcement', { p_title: title, p_body: body }),
  listAnnouncements: () => call<AdminAnnouncement[]>('admin_list_announcements'),
}
