import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { toMessage } from '../../lib/errors'
import { useSocialStore } from '../../store/useSocialStore'
import { useToast } from '../ui/Toast'
import Sheet from '../ui/Sheet'
import { Avatar, Badge, Button, Card, Confirm, Notice, Section } from '../ui/kit'
import { inputStyle } from '../ui/styles'
import LectureList from '../lecture/LectureList'
import type { LectureSummary } from '../../types'

interface Props {
  userId: string
  onClose: () => void
  onOpenLecture: (lectureId: string) => void
  /** 自分のプロフィールのとき「編集」から開く */
  onEditProfile?: () => void
}

export default function ProfileView({ userId, onClose, onOpenLecture, onEditProfile }: Props) {
  const { showToast } = useToast()
  const {
    myId, users, friends, incoming, outgoing, blockedIds, parties, version: socialVersion,
    ensureUsers, sendFriendRequest, acceptFriendRequest, removeFriendRequest, block, unblock,
  } = useSocialStore()
  const [lectures, setLectures] = useState<LectureSummary[] | null>(null)
  const [confirm, setConfirm] = useState<'unfriend' | 'block' | null>(null)
  const [inviteParty, setInviteParty] = useState('')
  const [busy, setBusy] = useState(false)

  const user = users[userId]
  const isMe = userId === myId
  const friend = friends.find(f => f.userId === userId)
  const inReq = incoming.find(r => r.requester_id === userId)
  const outReq = outgoing.find(r => r.addressee_id === userId)
  const isBlocked = blockedIds.includes(userId)

  const loadLectures = useCallback(async () => {
    const { data, error } = await supabase.rpc('get_user_lectures', { p_user_id: userId })
    setLectures(error ? [] : ((data ?? []) as LectureSummary[]))
  }, [userId])

  useEffect(() => {
    void ensureUsers([userId])
    void loadLectures()
  }, [userId, ensureUsers, loadLectures, socialVersion])

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    try { await fn() } catch (e: unknown) { showToast(toMessage(e), 'error') } finally { setBusy(false) }
  }

  const name = user?.display_name ?? 'ユーザー'

  // 関係に応じて「いちばん押してほしい操作」を1つだけ primary にする
  const relation = isMe ? null : isBlocked ? 'ブロック中' : friend ? 'フレンド' : inReq ? '申請が届いています' : outReq ? '申請中' : null
  const mainActions = isMe ? (
    onEditProfile && <Button onClick={onEditProfile}>表示名・ユーザーIDを編集</Button>
  ) : isBlocked ? (
    <Button disabled={busy} onClick={() => run(async () => { await unblock(userId); showToast('ブロックを解除しました') })}>ブロックを解除</Button>
  ) : inReq ? (
    <>
      <Button disabled={busy} onClick={() => run(async () => { await removeFriendRequest(inReq.id); showToast('申請を拒否しました') })}>拒否</Button>
      <Button variant="primary" disabled={busy} onClick={() => run(async () => { await acceptFriendRequest(inReq.id); showToast('フレンドになりました') })}>申請を承認</Button>
    </>
  ) : outReq ? (
    <Button disabled={busy} onClick={() => run(async () => { await removeFriendRequest(outReq.id); showToast('申請を取り下げました') })}>申請を取り下げる</Button>
  ) : !friend ? (
    <Button variant="primary" disabled={busy} onClick={() => run(async () => {
      const r = await sendFriendRequest(userId)
      showToast(r === 'accepted' ? 'フレンドになりました' : 'フレンド申請を送りました')
    })}>
      フレンド申請を送る
    </Button>
  ) : null

  return (
    <Sheet
      title={isMe ? '自分のプロフィール' : 'プロフィール'}
      subtitle={isMe ? 'ほかの人には、公開範囲に応じて講義だけが表示されます' : undefined}
      onClose={onClose}
      zIndex={320}
      width={760}
    >
      <Card tone="muted" padding={16}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <Avatar name={name} size={56} />
          <div style={{ flex: 1, minWidth: 160 }}>
            <div style={{ fontSize: 19, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{name}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              {user?.handle && <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>@{user.handle}</span>}
              {relation && <Badge tone={friend ? 'accent' : isBlocked ? 'danger' : 'neutral'}>{relation}</Badge>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{mainActions}</div>
        </div>
      </Card>

      {friend && parties.length > 0 && (
        <Section title="パーティーに招待" description="招待すると相手に通知が届き、承諾するとメンバーになります">
          <div style={{ display: 'flex', gap: 8 }}>
            <select value={inviteParty} onChange={e => setInviteParty(e.target.value)} style={{ ...inputStyle, flex: 1, minHeight: 38 }}>
              <option value="">パーティーを選んでください</option>
              {parties.map(p => <option key={p.id} value={p.id}>{p.name}（{p.member_count}人）</option>)}
            </select>
            <Button
              variant="primary"
              disabled={!inviteParty}
              loading={busy}
              onClick={() => run(async () => {
                const { error } = await supabase.rpc('invite_to_party', { p_party_id: inviteParty, p_invitee_id: userId })
                if (error) throw error
                setInviteParty('')
                showToast('招待を送りました')
              })}
            >
              招待する
            </Button>
          </div>
        </Section>
      )}

      {isBlocked ? (
        <Notice tone="warning">この人をブロックしています。ブロック中は講義などが表示されません。</Notice>
      ) : (
        <Section
          title={isMe ? '参加している講義' : 'あなたから見える講義'}
          count={lectures?.length}
          description={isMe ? '「参加中」を押すと講義の画面を開きます' : '気になる講義があれば、参加または参加申請ができます'}
        >
          {lectures === null ? (
            <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: 0 }}>読み込み中...</p>
          ) : (
            <LectureList
              lectures={lectures}
              onChanged={loadLectures}
              onOpenLecture={onOpenLecture}
              emptyMessage={isMe ? 'まだ講義に参加していません' : '表示できる講義はありません'}
              expandable={false}
            />
          )}
        </Section>
      )}

      {!isMe && !isBlocked && (
        <Section title="その他の操作">
          {confirm === 'unfriend' && friend ? (
            <Confirm
              message="フレンドを解除しますか？"
              detail="相手には通知されません。もう一度フレンドになるには申請が必要です。"
              confirmLabel="解除する"
              busy={busy}
              onCancel={() => setConfirm(null)}
              onConfirm={() => run(async () => { await removeFriendRequest(friend.requestId); setConfirm(null); showToast('フレンドを解除しました') })}
            />
          ) : confirm === 'block' ? (
            <Confirm
              message={`${name}さんをブロックしますか？`}
              detail="フレンドは解除され、互いのプロフィールが見えなくなります。相手には通知されません。"
              confirmLabel="ブロックする"
              busy={busy}
              onCancel={() => setConfirm(null)}
              onConfirm={() => run(async () => { await block(userId); setConfirm(null); showToast('ブロックしました') })}
            />
          ) : (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {friend && <Button size="sm" variant="ghost" onClick={() => setConfirm('unfriend')}>フレンドを解除</Button>}
              <Button size="sm" variant="ghost" style={{ color: 'var(--danger)' }} onClick={() => setConfirm('block')}>ブロック</Button>
            </div>
          )}
        </Section>
      )}
    </Sheet>
  )
}
