import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { toMessage } from '../lib/errors'
import type { AppNotification, ApplyRequest, FriendRequest, Party, PartyInvite, UserSummary } from '../types'
import { notificationUserIds } from '../lib/notificationText'

export interface PartyWithCount extends Party {
  member_count: number
}

function fail(error: unknown): never {
  throw new Error(toMessage(error))
}

interface SocialState {
  loaded: boolean
  myId: string | null
  /** 承認済みのフレンド（request id 付き。解除はこの id の行を削除する） */
  friends: { requestId: string; userId: string }[]
  incoming: FriendRequest[]
  outgoing: FriendRequest[]
  blockedIds: string[]
  parties: PartyWithCount[]
  invites: PartyInvite[]
  /** 自分が参加している講義に届いている参加申請（すべての講義分） */
  applyRequests: ApplyRequest[]
  notifications: AppNotification[]
  /** 表示名・@handle のキャッシュ */
  users: Record<string, UserSummary>
  /** 読み直すたびに増える番号。画面ごとに持っている一覧（メンバー・講義など）の再読み込みに使う */
  version: number

  fetchSocial: () => Promise<void>
  ensureUsers: (ids: (string | null | undefined)[]) => Promise<void>
  searchByHandle: (handle: string) => Promise<UserSummary | null>

  sendFriendRequest: (userId: string) => Promise<'sent' | 'accepted' | 'already'>
  acceptFriendRequest: (requestId: string) => Promise<void>
  /** 申請の拒否・取り下げ、フレンド解除（いずれも行削除。相手には通知しない） */
  removeFriendRequest: (requestId: string) => Promise<void>
  block: (userId: string) => Promise<void>
  unblock: (userId: string) => Promise<void>

  createParty: (name: string) => Promise<Party>
  redeemInviteCode: (code: string) => Promise<Party>
  respondPartyInvite: (inviteId: string, accept: boolean) => Promise<void>
  /** 講義への参加申請に返事をする（複数をまとめて渡せる。失敗した件数を返す） */
  respondApplyRequests: (requestIds: string[], approve: boolean) => Promise<number>

  markAllNotificationsRead: () => Promise<void>
  /**
   * フレンド・パーティー・参加申請の変化をリアルタイムで受け取り、自動で読み直す。
   * 新しい通知が届くと onNotification を呼ぶ。戻り値で購読を止める
   */
  subscribeRealtime: (onNotification: (n: AppNotification) => void) => () => void
}

