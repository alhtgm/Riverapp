export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'submitted'

export interface Profile {
  id: string
  school_email: string | null
  school_email_verified: boolean
  school_id: string | null
  display_name: string
  handle: string | null
  created_at: string
}

export type LectureTerm = 'spring' | 'fall' | 'full_year' | 'other'
export type LectureVisibility = 'private' | 'party' | 'friends' | 'public'

export const TERM_LABEL: Record<LectureTerm, string> = {
  spring: '前期',
  fall: '後期',
  full_year: '通年',
  other: 'その他',
}

export const VISIBILITY_LABEL: Record<LectureVisibility, string> = {
  private: '公開しない',
  party: 'パーティー内',
  friends: 'フレンドまで',
  public: '全体',
}

/**
 * タイムライン上の「科目」= 自分が参加している講義。
 * color / order は自分専用の表示設定（lecture_participants）。
 */
export interface Subject {
  id: string // lecture_id
  name: string
  color: string
  order: number
  year: number
  term: LectureTerm
  professor: string | null
  visibility: LectureVisibility
  apply_open: boolean
  /** 講義を作った人 */
  created_by: string | null
  created_at: string
  /** 講義を見せているパーティー。name は自分が所属していないパーティーだと null */
  visible_parties: { id: string; name: string | null }[]
}

export interface Recurrence {
  title: string
  start_from: string // YYYY-MM-DD
  interval_weeks: number
  duration_days: number
  count: number
}

/**
 * タイムライン上の課題 = 講義の共有課題（lecture_tasks）＋ 自分の個人項目（task_user_state）。
 * 共有: title / 発生日 / due_date / due_time / description / url
 * 個人: status / start_date（作業開始日。本人が変えていなければ共有の発生日、それもなければ締切日）/ memo
 */
export interface Task {
  id: string
  subject_id: string // lecture_id
  recurrence_id: string | null
  title: string
  start_date: string // YYYY-MM-DD
  due_date: string   // YYYY-MM-DD
  due_time: string | null // HH:MM (optional)
  status: TaskStatus
  memo: string | null
  description: string | null
  url: string | null
  /** 講義で共有している発生日（未設定なら null）。start_date をこの日にすると本人の上書きを外す */
  shared_start_date: string | null
  /** バーが期間として表示されるか（false なら締切だけが表示される） */
  has_work_period: boolean
  created_at: string
}

export type SharedTaskField = 'title' | 'due_date' | 'due_time' | 'description' | 'url' | 'subject_id'
export type PersonalTaskField = 'status' | 'start_date' | 'memo'

// ---- フレンド・パーティー ----

export interface UserSummary {
  id: string
  handle: string | null
  display_name: string
}

export interface FriendRequest {
  id: string
  requester_id: string
  addressee_id: string
  status: 'pending' | 'accepted'
  created_at: string
}

export interface Party {
  id: string
  name: string
  created_at: string
}

export interface PartyMember {
  party_id: string
  user_id: string
  status: 'active' | 'left' | 'excluded'
  joined_at: string
}

export interface PartyInvite {
  id: string
  party_id: string
  party_name: string
  member_count: number
  inviter_id: string
  created_at: string
}

export interface PartyInviteCode {
  id: string
  party_id: string
  code: string
  created_by: string | null
  expires_at: string
  max_uses: number
  use_count: number
  revoked_at: string | null
  created_at: string
}

export type JoinStatus = 'participant' | 'pending' | 'excluded' | 'none'

export interface LectureSummary {
  id: string
  title: string
  year: number
  term: LectureTerm
  professor: string | null
  visibility: LectureVisibility
  apply_open: boolean
  participant_count: number
  party_member_count: number | null
  my_status: JoinStatus
}

/** 自分が参加している講義に届いている参加申請（受信箱・講義画面から承認する） */
export interface ApplyRequest {
  id: string
  lecture_id: string
  lecture_title: string
  user_id: string
  display_name: string | null
  handle: string | null
  created_at: string
  expires_at: string
}

export interface LectureParticipant {
  lecture_id: string
  user_id: string
  status: 'active' | 'left' | 'excluded'
  joined_at: string
}

export interface ApplyRequest {
  id: string
  user_id: string
  display_name: string | null
  handle: string | null
  created_at: string
  expires_at: string
}

export interface OpenVote {
  id: string
  target_user_id: string
  kind: 'exclude' | 'unexclude'
  ballots: number
  needed: number
  i_voted: boolean
  expires_at: string
}

export interface ActivityLogEntry {
  id: string
  target_type: string
  target_id: string
  action: string
  actor_id: string | null
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
  created_at: string
}

export interface AppNotification {
  id: string
  type: string
  payload: Record<string, unknown>
  read_at: string | null
  created_at: string
}

export interface ProgressPerson {
  userId: string | null
  /** 参加者以外が見る場合や、ブロック関係にある相手は null（人数だけ数える） */
  name: string | null
}

/** 課題ごとの進捗（ステータスごとの人） */
export type TaskProgress = Record<TaskStatus, ProgressPerson[]>

export function emptyProgress(): TaskProgress {
  return { todo: [], in_progress: [], done: [], submitted: [] }
}

/**
 * ステータスの色。値は CSS 変数（index.css で標準の色、設定のテーマカラーで上書き）。
 * ライト/ダークは CSS 側で切り替わるので、color と darkColor は同じ値を指す。
 * 透明度をつけるときは `${color}22` ではなく withAlpha() を使う。
 */
const statusVars = (key: string) => ({ color: `var(--st-${key})`, bg: `var(--st-${key}-bg)`, darkColor: `var(--st-${key})`, darkBg: `var(--st-${key}-bg)` })

export const STATUS_CONFIG: Record<
  TaskStatus | 'overdue',
  { label: string; color: string; bg: string; darkColor: string; darkBg: string }
> = {
  todo:        { label: '未着手',   ...statusVars('todo') },
  in_progress: { label: '進行中',   ...statusVars('progress') },
  done:        { label: '完了',     ...statusVars('done') },
  submitted:   { label: '提出済み', ...statusVars('submitted') },
  overdue:     { label: '期限切れ', ...statusVars('overdue') },
}

/** 色（CSS 変数でも可）に透明度をつける。alpha は 16 進 2 桁（'22' など、旧来の `${color}22` と同じ意味） */
export function withAlpha(color: string, alpha: string): string {
  return `color-mix(in srgb, ${color} ${Math.round((parseInt(alpha, 16) / 255) * 100)}%, transparent)`
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
