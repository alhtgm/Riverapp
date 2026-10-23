import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { toMessage } from '../../lib/errors'
import { useSocialStore, userLabel } from '../../store/useSocialStore'
import { useToast } from '../ui/Toast'

type InviteState = 'member' | 'excluded' | 'invited'

/**
 * 所属しているパーティーごとの「この人はメンバーか・招待中か」を読み、招待を送る。
 * フレンド一覧・プロフィール・パーティーのメンバー画面で共通に使う。
 */
export function usePartyInvites() {
  const { parties, users, version } = useSocialStore()
  const { showToast } = useToast()
  /** `${partyId}:${userId}` → 状態 */
  const [states, setStates] = useState<Map<string, InviteState> | null>(null)
  const [busy, setBusy] = useState(false)
  const partyIdsKey = parties.map(p => p.id).join(',')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const ids = partyIdsKey ? partyIdsKey.split(',') : []
      const [memRes, invRes] = await Promise.all([
        supabase.from('party_members').select('party_id, user_id, status').in('party_id', ids).in('status', ['active', 'excluded']),
        supabase.rpc('get_my_parties_pending_invites'),
      ])
      if (cancelled) return
      const next = new Map<string, InviteState>()
      for (const i of (invRes.data ?? []) as { party_id: string; invitee_id: string }[]) next.set(`${i.party_id}:${i.invitee_id}`, 'invited')
      for (const m of (memRes.data ?? []) as { party_id: string; user_id: string; status: string }[]) {
        next.set(`${m.party_id}:${m.user_id}`, m.status === 'active' ? 'member' : 'excluded')
      }
      setStates(next)
    })()
    return () => { cancelled = true }
  }, [partyIdsKey, version])

  const stateOf = useCallback((partyId: string, userId: string) => states?.get(`${partyId}:${userId}`), [states])

  /** 招待を送る。送れた人数を返す */
  const invite = useCallback(async (partyId: string, userIds: string[]) => {
    const party = parties.find(p => p.id === partyId)
    setBusy(true)
    let sent = 0
    let lastError: unknown = null
    try {
      for (const uid of userIds) {
        const { error } = await supabase.rpc('invite_to_party', { p_party_id: partyId, p_invitee_id: uid })
        if (error) { lastError = error; continue }
        sent++
        setStates(prev => new Map(prev).set(`${partyId}:${uid}`, 'invited'))
      }
      if (sent === 0 && lastError) throw lastError
      const who = userIds.length === 1 ? `${userLabel(users, userIds[0])}さん` : `${sent}人`
      showToast(`${who}を「${party?.name ?? 'パーティー'}」に招待しました${sent < userIds.length ? `（${userIds.length - sent}人は招待できませんでした）` : ''}`)
    } catch (e: unknown) {
      showToast(toMessage(e), 'error')
    } finally {
      setBusy(false)
    }
    return sent
  }, [parties, users, showToast])

  return { loaded: states !== null, stateOf, invite, busy }
}
