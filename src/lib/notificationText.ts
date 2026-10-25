import { VISIBILITY_LABEL, formatDate, type AppNotification, type LectureVisibility, type Subject, type UserSummary } from '../types'

/** 通知の文面（通知一覧とリアルタイムのトーストで共通） */
export function describeNotification(
  n: Pick<AppNotification, 'type' | 'payload'>,
  users: Record<string, UserSummary>,
  subjects: Pick<Subject, 'id' | 'name'>[],
): string {
  const p = n.payload
  const name = (id: unknown) => (typeof id === 'string' && users[id] ? users[id].display_name : 'ユーザー')
  const subjectName = subjects.find(s => s.id === p.lecture_id)?.name
  // 締切変更の通知の title は課題名なので、講義名は参加中の講義から引く
  const lectureTitle = String((isTaskNotice(n) ? subjectName : p.title ?? subjectName) ?? '講義')
  switch (n.type) {
    case 'friend_request': return `${name(p.requester_id)}さんからフレンド申請が届きました`
    case 'friend_accepted': return `${name(p.addressee_id)}さんがフレンド申請を承認しました`
    case 'party_invite': return `${name(p.inviter_id)}さんから${p.party_name ? `「${String(p.party_name)}」` : 'パーティー'}に招待されました`
    case 'lecture_apply_request': return `「${lectureTitle}」に${name(p.applicant_id)}さんから参加申請が届きました`
    case 'lecture_apply_response': return `「${lectureTitle}」への参加申請が${p.approved ? '承認' : '却下'}されました`
    case 'task_due_changed':
      return `「${lectureTitle}」の課題「${String(p.title ?? '')}」の締切が${formatDate(String(p.old_due_date))}から${formatDate(String(p.new_due_date))}に変わりました`
    case 'task_added':
      return typeof p.count === 'number'
        ? `「${lectureTitle}」に課題「${String(p.title ?? '')}」（全${p.count}回）が追加されました`
        : `「${lectureTitle}」に課題「${String(p.title ?? '')}」（締切${formatDate(String(p.due_date))}）が追加されました`
    case 'lecture_visibility_changed':
      return `「${lectureTitle}」の公開範囲が「${VISIBILITY_LABEL[p.old_visibility as LectureVisibility] ?? ''}」から「${VISIBILITY_LABEL[p.new_visibility as LectureVisibility] ?? ''}」に変わりました`
    case 'feedback_reply': return `開発者に送ったメッセージ「${String(p.original ?? '')}」に返事が届きました`
    case 'announcement': return `運営からのお知らせ: ${String(p.title ?? '')}`
    case 'handle_reassigned':
      return `ユーザーIDが @${String(p.old_handle ?? '')} から @${String(p.new_handle ?? '')} に変わりました（フレンドやパーティーはそのままです）`
    default: return 'お知らせがあります'
  }
}

/** 文面のあるお知らせ（運営からのお知らせ・開発者からの返事）。受信箱ではカードで出す。ほかの通知は1行で足りる */
export function isMessageNotice(n: Pick<AppNotification, 'type'>): boolean {
  return n.type === 'announcement' || n.type === 'feedback_reply'
}

/** 講義の課題についての通知（課題の追加・締切の変更）。受信箱ではカードで出す。title は課題名 */
export function isTaskNotice(n: Pick<AppNotification, 'type'>): boolean {
  return n.type === 'task_added' || n.type === 'task_due_changed'
}

/** 通知に出てくるユーザーID（名前の取得用） */
export function notificationUserIds(n: Pick<AppNotification, 'payload'>): string[] {
  return ['requester_id', 'addressee_id', 'inviter_id', 'applicant_id', 'actor_id']
    .map(k => n.payload[k])
    .filter((v): v is string => typeof v === 'string')
}
