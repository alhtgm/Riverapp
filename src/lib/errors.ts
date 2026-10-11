// Supabase / RPC のエラーメッセージを画面表示用の日本語に変換する
const MESSAGES: Record<string, string> = {
  'not authenticated': 'ログインが必要です',
  'not visible': 'この講義は表示できません',
  'lecture not found': '講義が見つかりません',
  'lecture is full': 'この講義は参加人数の上限に達しています',
  'this lecture requires an application': 'この講義は参加申請が必要です',
  'this lecture does not require an application': 'この講義は申請なしで参加できます',
  'already a participant': 'すでに参加しています',
  'excluded from this lecture': 'この講義には参加できません',
  'request already pending': 'すでに申請中です',
  'request not pending': 'この申請はすでに処理されています',
  'request expired': 'この申請は期限切れです',
  'not a participant': 'この講義に参加していません',
  'not a participant of this lecture': 'この講義に参加していません',
  'too many parties': '所属できるパーティーの上限に達しています',
  'party is full': 'パーティーの人数が上限に達しています',
  'not a member of this party': 'このパーティーのメンバーではありません',
  'not a member': 'メンバーではありません',
  'already a member': 'すでにメンバーです',
  'already invited': 'すでに招待しています',
  'not friends': 'フレンドだけを招待できます',
  'excluded from this party': 'このパーティーには参加できません',
  'invalid or expired code': '招待コードが無効か、期限切れです',
  'invite not found': '招待が見つかりません',
  'party not found': 'パーティーが見つかりません',
  'cannot invite yourself': '自分は招待できません',
  'cannot friend yourself': '自分にはフレンド申請できません',
  'user not found': 'ユーザーが見つかりません',
  'request not found': '申請が見つかりません',
  'cannot vote on yourself': '自分を対象にした投票はできません',
  'cannot vote on your own exclusion': '自分を対象にした投票はできません',
  'target is not an active member': '対象の人はメンバーではありません',
  'target is not excluded': '対象の人は除外されていません',
  'vote not open': 'この投票は終了しています',
  'invalid count': '回数は1〜52回で指定してください',
}

export function toMessage(e: unknown): string {
  const raw =
    e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : String(e)
  if (MESSAGES[raw]) return MESSAGES[raw]
  if (raw.includes('profiles_handle_lower_idx') || (raw.includes('duplicate key') && raw.includes('handle'))) {
    return 'このユーザーIDはすでに使われています'
  }
  if (raw.includes('profiles_handle_format')) {
    return 'ユーザーIDは英数字とアンダースコアで3〜20文字にしてください'
  }
  if (raw.includes('exclusion_votes_open_idx')) return 'この人への投票はすでに進行中です'
  return raw
}
