import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { toMessage } from '../../lib/errors'
import { useStore } from '../../store/useStore'
import { useSocialStore, userLabel } from '../../store/useSocialStore'
import { useToast } from '../ui/Toast'
import Sheet from '../ui/Sheet'
import { Avatar, Badge, Button, Card, Confirm, Field, List, ListItem, Notice, Section } from '../ui/kit'
import { inputStyle } from '../ui/styles'
import LectureList from '../lecture/LectureList'
import { InviteToParties } from './PartyInvite'
import type { LectureSummary } from '../../types'

interface Props {
  userId: string
  onClose: () => void
  onOpenLecture: (lectureId: string) => void
}

/**
 * プロフィール。ほかの人ならフレンド申請・パーティーへの招待・見える講義を、
 * 自分ならアカウントの設定（表示名・ユーザーID・大学・ブロック）をまとめて扱う。
 */
export default function ProfileView({ userId, onClose, onOpenLecture }: Props) {
  const { showToast } = useToast()
  const {
    myId, users, friends, incoming, outgoing, blockedIds, version: socialVersion,
    ensureUsers, sendFriendRequest, acceptFriendRequest, removeFriendRequest, block, unblock,
  } = useSocialStore()
  const [lectures, setLectures] = useState<LectureSummary[] | null>(null)
  const [confirm, setConfirm] = useState<'unfriend' | 'block' | null>(null)
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
  const mainActions = isMe ? null : isBlocked ? (
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
      title={isMe ? 'プロフィールとアカウント' : 'プロフィール'}
      subtitle={isMe ? 'ほかの人には、表示名・ユーザーIDと、公開範囲に応じた講義だけが表示されます' : undefined}
      onClose={onClose}
      zIndex={320}
      width={760}
    >
      <Card tone="muted" padding={16}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <Avatar name={name} size={56} />
          <div style={{ flex: 1, minWidth: 160 }}>
            <div style={{ ...type('headline-small'), fontWeight: 'var(--type-weight-emphasized)', color: 'var(--text-primary)' }}>{name}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginTop: 'var(--space-1)' }}>
              {user?.handle && <span style={{ ...type('body-medium'), color: 'var(--text-secondary)' }}>@{user.handle}</span>}
              {relation && <Badge tone={friend ? 'accent' : isBlocked ? 'danger' : 'neutral'}>{relation}</Badge>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{mainActions}</div>
        </div>
      </Card>

      {friend && (
        <Section title="パーティーに招待" description="「招待」を押すと相手の受信箱に届き、承諾するとメンバーになります">
          <InviteToParties userId={userId} />
        </Section>
      )}

      {isMe && <AccountSettings />}

      {isBlocked ? (
        <Notice tone="warning">この人をブロックしています。ブロック中は講義などが表示されません。</Notice>
      ) : (
        <Section
          title={isMe ? '参加している講義' : 'あなたから見える講義'}
          count={lectures?.length}
          description={isMe ? '「参加中」を押すと講義の画面を開きます' : '気になる講義があれば、参加または参加申請ができます'}
        >
          {lectures === null ? (
            <p style={{ ...type('body-medium'), color: 'var(--text-secondary)', margin: 0 }}>読み込み中...</p>
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

/** 文字の役割（tokens.css の M3 type scale）をインラインスタイルで使う */
const type = (role: string): React.CSSProperties => ({
  fontSize: `var(--type-${role}-size)`,
  lineHeight: `var(--type-${role}-line)`,
  fontWeight: `var(--type-${role}-weight)`,
  letterSpacing: `var(--type-${role}-tracking)`,
})

/** 自分のユーザーID（自動で決まり、変更できない）。フレンドに伝えやすいようにコピーできる */
function HandleDisplay({ handle }: { handle: string }) {
  const { showToast } = useToast()
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`@${handle}`)
      showToast('ユーザーIDをコピーしました')
    } catch {
      showToast('コピーできませんでした。IDを長押しして選んでください', 'error')
    }
  }
  return (
    <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
      <input
        value={`@${handle}`}
        readOnly
        aria-label="ユーザーID"
        onFocus={e => e.currentTarget.select()}
        style={{ ...inputStyle, flex: 1, minWidth: 0, color: 'var(--text-secondary)', background: 'var(--bg-secondary)' }}
      />
      <Button size="sm" variant="ghost" onClick={() => { void copy() }}>コピー</Button>
    </div>
  )
}

/** 自分のアカウントの設定（表示名・ユーザーID・大学・ブロック） */
function AccountSettings() {
  const { showToast } = useToast()
  const { profile, updateMyProfile, schoolName, setMySchoolEmail } = useStore()
  const social = useSocialStore()
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '')
  const [schoolEmail, setSchoolEmail] = useState('')
  const [confirmSchoolRemove, setConfirmSchoolRemove] = useState(false)
  const [busy, setBusy] = useState(false)

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    try { await fn() } catch (e: unknown) { showToast(toMessage(e), 'error') } finally { setBusy(false) }
  }

  const dirty = displayName !== (profile?.display_name ?? '')

  return (
    <>
      <Section title="表示名とユーザーID" description="フレンドや講義のメンバーに表示されます。ユーザーIDを伝えると検索してもらえます">
        <form
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, alignItems: 'end' }}
          onSubmit={e => {
            e.preventDefault()
            void run(async () => {
              await updateMyProfile({ display_name: displayName })
              const me = useStore.getState().profile
              if (me) {
                useSocialStore.setState(st => ({
                  users: { ...st.users, [me.id]: { id: me.id, handle: me.handle, display_name: me.display_name } },
                }))
              }
              showToast('保存しました')
            })
          }}
        >
          <Field label="表示名" required help="本名でなくてもかまいません">
            <input value={displayName} onChange={e => setDisplayName(e.target.value)} maxLength={30} required style={inputStyle} />
          </Field>
          <Field label="ユーザーID" readOnly group help="自動で決まったIDです。変更はできません">
            <HandleDisplay handle={profile?.handle ?? ''} />
          </Field>
          <div><Button type="submit" variant="primary" disabled={!dirty} loading={busy}>保存する</Button></div>
        </form>
      </Section>

      <Section title="大学（任意）" description="登録すると、ヘッダーに大学名が表示されます。ほかの機能には影響しません">
        {schoolName ? (
          confirmSchoolRemove ? (
            <Confirm
              message="大学の登録を外しますか？"
              detail="ヘッダーの大学名が消えます。いつでも登録し直せます。"
              confirmLabel="登録を外す"
              busy={busy}
              onCancel={() => setConfirmSchoolRemove(false)}
              onConfirm={() => run(async () => { await setMySchoolEmail(null); setConfirmSchoolRemove(false); showToast('大学の登録を外しました') })}
            />
          ) : (
            <ListItem
              title={schoolName}
              subtitle={profile?.school_email ?? undefined}
              trailing={<Button size="sm" variant="ghost" onClick={() => setConfirmSchoolRemove(true)}>登録を外す</Button>}
            />
          )
        ) : (
          <form
            style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}
            onSubmit={e => {
              e.preventDefault()
              void run(async () => {
                await setMySchoolEmail(schoolEmail)
                setSchoolEmail('')
                showToast('大学を登録しました')
              })
            }}
          >
            <div style={{ flex: 1, minWidth: 220 }}>
              <Field label="大学のメールアドレス" help="@より後ろから大学を判定します。メールは届かず、ほかの人にも表示されません">
                <input type="email" value={schoolEmail} onChange={e => setSchoolEmail(e.target.value)} placeholder="you@s.yourschool.ac.jp" style={inputStyle} />
              </Field>
            </div>
            <Button type="submit" disabled={!schoolEmail.trim()} loading={busy}>登録する</Button>
          </form>
        )}
      </Section>

      {social.blockedIds.length > 0 && (
        <Section title="ブロック中の人" count={social.blockedIds.length} description="ブロックした相手からは申請や招待が届かず、互いのプロフィールも見えません">
          <List>
            {social.blockedIds.map(id => (
              <ListItem
                key={id}
                leading={<Avatar name={userLabel(social.users, id)} size={32} />}
                title={userLabel(social.users, id)}
                trailing={<Button size="sm" disabled={busy} onClick={() => run(async () => { await social.unblock(id); showToast('ブロックを解除しました') })}>解除</Button>}
              />
            ))}
          </List>
        </Section>
      )}
    </>
  )
}
