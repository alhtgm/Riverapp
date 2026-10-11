// 上限値（spec-friends-party.md 0章）。DB 側の正は 20261008180050_limits.sql。
// 画面の表示・入力の選択肢に使う。
export const LIMITS = {
  partyMaxMembers: 20,
  userMaxParties: 10,
  lectureMaxParticipants: 200,
  applyRequestTtlDays: 14,
  exclusionVoteTtlDays: 7,
} as const

/** 招待コードの有効期限の選択肢（Postgres interval 文字列）。既定は24時間 */
export const INVITE_CODE_TTLS = [
  { label: '1時間', value: '1 hour' },
  { label: '24時間', value: '24 hours' },
  { label: '7日', value: '7 days' },
] as const
export const DEFAULT_INVITE_CODE_TTL = '24 hours'

/** 招待コードの使用回数上限の選択肢。既定は5回 */
export const INVITE_CODE_MAX_USES = [1, 5, 20] as const
export const DEFAULT_INVITE_CODE_MAX_USES = 5
