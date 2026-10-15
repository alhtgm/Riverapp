import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { toMessage } from '../../lib/errors'
import { LIMITS } from '../../lib/limits'
import { useSocialStore, userLabel } from '../../store/useSocialStore'
import { useToast } from '../ui/Toast'
import { Avatar, Badge, Button, Confirm, List, ListItem, Section } from '../ui/kit'
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
  /** 「…」メニューを開いている人（除外投票はふだんは隠しておく） */
  const [menuFor, setMenuFor] = useState<string | null>(null)
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
  const name = (id: string) => userLabel(users, id)

  const trailingFor = (userId: string, kind: 'exclude' | 'unexclude') => {
    if (userId === myId) return <Badge>自分</Badge>
    const v = voteFor(userId)
    if (v) {
      return (
        <>
          <Badge tone="danger">{v.kind === 'exclude' ? '除外' : '解除'}投票中 {v.ballots}/{v.needed}票</Badge>
          {v.i_voted
            ? <Badge>賛成済み</Badge>
            : <Button size="sm" variant="danger" disabled={busy} onClick={() => castBallot(v.id)}>賛成する</Button>}
        </>
      )
    }
    if (menuFor === userId) {
      return (
        <>
          <Button size="sm" variant="ghost" onClick={() => setMenuFor(null)}>やめる</Button>
          <Button size="sm" variant="danger" onClick={() => { setMenuFor(null); setConfirmUser({ userId, kind }) }}>
            {kind === 'exclude' ? '除外投票を始める' : '除外を解除する投票を始める'}
          </Button>
        </>
      )
    }
    return (
      <Button size="sm" variant="ghost" aria-label="その他の操作" title="その他の操作" style={{ color: 'var(--text-tertiary)', minWidth: 30, padding: 0 }}
        onClick={() => setMenuFor(userId)}>
        …
      </Button>
    )
  }

  return (
    <>
      <Section
        title={groupWord}
        count={active.length}
        description={`押すとプロフィールを開きます。困った人がいるときは「…」から、${groupWord}の投票で外せます`}
      >
        {confirmUser && (
          <Confirm
            message={confirmUser.kind === 'exclude'
              ? `${name(confirmUser.userId)}さんの除外投票を始めますか？`
              : `${name(confirmUser.userId)}さんの除外を解除する投票を始めますか？`}
            detail={`あなたの1票が入った状態で始まります。対象の人を除く${groupWord}の過半数が賛成すると成立し、${LIMITS.exclusionVoteTtlDays}日で失効します。対象の人には投票中であることは表示されません。`}
            confirmLabel="投票を始める"
            busy={busy}
            onCancel={() => setConfirmUser(null)}
            onConfirm={() => startVote(confirmUser.userId, confirmUser.kind)}
          />
        )}
        <List>
          {active.map(m => (
            <ListItem
              key={m.userId}
              leading={<Avatar name={name(m.userId)} size={32} />}
              title={name(m.userId)}
              subtitle={users[m.userId]?.handle ? `@${users[m.userId]?.handle}` : undefined}
              onClick={() => onOpenProfile(m.userId)}
              trailing={trailingFor(m.userId, 'exclude')}
            />
          ))}
        </List>
      </Section>

      {excluded.length > 0 && (
        <Section title="除外された人" count={excluded.length} description="除外された人は参加・申請できません。解除投票が成立すると、また参加できるようになります">
          <List>
            {excluded.map(m => (
              <ListItem
                key={m.userId}
                leading={<Avatar name={name(m.userId)} size={32} />}
                title={name(m.userId)}
                trailing={trailingFor(m.userId, 'unexclude')}
              />
            ))}
          </List>
        </Section>
      )}
    </>
  )
}
