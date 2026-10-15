import { useEffect, useState } from 'react'
import { toMessage } from '../../lib/errors'
import { LIMITS } from '../../lib/limits'
import { useStore } from '../../store/useStore'
import { useSocialStore, userLabel } from '../../store/useSocialStore'
import { useToast } from '../ui/Toast'
import Sheet from '../ui/Sheet'
import { Avatar, Badge, Button, Confirm, EmptyState, Field, List, ListItem, Section, Tabs } from '../ui/kit'
import { inputStyle } from '../ui/styles'
import { VISIBILITY_LABEL, formatDate, type AppNotification, type LectureVisibility, type UserSummary } from '../../types'

export type SocialTab = 'notifications' | 'friends' | 'parties' | 'account'

interface Props {
  initialTab?: SocialTab
  onClose: () => void
  onOpenProfile: (userId: string) => void
  onOpenParty: (partyId: string) => void
  onOpenLecture: (lectureId: string) => void
}

const SUBTITLE: Record<SocialTab, string> = {
  notifications: 'フレンドや講義の新しい動きをお知らせします',
  friends: 'ユーザーIDでつながった人と、講義や進捗を見せ合えます',
  parties: '身内のグループ。メンバー同士で講義を共有できます',
  account: 'ほかの人に表示される名前とユーザーIDの設定です',
}

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'たった今'
  if (diff < 3600) return `${Math.floor(diff / 60)}分前`
  if (diff < 86400) return `${Math.floor(diff / 3600)}時間前`
  return `${Math.floor(diff / 86400)}日前`
}

function HandleInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div style={{ position: 'relative', flex: 1 }}>
      <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', fontSize: 14 }}>@</span>
      <input
        value={value}
        onChange={e => onChange(e.target.value.replace(/^@/, ''))}
        placeholder={placeholder}
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        style={{ ...inputStyle, paddingLeft: 28, minHeight: 38 }}
      />
    </div>
  )
}

