import { useEffect, useState } from 'react'
import { toMessage } from '../../lib/errors'
import { LIMITS } from '../../lib/limits'
import { useStore } from '../../store/useStore'
import { useSocialStore, userLabel } from '../../store/useSocialStore'
import { useToast } from '../ui/Toast'
import Sheet, { Avatar } from '../ui/Sheet'
import { btn, sectionTitle, inputStyle, emptyText, listRow } from '../ui/styles'
import { VISIBILITY_LABEL, formatDate, type AppNotification, type LectureVisibility, type UserSummary } from '../../types'

export type SocialTab = 'notifications' | 'friends' | 'parties' | 'account'

interface Props {
  initialTab?: SocialTab
  onClose: () => void
  onOpenProfile: (userId: string) => void
  onOpenParty: (partyId: string) => void
  onOpenLecture: (lectureId: string) => void
}

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'たった今'
  if (diff < 3600) return `${Math.floor(diff / 60)}分前`
  if (diff < 86400) return `${Math.floor(diff / 3600)}時間前`
  return `${Math.floor(diff / 86400)}日前`
}

export default function SocialPanel({ initialTab = 'notifications', onClose, onOpenProfile, onOpenParty, onOpenLecture }: Props) {
  const { showToast } = useToast()
  const social = useSocialStore()
  const { users, friends, incoming, outgoing, blockedIds, parties, invites, notifications } = social
  const { profile, updateMyProfile, subjects } = useStore()
  const [tab, setTab] = useState<SocialTab>(initialTab)
  const [busy, setBusy] = useState(false)

  const [query, setQuery] = useState('')
  const [searchResult, setSearchResult] = useState<UserSummary | null | 'none'>(null)
  const [partyName, setPartyName] = useState('')
  const [code, setCode] = useState('')
  const [handle, setHandle] = useState(profile?.handle ?? '')
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '')

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

  const onNotificationClick = (n: AppNotification) => {
    const p = n.payload
    switch (n.type) {
      case 'friend_request': if (typeof p.requester_id === 'string') onOpenProfile(p.requester_id); break
      case 'friend_accepted': if (typeof p.addressee_id === 'string') onOpenProfile(p.addressee_id); break
      case 'party_invite': setTab('parties'); break
      case 'lecture_apply_request':
      case 'task_due_changed':
      case 'lecture_visibility_changed':
      case 'lecture_apply_response':
        if (typeof p.lecture_id === 'string' && subjects.some(s => s.id === p.lecture_id)) onOpenLecture(p.lecture_id)
        break
    }
  }

  const tabs: { key: SocialTab; label: string; badge: number }[] = [
    { key: 'notifications', label: '通知', badge: notifications.filter(n => !n.read_at).length },
    { key: 'friends', label: 'フレンド', badge: incoming.length },
    { key: 'parties', label: 'パーティー', badge: invites.length },
    { key: 'account', label: 'アカウント', badge: 0 },
  ]

  const userRow = (id: string, actions: React.ReactNode) => (
    <div key={id} style={listRow}>
      <button
        onClick={() => onOpenProfile(id)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0, background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
      >
        <Avatar name={name(id)} />
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name(id)}</span>
        {users[id]?.handle && <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>@{users[id]?.handle}</span>}
      </button>
      {actions}
    </div>
  )

  return (
    <Sheet title="つながり" onClose={onClose} width={820} height={760}>
      <div role="tablist" style={{ display: 'flex', gap: 4, background: 'var(--bg-secondary)', borderRadius: 10, padding: 3 }}>
        {tabs.map(t => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            style={{
              flex: 1, border: 'none', borderRadius: 8, padding: '7px 6px', fontSize: 12, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
              background: tab === t.key ? 'var(--surface)' : 'transparent',
              color: tab === t.key ? 'var(--text-primary)' : 'var(--text-secondary)',
              boxShadow: tab === t.key ? 'var(--shadow-xs)' : 'none',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4,
            }}
          >
            {t.label}
            {t.badge > 0 && (
              <span style={{ background: 'var(--accent)', color: '#fff', borderRadius: 9999, fontSize: 10, padding: '0 6px', lineHeight: '16px' }}>{t.badge}</span>
            )}
          </button>
        ))}
      </div>

      {tab === 'notifications' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {notifications.length === 0 && <p style={emptyText}>通知はありません</p>}
          {notifications.map(n => (
            <button
              key={n.id}
              onClick={() => onNotificationClick(n)}
              style={{
                ...listRow, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', width: '100%',
                background: n.read_at ? 'var(--surface-warm)' : 'var(--accent-bg)',
                borderColor: n.read_at ? 'var(--border-light)' : 'var(--accent-muted)',
              }}
            >
              <span style={{ flex: 1, fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5 }}>{notificationText(n)}</span>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)', flexShrink: 0 }}>{timeAgo(n.created_at)}</span>
            </button>
          ))}
        </div>
      )}

      {tab === 'friends' && (
        <>
          <div>
            <p style={sectionTitle}>ユーザーIDで探す</p>
            <form
              style={{ display: 'flex', gap: 6 }}
              onSubmit={e => {
                e.preventDefault()
                void run(async () => {
                  const found = await social.searchByHandle(query)
                  setSearchResult(found ?? 'none')
                })
              }}
            >
              <div style={{ position: 'relative', flex: 1 }}>
                <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', fontSize: 14 }}>@</span>
                <input
                  value={query}
                  onChange={e => { setQuery(e.target.value); setSearchResult(null) }}
                  placeholder="river_taro"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  style={{ ...inputStyle, paddingLeft: 26 }}
                />
              </div>
              <button type="submit" style={btn('primary')} disabled={busy || !query.trim()}>検索</button>
            </form>
            <p style={{ ...emptyText, fontSize: 11 }}>なりすまし防止のため、ユーザーIDの完全一致でのみ検索できます。</p>
            {searchResult === 'none' && <p style={emptyText}>見つかりませんでした</p>}
            {searchResult && searchResult !== 'none' && userRow(searchResult.id, (
              <button style={btn('secondary', true)} onClick={() => onOpenProfile(searchResult.id)}>プロフィール</button>
            ))}
          </div>

          {incoming.length > 0 && (
            <div>
              <p style={sectionTitle}>届いた申請</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {incoming.map(r => userRow(r.requester_id, (
                  <span style={{ display: 'inline-flex', gap: 4 }}>
                    <button style={btn('primary', true)} disabled={busy} onClick={() => run(async () => { await social.acceptFriendRequest(r.id); showToast('フレンドになりました') })}>承認</button>
                    <button style={btn('secondary', true)} disabled={busy} onClick={() => run(async () => { await social.removeFriendRequest(r.id); showToast('申請を拒否しました') })}>拒否</button>
                  </span>
                )))}
              </div>
            </div>
          )}

          {outgoing.length > 0 && (
            <div>
              <p style={sectionTitle}>送った申請</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {outgoing.map(r => userRow(r.addressee_id, (
                  <button style={btn('secondary', true)} disabled={busy} onClick={() => run(async () => { await social.removeFriendRequest(r.id); showToast('申請を取り下げました') })}>取り下げ</button>
                )))}
              </div>
            </div>
          )}

          <div>
            <p style={sectionTitle}>フレンド（{friends.length}人）</p>
            {friends.length === 0 ? (
              <p style={emptyText}>まだフレンドがいません。ユーザーIDで探して申請しましょう</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {friends.map(f => userRow(f.userId, null))}
              </div>
            )}
          </div>
        </>
      )}

      {tab === 'parties' && (
        <>
          {invites.length > 0 && (
            <div>
              <p style={sectionTitle}>届いた招待</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {invites.map(inv => (
                  <div key={inv.id} style={listRow}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{inv.party_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{name(inv.inviter_id)}さんから・{inv.member_count}人</div>
                    </div>
                    <button style={btn('primary', true)} disabled={busy} onClick={() => run(async () => { await social.respondPartyInvite(inv.id, true); showToast(`「${inv.party_name}」に参加しました`) })}>参加</button>
                    <button style={btn('secondary', true)} disabled={busy} onClick={() => run(async () => { await social.respondPartyInvite(inv.id, false) })}>断る</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <p style={sectionTitle}>所属しているパーティー（{parties.length}/{LIMITS.userMaxParties}）</p>
            {parties.length === 0 ? (
              <p style={emptyText}>まだパーティーに所属していません</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {parties.map(p => (
                  <button
                    key={p.id}
                    onClick={() => onOpenParty(p.id)}
                    style={{ ...listRow, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', width: '100%' }}
                  >
                    <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{p.name}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{p.member_count}人 ›</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            <form
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
              <p style={sectionTitle}>パーティーを作る</p>
              <div style={{ display: 'flex', gap: 6 }}>
                <input value={partyName} onChange={e => setPartyName(e.target.value)} maxLength={40} placeholder="パーティー名" style={inputStyle} />
                <button type="submit" style={btn('primary')} disabled={busy || !partyName.trim()}>作成</button>
              </div>
            </form>
            <form
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
              <p style={sectionTitle}>招待コードで参加</p>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  value={code}
                  onChange={e => setCode(e.target.value.toUpperCase())}
                  maxLength={8}
                  placeholder="8文字のコード"
                  autoCapitalize="characters"
                  style={{ ...inputStyle, letterSpacing: '0.1em' }}
                />
                <button type="submit" style={btn('primary')} disabled={busy || !code.trim()}>参加</button>
              </div>
            </form>
          </div>
        </>
      )}

      {tab === 'account' && (
        <>
          <form
            style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
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
            <div>
              <label style={sectionTitle}>表示名</label>
              <input value={displayName} onChange={e => setDisplayName(e.target.value)} maxLength={30} required style={inputStyle} />
            </div>
            <div>
              <label style={sectionTitle}>ユーザーID</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', fontSize: 14 }}>@</span>
                <input
                  value={handle}
                  onChange={e => setHandle(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                  minLength={3}
                  maxLength={20}
                  required
                  autoCapitalize="off"
                  spellCheck={false}
                  style={{ ...inputStyle, paddingLeft: 26 }}
                />
              </div>
              <p style={{ ...emptyText, fontSize: 11 }}>英数字とアンダースコアで3〜20文字。フレンドに伝えると検索してもらえます。</p>
            </div>
            <div>
              <button type="submit" style={btn('primary')} disabled={busy}>保存</button>
            </div>
          </form>

          <div>
            <p style={sectionTitle}>ブロック中のユーザー</p>
            {blockedIds.length === 0 ? (
              <p style={emptyText}>ブロックしているユーザーはいません</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {blockedIds.map(id => userRow(id, (
                  <button style={btn('secondary', true)} disabled={busy} onClick={() => run(async () => { await social.unblock(id); showToast('ブロックを解除しました') })}>解除</button>
                )))}
              </div>
            )}
          </div>
        </>
      )}
    </Sheet>
  )
}