export const useSocialStore = create<SocialState>((set, get) => ({
  loaded: false,
  myId: null,
  friends: [],
  incoming: [],
  outgoing: [],
  blockedIds: [],
  parties: [],
  invites: [],
  applyRequests: [],
  notifications: [],
  users: {},
  version: 0,

  fetchSocial: async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const myId = user.id

    // 期限切れの申請・投票を失効させる（pg_cron を使わない代わりに画面表示時に実行）
    void supabase.rpc('expire_stale_requests_and_votes')

    const [frRes, blockRes, partyRes, memberRes, inviteRes, notifRes, applyRes] = await Promise.all([
      supabase.from('friend_requests').select('*'),
      supabase.from('blocks').select('blocked_id'),
      supabase.from('parties').select('id, name, created_at').is('archived_at', null).order('created_at'),
      supabase.from('party_members').select('party_id, user_id').eq('status', 'active'),
      supabase.rpc('get_my_party_invites'),
      supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(50),
      supabase.rpc('get_my_pending_apply_requests'),
    ])

    const requests = (frRes.data ?? []) as FriendRequest[]
    const friends = requests
      .filter(r => r.status === 'accepted')
      .map(r => ({ requestId: r.id, userId: r.requester_id === myId ? r.addressee_id : r.requester_id }))
    const incoming = requests.filter(r => r.status === 'pending' && r.addressee_id === myId)
    const outgoing = requests.filter(r => r.status === 'pending' && r.requester_id === myId)
    const blockedIds = ((blockRes.data ?? []) as { blocked_id: string }[]).map(b => b.blocked_id)

    const members = (memberRes.data ?? []) as { party_id: string; user_id: string }[]
    // party_members は「自分が active なパーティー」の行だけが見える
    const myPartyIds = new Set(members.filter(m => m.user_id === myId).map(m => m.party_id))
    const parties: PartyWithCount[] = ((partyRes.data ?? []) as Party[])
      .filter(p => myPartyIds.has(p.id))
      .map(p => ({ ...p, member_count: members.filter(m => m.party_id === p.id).length }))

    const invites = (inviteRes.data ?? []) as PartyInvite[]
    const notifications = (notifRes.data ?? []) as AppNotification[]
    const applyRequests = (applyRes.data ?? []) as ApplyRequest[]

    set(s => ({
      loaded: true, myId, friends, incoming, outgoing, blockedIds, parties, invites, applyRequests, notifications,
      version: s.version + 1,
    }))

    // 名前表示に必要なユーザー情報をまとめて取得
    const ids = new Set<string>([myId])
    friends.forEach(f => ids.add(f.userId))
    incoming.forEach(r => ids.add(r.requester_id))
    outgoing.forEach(r => ids.add(r.addressee_id))
    blockedIds.forEach(id => ids.add(id))
    invites.forEach(i => ids.add(i.inviter_id))
    for (const n of notifications) notificationUserIds(n).forEach(id => ids.add(id))
    await get().ensureUsers([...ids])
  },

  ensureUsers: async (ids) => {
    const known = get().users
    const missing = [...new Set(ids.filter((id): id is string => !!id && !known[id]))]
    if (missing.length === 0) return
    const { data, error } = await supabase.rpc('get_profiles', { p_ids: missing })
    if (error) return
    const next = { ...get().users }
    for (const u of (data ?? []) as UserSummary[]) next[u.id] = u
    set({ users: next })
  },

  searchByHandle: async (handle) => {
    const h = handle.trim().replace(/^@/, '')
    if (!h) return null
    const { data, error } = await supabase.rpc('search_profile_by_handle', { p_handle: h })
    if (error) fail(error)
    const found = ((data ?? []) as UserSummary[])[0] ?? null
    if (found) set(s => ({ users: { ...s.users, [found.id]: found } }))
    return found
  },

  sendFriendRequest: async (userId) => {
    const { data, error } = await supabase.rpc('send_friend_request', { p_addressee_id: userId })
    if (error) fail(error)
    await get().fetchSocial()
    return data as 'sent' | 'accepted' | 'already'
  },

  acceptFriendRequest: async (requestId) => {
    const { error } = await supabase.rpc('accept_friend_request', { p_request_id: requestId })
    if (error) fail(error)
    await get().fetchSocial()
  },

  removeFriendRequest: async (requestId) => {
    const { error } = await supabase.from('friend_requests').delete().eq('id', requestId)
    if (error) fail(error)
    await get().fetchSocial()
  },

  block: async (userId) => {
    const myId = get().myId
    if (!myId) throw new Error('ログインが必要です')
    const { error } = await supabase.from('blocks').insert({ blocker_id: myId, blocked_id: userId })
    if (error && !String(error.message).includes('duplicate')) fail(error)
    await get().fetchSocial()
  },

  unblock: async (userId) => {
    const { error } = await supabase.from('blocks').delete().eq('blocked_id', userId)
    if (error) fail(error)
    await get().fetchSocial()
  },

  createParty: async (name) => {
    const n = name.trim()
    if (!n) throw new Error('パーティー名を入力してください')
    const { data, error } = await supabase.rpc('create_party', { p_name: n })
    if (error) fail(error)
    await get().fetchSocial()
    return data as Party
  },

  redeemInviteCode: async (code) => {
    const c = code.trim().toUpperCase()
    if (!c) throw new Error('招待コードを入力してください')
    const { data, error } = await supabase.rpc('redeem_party_invite_code', { p_code: c })
    if (error) fail(error)
    await get().fetchSocial()
    return data as Party
  },

  respondPartyInvite: async (inviteId, accept) => {
    const { error } = await supabase.rpc('respond_party_invite', { p_invite_id: inviteId, p_accept: accept })
    if (error) fail(error)
    await get().fetchSocial()
  },

  respondApplyRequests: async (requestIds, approve) => {
    const results = await Promise.all(
      requestIds.map(id => supabase.rpc('respond_join_request', { p_request_id: id, p_approve: approve })),
    )
    await get().fetchSocial()
    const failed = results.filter(r => r.error)
    if (failed.length === requestIds.length && failed[0]?.error) fail(failed[0].error)
    return failed.length
  },

  subscribeRealtime: (onNotification) => {
    let channel: ReturnType<typeof supabase.channel> | null = null
    let timer: number | undefined
    let stopped = false
    // 1つの操作で複数の表が変わるので、まとめて1回だけ読み直す
    const refresh = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => { void get().fetchSocial() }, 250)
    }

    void (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || stopped) return
      const me = user.id
      // 受け取れるのは各表の RLS で読める行だけ（20261016120000_realtime_social.sql）
      channel = supabase
        .channel(`social:${me}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${me}` }, payload => {
          onNotification(payload.new as AppNotification)
          refresh()
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'friend_requests', filter: `addressee_id=eq.${me}` }, refresh)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'friend_requests', filter: `requester_id=eq.${me}` }, refresh)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'party_invites', filter: `invitee_id=eq.${me}` }, refresh)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'party_invites', filter: `inviter_id=eq.${me}` }, refresh)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'party_members' }, refresh)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'lecture_apply_requests' }, refresh)
        .subscribe()
    })()

    return () => {
      stopped = true
      window.clearTimeout(timer)
      if (channel) void supabase.removeChannel(channel)
    }
  },

  markAllNotificationsRead: async () => {
    const unread = get().notifications.filter(n => !n.read_at).map(n => n.id)
    if (unread.length === 0) return
    const now = new Date().toISOString()
    set(s => ({ notifications: s.notifications.map(n => (n.read_at ? n : { ...n, read_at: now })) }))
    await supabase.from('notifications').update({ read_at: now }).in('id', unread)
  },
}))

/** 表示名（@handle）を返す。不明なら「ユーザー」 */
export function userLabel(users: Record<string, UserSummary>, id: string | null | undefined): string {
  if (!id) return 'ユーザー'
  const u = users[id]
  return u ? u.display_name : 'ユーザー'
}