export default function SocialPanel({ initialTab = 'notifications', onClose, onOpenProfile, onOpenParty, onOpenLecture }: Props) {
  const { showToast } = useToast()
  const social = useSocialStore()
  const { users, friends, incoming, outgoing, blockedIds, parties, invites, notifications, applyRequests } = social
  const { profile, updateMyProfile, subjects, schoolName, setMySchoolEmail, fetchAll } = useStore()
  const [tab, setTab] = useState<SocialTab>(initialTab)
  const [busy, setBusy] = useState(false)

  const [query, setQuery] = useState('')
  const [searchResult, setSearchResult] = useState<UserSummary | null | 'none'>(null)
  const [partyName, setPartyName] = useState('')
  const [code, setCode] = useState('')
  const [handle, setHandle] = useState(profile?.handle ?? '')
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '')
  const [schoolEmail, setSchoolEmail] = useState('')
  const [confirmSchoolRemove, setConfirmSchoolRemove] = useState(false)

  useEffect(() => { void social.fetchSocial() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // 通知タブを開いたら既読にする
  useEffect(() => {
    if (tab === 'notifications' && social.loaded) void social.markAllNotificationsRead()
  }, [tab, social.loaded]) // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    try { await fn() } catch (e: unknown) { showToast(toMessage(e), 'error') } finally { setBusy(false) }
  }

  const name = (id: unknown) => userLabel(users, typeof id === 'string' ? id : null)
  const handleOf = (id: string) => (users[id]?.handle ? `@${users[id]?.handle}` : undefined)
  const lectureTitle = (n: AppNotification) =>
    String(n.payload.title ?? subjects.find(s => s.id === n.payload.lecture_id)?.name ?? '講義')

  const notificationText = (n: AppNotification): string => {
    const p = n.payload
    switch (n.type) {
      case 'friend_request': return `${name(p.requester_id)}さんからフレンド申請が届きました`
      case 'friend_accepted': return `${name(p.addressee_id)}さんがフレンド申請を承認しました`
      case 'party_invite': return `${name(p.inviter_id)}さんから${p.party_name ? `「${String(p.party_name)}」` : 'パーティー'}に招待されました`
      case 'lecture_apply_request': return `「${lectureTitle(n)}」に${name(p.applicant_id)}さんから参加申請が届きました`
      case 'lecture_apply_response': return `「${lectureTitle(n)}」への参加申請が${p.approved ? '承認' : '却下'}されました`
      case 'task_due_changed':
        return `「${lectureTitle(n)}」の課題「${String(p.title ?? '')}」の締切が${formatDate(String(p.old_due_date))}から${formatDate(String(p.new_due_date))}に変わりました`
      case 'lecture_visibility_changed':
        return `「${lectureTitle(n)}」の公開範囲が「${VISIBILITY_LABEL[p.old_visibility as LectureVisibility] ?? ''}」から「${VISIBILITY_LABEL[p.new_visibility as LectureVisibility] ?? ''}」に変わりました`
      default: return 'お知らせがあります'
    }
  }

  const notificationAction = (n: AppNotification): { label: string; run: () => void; primary?: boolean } | null => {
    const p = n.payload
    // まだ返事をしていない申請・招待は、通知からそのまま1回で返事できるようにする
    const applyRequest = n.type === 'lecture_apply_request' ? applyRequests.find(r => r.id === p.request_id) : undefined
    if (applyRequest) {
      return {
        label: '承認する', primary: true,
        run: () => void run(async () => {
          const failed = await social.respondApplyRequests([applyRequest.id], true)
          showToast(failed ? 'ほかの人が対応済みか、期限切れでした' : `${applyRequest.display_name ?? 'ユーザー'}さんの参加を承認しました`, failed ? 'error' : undefined)
        }),
      }
    }
    const friendRequest = n.type === 'friend_request' ? incoming.find(r => r.requester_id === p.requester_id) : undefined
    if (friendRequest) {
      return {
        label: '承認する', primary: true,
        run: () => void run(async () => { await social.acceptFriendRequest(friendRequest.id); showToast('フレンドになりました') }),
      }
    }
    const invite = n.type === 'party_invite' ? invites.find(i => i.id === p.invite_id) : undefined
    if (invite) {
      return {
        label: '参加する', primary: true,
        run: () => void run(async () => {
          await social.respondPartyInvite(invite.id, true)
          await fetchAll()
          showToast(`「${invite.party_name}」に参加しました`)
        }),
      }
    }
    switch (n.type) {
      case 'friend_request': return { label: '確認する', run: () => setTab('friends') }
      case 'friend_accepted': return typeof p.addressee_id === 'string' ? { label: 'プロフィール', run: () => onOpenProfile(p.addressee_id as string) } : null
      case 'party_invite': return { label: '確認する', run: () => setTab('parties') }
      default:
        return typeof p.lecture_id === 'string' && subjects.some(s => s.id === p.lecture_id)
          ? { label: '講義を開く', run: () => onOpenLecture(p.lecture_id as string) }
          : null
    }
  }

  const userItem = (id: string, trailing?: React.ReactNode) => (
    <ListItem
      key={id}
      leading={<Avatar name={name(id)} size={34} />}
      title={name(id)}
      subtitle={handleOf(id)}
      onClick={() => onOpenProfile(id)}
      trailing={trailing}
    />
  )

  return (
    <Sheet title="つながり" subtitle={SUBTITLE[tab]} onClose={onClose} width={820} height={760}>
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { key: 'notifications', label: '通知', badge: notifications.filter(n => !n.read_at).length },
          { key: 'friends', label: 'フレンド', badge: incoming.length },
          { key: 'parties', label: 'パーティー', badge: invites.length },
          { key: 'account', label: 'アカウント' },
        ]}
      />

      {tab === 'notifications' && (
        <Section title="お知らせ" description="ボタンを押すと関係する画面に移動します">
          {notifications.length === 0 ? (
            <EmptyState title="通知はありません" description="フレンド申請や、参加している講義の締切変更などがここに届きます。" />
          ) : (
            <List>
              {notifications.map(n => {
                const action = notificationAction(n)
                return (
                  <ListItem
                    key={n.id}
                    highlight={!n.read_at}
                    title={<span style={{ whiteSpace: 'normal', fontWeight: n.read_at ? 500 : 700 }}>{notificationText(n)}</span>}
                    subtitle={timeAgo(n.created_at)}
                    trailing={action && (
                      <Button size="sm" variant={action.primary ? 'primary' : 'secondary'} disabled={busy} onClick={action.run}>{action.label}</Button>
                    )}
                  />
                )
              })}
            </List>
          )}
        </Section>
      )}

      {tab === 'friends' && (
        <>
          <Section title="フレンドを探す" description="なりすまし防止のため、ユーザーIDの完全一致でのみ検索できます">
            <form
              style={{ display: 'flex', gap: 8 }}
              onSubmit={e => {
                e.preventDefault()
                void run(async () => setSearchResult((await social.searchByHandle(query)) ?? 'none'))
              }}
            >
              <HandleInput value={query} onChange={v => { setQuery(v); setSearchResult(null) }} placeholder="相手のユーザーID" />
              <Button type="submit" variant="primary" disabled={!query.trim()} loading={busy}>検索</Button>
            </form>
            {searchResult === 'none' && <EmptyState compact title="見つかりませんでした" description="ユーザーIDのつづりを確認してください。" />}
            {searchResult && searchResult !== 'none' && userItem(searchResult.id, <Button size="sm" onClick={() => onOpenProfile(searchResult.id)}>プロフィールを見る</Button>)}
          </Section>

          {incoming.length > 0 && (
            <Section title="届いた申請" count={incoming.length} description="承認するとフレンドになります">
              <List>
                {incoming.map(r => userItem(r.requester_id, (
                  <>
                    <Button size="sm" disabled={busy} onClick={() => run(async () => { await social.removeFriendRequest(r.id); showToast('申請を拒否しました') })}>拒否</Button>
                    <Button size="sm" variant="primary" disabled={busy} onClick={() => run(async () => { await social.acceptFriendRequest(r.id); showToast('フレンドになりました') })}>承認</Button>
                  </>
                )))}
              </List>
            </Section>
          )}

          {outgoing.length > 0 && (
            <Section title="送った申請" count={outgoing.length} description="相手が承認するとフレンドになります">
              <List>
                {outgoing.map(r => userItem(r.addressee_id, (
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => run(async () => { await social.removeFriendRequest(r.id); showToast('申請を取り下げました') })}>取り下げ</Button>
                )))}
              </List>
            </Section>
          )}

          <Section title="フレンド" count={friends.length} description="押すとプロフィールと見える講義を確認できます">
            {friends.length === 0 ? (
              <EmptyState title="まだフレンドがいません" description="上の検索欄に相手のユーザーIDを入れて、フレンド申請を送りましょう。" />
            ) : (
              <List>{friends.map(f => userItem(f.userId, <Badge>フレンド</Badge>))}</List>
            )}
          </Section>
        </>
      )}

      {tab === 'parties' && (
        <>
          {invites.length > 0 && (
            <Section title="届いた招待" count={invites.length} description="参加するとメンバー同士で講義を共有できます">
              <List>
                {invites.map(inv => (
                  <ListItem
                    key={inv.id}
                    title={inv.party_name}
                    subtitle={`${name(inv.inviter_id)}さんから・メンバー${inv.member_count}人`}
                    trailing={
                      <>
                        <Button size="sm" disabled={busy} onClick={() => run(async () => { await social.respondPartyInvite(inv.id, false) })}>断る</Button>
                        <Button size="sm" variant="primary" disabled={busy} onClick={() => run(async () => { await social.respondPartyInvite(inv.id, true); showToast(`「${inv.party_name}」に参加しました`) })}>参加する</Button>
                      </>
                    }
                  />
                ))}
              </List>
            </Section>
          )}

          <Section
            title="所属しているパーティー"
            count={parties.length}
            description={`押すとメンバーや共有中の講義を確認できます（最大${LIMITS.userMaxParties}個まで）`}
          >
            {parties.length === 0 ? (
              <EmptyState title="まだパーティーに所属していません" description="下の「パーティーを作る」か、もらった招待コードで参加しましょう。" />
            ) : (
              <List>
                {parties.map(p => (
                  <ListItem
                    key={p.id}
                    title={p.name}
                    subtitle={`メンバー ${p.member_count}/${LIMITS.partyMaxMembers}人`}
                    onClick={() => onOpenParty(p.id)}
                    trailing={<span style={{ color: 'var(--text-tertiary)', fontSize: 18 }}>›</span>}
                  />
                ))}
              </List>
            )}
          </Section>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
            <Section title="パーティーを作る" description="作ったあと、フレンドを招待したり招待コードを発行できます">
              <form
                style={{ display: 'flex', gap: 8 }}
                onSubmit={e => {
                  e.preventDefault()
                  void run(async () => {
                    const party = await social.createParty(partyName)
                    setPartyName('')
                    showToast('パーティーを作りました')
                    onOpenParty(party.id)
                  })
                }}
              >
                <input value={partyName} onChange={e => setPartyName(e.target.value)} maxLength={40} placeholder="例：ゼミ仲間" style={{ ...inputStyle, minHeight: 38 }} />
                <Button type="submit" variant="primary" disabled={!partyName.trim()} loading={busy}>作成</Button>
              </form>
            </Section>
            <Section title="招待コードで参加" description="メンバーからもらった8文字のコードを入力します">
              <form
                style={{ display: 'flex', gap: 8 }}
                onSubmit={e => {
                  e.preventDefault()
                  void run(async () => {
                    const party = await social.redeemInviteCode(code)
                    setCode('')
                    showToast(`「${party.name}」に参加しました`)
                    onOpenParty(party.id)
                  })
                }}
              >
                <input
                  value={code}
                  onChange={e => setCode(e.target.value.toUpperCase())}
                  maxLength={8}
                  placeholder="ABCD2345"
                  autoCapitalize="characters"
                  style={{ ...inputStyle, minHeight: 38, letterSpacing: '0.12em', fontWeight: 700 }}
                />
                <Button type="submit" disabled={!code.trim()} loading={busy}>参加</Button>
              </form>
            </Section>
          </div>
        </>
      )}

      {tab === 'account' && (
        <>
          <Section title="プロフィール" description="フレンドや講義の参加者に表示されます">
            <form
              style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 440 }}
              onSubmit={e => {
                e.preventDefault()
                void run(async () => {
                  await updateMyProfile({ handle, display_name: displayName })
                  const me = useStore.getState().profile
                  if (me) {
                    useSocialStore.setState(st => ({
                      users: { ...st.users, [me.id]: { id: me.id, handle: me.handle, display_name: me.display_name } },
                    }))
                  }
                  showToast('プロフィールを保存しました')
                })
              }}
            >
              <Field label="表示名" required help="本名でなくてもかまいません">
                <input value={displayName} onChange={e => setDisplayName(e.target.value)} maxLength={30} required style={{ ...inputStyle, minHeight: 38 }} />
              </Field>
              <Field label="ユーザーID" required help="英数字とアンダースコアで3〜20文字。フレンドに伝えると検索してもらえます">
                <HandleInput value={handle} onChange={v => setHandle(v.replace(/[^a-zA-Z0-9_]/g, ''))} />
              </Field>
              <div><Button type="submit" variant="primary" loading={busy}>保存する</Button></div>
            </form>
          </Section>

          <Section title="大学（任意）" description="登録すると、ヘッダーに大学名が表示されます。フレンドや講義の機能には影響しません">
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
                style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 440 }}
                onSubmit={e => {
                  e.preventDefault()
                  void run(async () => {
                    await setMySchoolEmail(schoolEmail)
                    setSchoolEmail('')
                    showToast('大学を登録しました')
                  })
                }}
              >
                <Field label="大学のメールアドレス" help="ドメイン（@より後ろ）から大学を判定します。メールは届きませんし、ほかの人にも表示されません">
                  <input type="email" value={schoolEmail} onChange={e => setSchoolEmail(e.target.value)} placeholder="you@s.yourschool.ac.jp" style={{ ...inputStyle, minHeight: 38 }} />
                </Field>
                <div><Button type="submit" disabled={!schoolEmail.trim()} loading={busy}>登録する</Button></div>
              </form>
            )}
          </Section>

          <Section title="ブロック中のユーザー" count={blockedIds.length} description="ブロックした相手からは申請や招待が届かず、互いのプロフィールも見えません">
            {blockedIds.length === 0 ? (
              <EmptyState compact title="ブロックしているユーザーはいません" />
            ) : (
              <List>
                {blockedIds.map(id => userItem(id, (
                  <Button size="sm" disabled={busy} onClick={() => run(async () => { await social.unblock(id); showToast('ブロックを解除しました') })}>解除</Button>
                )))}
              </List>
            )}
          </Section>
        </>
      )}
    </Sheet>
  )
}
