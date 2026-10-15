import { useState } from 'react'
import { toMessage } from '../../lib/errors'
import { LIMITS } from '../../lib/limits'
import { useSocialStore, userLabel } from '../../store/useSocialStore'
import { useToast } from '../ui/Toast'
import Sheet from '../ui/Sheet'
import { Avatar, Badge, Button, EmptyState, List, ListItem, Notice, Section, Tabs } from '../ui/kit'
import { inputStyle } from '../ui/styles'
import { InviteToParties } from './PartyInvite'
import type { UserSummary } from '../../types'

export type PeopleTab = 'friends' | 'parties'

interface Props {
  initialTab?: PeopleTab
  onClose: () => void
  onOpenProfile: (userId: string) => void
  onOpenParty: (partyId: string) => void
  onOpenInbox: () => void
}

const SUBTITLE: Record<PeopleTab, string> = {
  friends: 'ユーザーIDでつながった人です。フレンドはパーティーに招待できます',
  parties: '身内のグループです。メンバー同士で講義を見せ合い、まとめて参加できます',
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
        style={{ ...inputStyle, paddingLeft: 28 }}
      />
    </div>
  )
}

/** 仲間（フレンドとパーティー）。人とグループに関することはすべてここから */
export default function PeoplePanel({ initialTab = 'friends', onClose, onOpenProfile, onOpenParty, onOpenInbox }: Props) {
  const [tab, setTab] = useState<PeopleTab>(initialTab)
  const { incoming, invites } = useSocialStore()

  return (
    <Sheet title="仲間" subtitle={SUBTITLE[tab]} onClose={onClose} width={720} height={740}>
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { key: 'friends', label: 'フレンド' },
          { key: 'parties', label: 'パーティー' },
        ]}
      />
      {tab === 'friends' && (
        <>
          {incoming.length > 0 && <InboxNotice text={`フレンド申請が${incoming.length}件届いています`} onOpenInbox={onOpenInbox} />}
          <FriendsTab onOpenProfile={onOpenProfile} />
        </>
      )}
      {tab === 'parties' && (
        <>
          {invites.length > 0 && <InboxNotice text={`パーティーへの招待が${invites.length}件届いています`} onOpenInbox={onOpenInbox} />}
          <PartiesTab onOpenParty={onOpenParty} />
        </>
      )}
    </Sheet>
  )
}

/** 返事は受信箱でまとめて行う（入口を1か所にする） */
function InboxNotice({ text, onOpenInbox }: { text: string; onOpenInbox: () => void }) {
  return (
    <Notice>
      <span style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ flex: 1 }}>{text}</span>
        <Button size="sm" variant="primary" onClick={onOpenInbox}>受信箱で返事する</Button>
      </span>
    </Notice>
  )
}

