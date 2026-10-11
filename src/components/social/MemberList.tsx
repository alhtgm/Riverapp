import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { toMessage } from '../../lib/errors'
import { LIMITS } from '../../lib/limits'
import { useSocialStore, userLabel } from '../../store/useSocialStore'
import { useToast } from '../ui/Toast'
import { Avatar } from '../ui/Sheet'
import { btn, emptyText, sectionTitle } from '../ui/styles'
import type { OpenVote } from '../../types'

interface Props {
  targetType: 'lecture' | 'party'
  targetId: string
  members: { userId: string; status: 'active' | 'left' | 'excluded' }[]
  onOpenProfile: (userId: string) => void
  /** 投票が成立してメンバー構成が変わったときに呼ぶ */
  onChanged: () => void
}

/**
 * メンバー（参加者）一覧と除外投票（8章）。
 * 個人に除外の権限はなく、対象者を除くメンバーの過半数（切り上げ）が賛成すると成立する。
 * 対象者本人には投票中であることは表示されない（RPC 側で除外している）。
 */
export default function MemberList({ targetType, targetId, members, onOpenProfile, onChanged }: Props) {
  const { showToast } = useToast()
  const { myId, users, ensureUsers } = useSocialStore()
  const [votes, setVotes] = useState<OpenVote[]>([])
  const [confirmUser, setConfirmUser] = useState<{ userId: string; kind: 'exclude' | 'unexclude' } | null>(null)
  const [busy, setBusy] = useState(false)

  const loadVotes = useCallback(async () => {
    const { data } = await supabase.rpc('get_open_votes', { p_target_type: targetType, p_target_id: targetId })
    setVotes((data ?? []) as OpenVote[])
  }, [targetType, targetId])

  useEffect(() => { void loadVotes() }, [loadVotes])
  useEffect(() => { void ensureUsers(members.map(m => m.userId)) }, [members, ensureUsers])

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    try {
      await fn()
      await loadVotes()
      onChanged()
    } catch (e: unknown) {
      showToast(toMessage(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  const startVote = (userId: string, kind: 'exclude' | 'unexclude') => run(async () => {
    const { data, error } = await supabase.rpc('start_exclusion_vote', {
      p_target_type: targetType, p_target_id: targetId, p_target_user_id: userId, p_kind: kind,
    })
    if (error) throw error
    setConfirmUser(null)
    const passed = (data as { status: string } | null)?.status === 'passed'
    showToast(passed
      ? (kind === 'exclude' ? '除外が成立しました' : '除外の解除が成立しました')
      : '投票を開始しました')
  })

  const castBallot = (voteId: string) => run(async () => {
    const { error } = await supabase.rpc('cast_exclusion_ballot', { p_vote_id: voteId })
    if (error) throw error
    showToast('賛成しました')
  })

  const active = members.filter(m => m.status === 'active')
  const excluded = members.filter(m => m.status === 'excluded')
  const voteFor = (userId: string) => votes.find(v => v.target_user_id === userId)
  const groupWord = targetType === 'lecture' ? '参加者' : 'メンバー'

  const renderVoteControls = (userId: string, kind: 'exclude' | 'unexclude') => {
    if (userId === myId) return null
    const v = voteFor(userId)
    if (v) {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <span style={{ fontSize: 11, color: 'var(--danger)', fontWeight: 700 }}>
            {v.kind === 'exclude' ? '除外' : '解除'}投票中 {v.ballots}/{v.needed}
          </span>
          {v.i_voted
            ? <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>賛成済み</span>
            : <button style={btn('danger', true)} disabled={busy} onClick={() => castBallot(v.id)}>賛成する</button>}
        </span>
      )
    }
    if (confirmUser?.userId === userId && confirmUser.kind === kind) {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          <button style={btn('danger', true)} disabled={busy} onClick={() => startVote(userId, kind)}>投票を始める</button>
          <button style={btn('ghost', true)} onClick={() => setConfirmUser(null)}>やめる</button>
        </span>
      )
    }
    return (
      <button
        style={{ ...btn('ghost', true), color: 'var(--text-tertiary)' }}
        onClick={() => setConfirmUser({ userId, kind })}
      >
        {kind === 'exclude' ? '除外投票' : '解除投票'}
      </button>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <p style={sectionTitle}>{groupWord}（{active.length}人）</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {active.map(m => (
            <div key={m.userId} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 2px' }}>
              <button
                onClick={() => onOpenProfile(m.userId)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0, background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
              >
                <Avatar name={userLabel(users, m.userId)} />
                <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {userLabel(users, m.userId)}{m.userId === myId && '（自分）'}
                </span>
                {users[m.userId]?.handle && (
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>@{users[m.userId]?.handle}</span>
                )}
              </button>
              {renderVoteControls(m.userId, 'exclude')}
            </div>
          ))}
        </div>
        {confirmUser?.kind === 'exclude' && (
          <p style={{ ...emptyText, fontSize: 11 }}>
            対象の人を除く{groupWord}の過半数が賛成すると除外されます（{LIMITS.exclusionVoteTtlDays}日で失効）。対象の人には投票中であることは表示されません。
          </p>
        )}
      </div>

      {excluded.length > 0 && (
        <div>
          <p style={sectionTitle}>除外された人</p>
          {excluded.map(m => (
            <div key={m.userId} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 2px' }}>
              <Avatar name={userLabel(users, m.userId)} />
              <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: 'var(--text-secondary)' }}>{userLabel(users, m.userId)}</span>
              {renderVoteControls(m.userId, 'unexclude')}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
