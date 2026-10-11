import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { toMessage } from '../../lib/errors'
import { useSocialStore } from '../../store/useSocialStore'
import { useToast } from '../ui/Toast'
import Sheet, { Avatar } from '../ui/Sheet'
import { btn, sectionTitle, inputStyle } from '../ui/styles'
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
    myId, users, friends, incoming, outgoing, blockedIds, parties,
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
  }, [userId, ensureUsers, loadLectures])

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    try { await fn() } catch (e: unknown) { showToast(toMessage(e), 'error') } finally { setBusy(false) }
  }

  const name = user?.display_name ?? 'ユーザー'

  return (
    <Sheet title={isMe ? '自分のプロフィール' : 'プロフィール'} onClose={onClose} zIndex={320} width={760}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Avatar name={name} size={48} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>{name}</div>
          {user?.handle && <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>@{user.handle}</div>}
          {friend && <div style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 700, marginTop: 2 }}>フレンド</div>}
        </div>
      </div>

      {isMe && onEditProfile && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <button style={btn('secondary', true)} onClick={onEditProfile}>表示名・ユーザーIDを編集</button>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>ほかの人には、公開範囲に応じて講義だけが表示されます</span>
        </div>
      )}

      {!isMe && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {isBlocked ? (
            <button style={btn('secondary', true)} disabled={busy} onClick={() => run(async () => { await unblock(userId); showToast('ブロックを解除しました') })}>
              ブロックを解除
            </button>
          ) : (
            <>
              {friend && confirm !== 'unfriend' && (
                <button style={btn('secondary', true)} onClick={() => setConfirm('unfriend')}>フレンドを解除</button>
              )}
              {friend && confirm === 'unfriend' && (
                <>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)', alignSelf: 'center' }}>解除しますか？（相手には通知されません）</span>
                  <button style={btn('danger', true)} disabled={busy} onClick={() => run(async () => { await removeFriendRequest(friend.requestId); setConfirm(null); showToast('フレンドを解除しました') })}>解除する</button>
                  <button style={btn('ghost', true)} onClick={() => setConfirm(null)}>やめる</button>
                </>
              )}
              {inReq && (
                <>
                  <button style={btn('primary', true)} disabled={busy} onClick={() => run(async () => { await acceptFriendRequest(inReq.id); showToast('フレンドになりました') })}>申請を承認</button>
                  <button style={btn('secondary', true)} disabled={busy} onClick={() => run(async () => { await removeFriendRequest(inReq.id); showToast('申請を拒否しました') })}>拒否</button>
                </>
              )}
              {outReq && (
                <button style={btn('secondary', true)} disabled={busy} onClick={() => run(async () => { await removeFriendRequest(outReq.id); showToast('申請を取り下げました') })}>
                  申請中（取り下げる）
                </button>
              )}
              {!friend && !inReq && !outReq && (
                <button style={btn('primary', true)} disabled={busy} onClick={() => run(async () => {
                  const r = await sendFriendRequest(userId)
                  showToast(r === 'accepted' ? 'フレンドになりました' : 'フレンド申請を送りました')
                })}>
                  フレンド申請
                </button>
              )}
              {confirm !== 'block' ? (
                <button style={{ ...btn('ghost', true), color: 'var(--danger)' }} onClick={() => setConfirm('block')}>ブロック</button>
              ) : (
                <>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)', alignSelf: 'center' }}>ブロックするとフレンドも解除されます</span>
                  <button style={btn('danger', true)} disabled={busy} onClick={() => run(async () => { await block(userId); setConfirm(null); showToast('ブロックしました') })}>ブロックする</button>
                  <button style={btn('ghost', true)} onClick={() => setConfirm(null)}>やめる</button>
                </>
              )}
            </>
          )}
        </div>
      )}

      {friend && parties.length > 0 && (
        <div>
          <p style={sectionTitle}>パーティーに招待</p>
          <div style={{ display: 'flex', gap: 6 }}>
            <select value={inviteParty} onChange={e => setInviteParty(e.target.value)} style={{ ...inputStyle, flex: 1 }}>
              <option value="">パーティーを選択</option>
              {parties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <button
              style={btn('primary')}
              disabled={!inviteParty || busy}
              onClick={() => run(async () => {
                const { error } = await supabase.rpc('invite_to_party', { p_party_id: inviteParty, p_invitee_id: userId })
                if (error) throw error
                setInviteParty('')
                showToast('招待を送りました')
              })}
            >
              招待
            </button>
          </div>
        </div>
      )}

      {!isBlocked && (
        <div>
          <p style={sectionTitle}>{isMe ? '参加している講義' : 'あなたから見える講義'}</p>
          {lectures === null ? (
            <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: 0 }}>読み込み中...</p>
          ) : (
            <LectureList
              lectures={lectures}
              onChanged={loadLectures}
              onOpenLecture={onOpenLecture}
              emptyMessage="表示できる講義はありません"
            />
          )}
        </div>
      )}
    </Sheet>
  )
}