function FriendsTab({ onOpenProfile }: { onOpenProfile: (userId: string) => void }) {
  const { showToast } = useToast()
  const social = useSocialStore()
  const { users, friends, outgoing, incoming, myId } = social
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<UserSummary | null | 'none'>(null)
  const [busy, setBusy] = useState(false)
  /** パーティーへの招待を開いているフレンド */
  const [inviteOpen, setInviteOpen] = useState<string | null>(null)

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    try { await fn() } catch (e: unknown) { showToast(toMessage(e), 'error') } finally { setBusy(false) }
  }

  const handleOf = (id: string) => (users[id]?.handle ? `@${users[id]?.handle}` : undefined)

  /** 検索結果の相手との関係に応じた操作（その場で申請まで終わる） */
  const resultAction = (u: UserSummary) => {
    if (u.id === myId) return <Badge>自分</Badge>
    if (friends.some(f => f.userId === u.id)) return <Badge tone="accent">フレンド</Badge>
    if (outgoing.some(r => r.addressee_id === u.id)) return <Badge>申請中</Badge>
    const inReq = incoming.find(r => r.requester_id === u.id)
    if (inReq) {
      return <Button size="sm" variant="primary" loading={busy} onClick={() => run(async () => { await social.acceptFriendRequest(inReq.id); showToast('フレンドになりました') })}>申請を承認</Button>
    }
    return (
      <Button size="sm" variant="primary" loading={busy} onClick={() => run(async () => {
        const r = await social.sendFriendRequest(u.id)
        showToast(r === 'accepted' ? 'フレンドになりました' : `${u.display_name}さんにフレンド申請を送りました`)
      })}>
        申請を送る
      </Button>
    )
  }

  return (
    <>
      <Section title="フレンドを追加" description="相手のユーザーIDを入れて検索します（なりすまし防止のため完全一致のみ）">
        <form
          style={{ display: 'flex', gap: 8 }}
          onSubmit={e => {
            e.preventDefault()
            void run(async () => setResult((await social.searchByHandle(query)) ?? 'none'))
          }}
        >
          <HandleInput value={query} onChange={v => { setQuery(v); setResult(null) }} placeholder="相手のユーザーID" />
          <Button type="submit" disabled={!query.trim()} loading={busy}>検索</Button>
        </form>
        {result === 'none' && <EmptyState compact title="見つかりませんでした" description="ユーザーIDのつづりを確認してください。" />}
        {result && result !== 'none' && (
          <ListItem
            leading={<Avatar name={result.display_name} size={34} />}
            title={result.display_name}
            subtitle={result.handle ? `@${result.handle}` : undefined}
            onClick={() => onOpenProfile(result.id)}
            trailing={resultAction(result)}
          />
        )}
      </Section>

      <Section title="フレンド" count={friends.length} description="「パーティーに招待」から、そのまま招待を送れます。名前を押すとプロフィールを開きます">
        {friends.length === 0 ? (
          <EmptyState title="まだフレンドがいません" description="上の検索欄に相手のユーザーIDを入れて、申請を送りましょう。" />
        ) : (
          <List>
            {friends.map(f => (
              <div key={f.userId} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <ListItem
                  leading={<Avatar name={userLabel(users, f.userId)} size={34} />}
                  title={userLabel(users, f.userId)}
                  subtitle={handleOf(f.userId)}
                  onClick={() => onOpenProfile(f.userId)}
                  trailing={
                    <Button size="sm" variant={inviteOpen === f.userId ? 'secondary' : 'ghost'} aria-expanded={inviteOpen === f.userId}
                      onClick={() => setInviteOpen(o => (o === f.userId ? null : f.userId))}>
                      パーティーに招待 {inviteOpen === f.userId ? '▲' : '▼'}
                    </Button>
                  }
                />
                {inviteOpen === f.userId && (
                  <div style={{ padding: '2px 12px 6px 58px' }}>
                    <InviteToParties userId={f.userId} />
                  </div>
                )}
              </div>
            ))}
          </List>
        )}
      </Section>

      {outgoing.length > 0 && (
        <Section title="送った申請" count={outgoing.length} description="相手が承認するとフレンドになります">
          <List>
            {outgoing.map(r => (
              <ListItem
                key={r.id}
                leading={<Avatar name={userLabel(users, r.addressee_id)} size={34} />}
                title={userLabel(users, r.addressee_id)}
                subtitle={handleOf(r.addressee_id)}
                onClick={() => onOpenProfile(r.addressee_id)}
                trailing={<Button size="sm" variant="ghost" disabled={busy} onClick={() => run(async () => { await social.removeFriendRequest(r.id); showToast('申請を取り下げました') })}>取り下げ</Button>}
              />
            ))}
          </List>
        </Section>
      )}
    </>
  )
}

function PartiesTab({ onOpenParty }: { onOpenParty: (partyId: string) => void }) {
  const { showToast } = useToast()
  const social = useSocialStore()
  const { parties } = social
  const [partyName, setPartyName] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    try { await fn() } catch (e: unknown) { showToast(toMessage(e), 'error') } finally { setBusy(false) }
  }

  return (
    <>
      <Section
        title="所属しているパーティー"
        count={parties.length}
        description={`押すと、共有されている講義・メンバー・招待をまとめて扱えます（最大${LIMITS.userMaxParties}個まで）`}
      >
        {parties.length === 0 ? (
          <EmptyState title="まだパーティーに所属していません" description="下でパーティーを作るか、メンバーからもらった招待コードで参加しましょう。" />
        ) : (
          <List>
            {parties.map(p => (
              <ListItem
                key={p.id}
                leading={<Avatar name={p.name} size={34} />}
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
        <Section title="パーティーを作る" description="作ったあと、フレンドを招待できます">
          <form
            style={{ display: 'flex', gap: 8 }}
            onSubmit={e => {
              e.preventDefault()
              void run(async () => {
                const party = await social.createParty(partyName)
                setPartyName('')
                showToast(`「${party.name}」を作りました。メンバーを招待しましょう`)
                onOpenParty(party.id)
              })
            }}
          >
            <input value={partyName} onChange={e => setPartyName(e.target.value)} maxLength={40} placeholder="例：ゼミ仲間" style={inputStyle} />
            <Button type="submit" variant="primary" disabled={!partyName.trim()} loading={busy}>作る</Button>
          </form>
        </Section>
        <Section title="招待コードで参加" description="メンバーからもらった8文字のコードを入れます">
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
              style={{ ...inputStyle, letterSpacing: '0.12em', fontWeight: 700 }}
            />
            <Button type="submit" disabled={!code.trim()} loading={busy}>参加</Button>
          </form>
        </Section>
      </div>
    </>
  )
}
