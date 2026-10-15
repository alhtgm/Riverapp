import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { toMessage } from '../../lib/errors'
import {
  LIMITS, INVITE_CODE_TTLS, INVITE_CODE_MAX_USES, DEFAULT_INVITE_CODE_TTL, DEFAULT_INVITE_CODE_MAX_USES,
} from '../../lib/limits'
import { useSocialStore, userLabel } from '../../store/useSocialStore'
import { useToast } from '../ui/Toast'
import Sheet from '../ui/Sheet'
import { Button, Confirm, EmptyState, Field, List, ListItem, Section, Tabs } from '../ui/kit'
import { inputStyle } from '../ui/styles'
import LectureList from '../lecture/LectureList'
import MemberList from './MemberList'
import type { LectureSummary, PartyInviteCode, PartyMember } from '../../types'

interface Props {
  partyId: string
  onClose: () => void
  onOpenLecture: (lectureId: string) => void
  onOpenProfile: (userId: string) => void
}

type Tab = 'lectures' | 'members' | 'invite' | 'settings'

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const selectStyle = { ...inputStyle, minHeight: 38 }

export default function PartyHome({ partyId, onClose, onOpenLecture, onOpenProfile }: Props) {
  const { showToast } = useToast()
  const { parties, friends, users, fetchSocial, version: socialVersion } = useSocialStore()
  const party = parties.find(p => p.id === partyId)

  const [tab, setTab] = useState<Tab>('lectures')
  const [lectures, setLectures] = useState<LectureSummary[] | null>(null)
  const [members, setMembers] = useState<PartyMember[]>([])
  const [codes, setCodes] = useState<PartyInviteCode[]>([])
  const [name, setName] = useState(party?.name ?? '')
  const [ttl, setTtl] = useState<string>(DEFAULT_INVITE_CODE_TTL)
  const [maxUses, setMaxUses] = useState<number>(DEFAULT_INVITE_CODE_MAX_USES)
  const [inviteFriend, setInviteFriend] = useState('')
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const [lecRes, memRes, codeRes] = await Promise.all([
      supabase.rpc('get_party_lectures', { p_party_id: partyId }),
      supabase.from('party_members').select('party_id, user_id, status, joined_at').eq('party_id', partyId).in('status', ['active', 'excluded']),
      supabase.from('party_invite_codes').select('*').eq('party_id', partyId).is('revoked_at', null)
        .gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false }),
    ])
    setLectures((lecRes.data ?? []) as LectureSummary[])
    setMembers((memRes.data ?? []) as PartyMember[])
    setCodes(((codeRes.data ?? []) as PartyInviteCode[]).filter(c => c.use_count < c.max_uses))
  }, [partyId])

  // メンバーの参加・退出などはリアルタイムで届くので、そのたびに読み直す
  useEffect(() => { void load() }, [load, socialVersion])

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    try { await fn() } catch (e: unknown) { showToast(toMessage(e), 'error') } finally { setBusy(false) }
  }

  if (!party) {
    return (
      <Sheet title="パーティー" onClose={onClose} zIndex={310}>
        <EmptyState title="このパーティーは表示できません" description="退出したか、パーティーがなくなった可能性があります。" />
      </Sheet>
    )
  }

  const activeCount = members.filter(m => m.status === 'active').length
  const memberIds = new Set(members.filter(m => m.status === 'active').map(m => m.user_id))
  const invitableFriends = friends.filter(f => !memberIds.has(f.userId))

  return (
    <Sheet
      title={party.name}
      subtitle={`メンバー ${activeCount}/${LIMITS.partyMaxMembers}人・全員が対等で、リーダーはいません`}
      onClose={onClose}
      zIndex={310}
      width={800}
      height={760}
    >
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { key: 'lectures', label: '講義' },
          { key: 'members', label: 'メンバー' },
          { key: 'invite', label: '招待' },
          { key: 'settings', label: '設定' },
        ]}
      />

      {tab === 'lectures' && (
        <Section
          title="メンバーが参加している講義"
          count={lectures?.length}
          description="このパーティーに見せている講義の一覧です。参加すると課題があなたのタイムラインに入ります"
        >
          {lectures === null ? (
            <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: 0 }}>読み込み中...</p>
          ) : (
            <LectureList
              lectures={lectures}
              onChanged={load}
              onOpenLecture={onOpenLecture}
              emptyMessage="まだ共有されている講義はありません"
            />
          )}
        </Section>
      )}

      {tab === 'members' && (
        <MemberList
          targetType="party"
          targetId={partyId}
          members={members.map(m => ({ userId: m.user_id, status: m.status }))}
          onOpenProfile={onOpenProfile}
          onChanged={() => { void load(); void fetchSocial() }}
        />
      )}

      {tab === 'invite' && (
        <>
          <Section title="フレンドを招待" description="相手に通知が届き、承諾するとメンバーになります">
            {invitableFriends.length === 0 ? (
              <EmptyState compact title="招待できるフレンドがいません" description="フレンドが全員参加済みか、まだフレンドがいません。下の招待コードも使えます。" />
            ) : (
              <div style={{ display: 'flex', gap: 8 }}>
                <select value={inviteFriend} onChange={e => setInviteFriend(e.target.value)} style={{ ...selectStyle, flex: 1 }}>
                  <option value="">フレンドを選んでください</option>
                  {invitableFriends.map(f => <option key={f.userId} value={f.userId}>{userLabel(users, f.userId)}</option>)}
                </select>
                <Button
                  variant="primary"
                  disabled={!inviteFriend}
                  loading={busy}
                  onClick={() => run(async () => {
                    const { error } = await supabase.rpc('invite_to_party', { p_party_id: partyId, p_invitee_id: inviteFriend })
                    if (error) throw error
                    setInviteFriend('')
                    showToast('招待を送りました')
                  })}
                >
                  招待する
                </Button>
              </div>
            )}
          </Section>

          <Section title="招待コード" count={codes.length} description="フレンドでない人も、コードを入力すると参加できます。メンバーなら誰でも発行・無効化できます">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, alignItems: 'end' }}>
              <Field label="有効期限" required>
                <select value={ttl} onChange={e => setTtl(e.target.value)} style={selectStyle}>
                  {INVITE_CODE_TTLS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </Field>
              <Field label="使える回数" required>
                <select value={maxUses} onChange={e => setMaxUses(Number(e.target.value))} style={selectStyle}>
                  {INVITE_CODE_MAX_USES.map(n => <option key={n} value={n}>{n}回</option>)}
                </select>
              </Field>
              <Button
                variant={invitableFriends.length === 0 ? 'primary' : 'secondary'}
                loading={busy}
                onClick={() => run(async () => {
                  const { error } = await supabase.rpc('create_party_invite_code', { p_party_id: partyId, p_ttl: ttl, p_max_uses: maxUses })
                  if (error) throw error
                  await load()
                  showToast('招待コードを発行しました')
                })}
              >
                コードを発行
              </Button>
            </div>
            {codes.length === 0 ? (
              <EmptyState compact title="有効な招待コードはありません" />
            ) : (
              <List>
                {codes.map(c => (
                  <ListItem
                    key={c.id}
                    title={<code style={{ fontSize: 17, fontWeight: 700, letterSpacing: '0.14em' }}>{c.code}</code>}
                    subtitle={`${formatDateTime(c.expires_at)}まで・${c.use_count}/${c.max_uses}回使用`}
                    trailing={
                      <>
                        <Button
                          size="sm"
                          onClick={() => {
                            void navigator.clipboard?.writeText(c.code).then(
                              () => showToast('コピーしました'),
                              () => showToast('コピーできませんでした', 'error'),
                            )
                          }}
                        >
                          コピー
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          style={{ color: 'var(--danger)' }}
                          disabled={busy}
                          onClick={() => run(async () => {
                            const { error } = await supabase.rpc('revoke_party_invite_code', { p_code_id: c.id })
                            if (error) throw error
                            await load()
                            showToast('招待コードを無効にしました')
                          })}
                        >
                          無効化
                        </Button>
                      </>
                    }
                  />
                ))}
              </List>
            )}
          </Section>
        </>
      )}

      {tab === 'settings' && (
        <>
          <Section title="パーティー名" description="メンバーなら誰でも変更できます。変更は履歴に残ります">
            <form
              style={{ display: 'flex', gap: 8, maxWidth: 480 }}
              onSubmit={e => {
                e.preventDefault()
                void run(async () => {
                  const n = name.trim()
                  if (!n) throw new Error('パーティー名を入力してください')
                  const { error } = await supabase.from('parties').update({ name: n }).eq('id', partyId)
                  if (error) throw error
                  await fetchSocial()
                  showToast('パーティー名を変更しました')
                })
              }}
            >
              <input value={name} onChange={e => setName(e.target.value)} maxLength={40} style={{ ...inputStyle, minHeight: 38 }} />
              <Button type="submit" variant="primary" disabled={name.trim() === party.name} loading={busy}>保存する</Button>
            </form>
          </Section>

          <Section title="パーティーを退出" description="いつでも退出できます。もう一度入るには招待が必要です">
            {confirmLeave ? (
              <Confirm
                message={`「${party.name}」を退出しますか？`}
                detail={activeCount <= 1
                  ? 'あなたが最後の1人なので、パーティーはなくなります（復活はできません）。'
                  : 'このパーティーにだけ見せている講義は、あなたから見えなくなることがあります。'}
                confirmLabel="退出する"
                busy={busy}
                onCancel={() => setConfirmLeave(false)}
                onConfirm={() => run(async () => {
                  const { error } = await supabase.rpc('leave_party', { p_party_id: partyId })
                  if (error) throw error
                  await fetchSocial()
                  showToast('パーティーを退出しました')
                  onClose()
                })}
              />
            ) : (
              <div><Button variant="danger" onClick={() => setConfirmLeave(true)}>退出する</Button></div>
            )}
          </Section>
        </>
      )}
    </Sheet>
  )
}
