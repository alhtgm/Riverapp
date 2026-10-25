import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { toMessage } from '../../lib/errors'
import { pickLectureColor } from '../../lib/colors'
import { semesterLabel, subjectInSemester } from '../../lib/semester'
import {
  LIMITS, INVITE_CODE_TTLS, INVITE_CODE_MAX_USES, DEFAULT_INVITE_CODE_TTL, DEFAULT_INVITE_CODE_MAX_USES,
} from '../../lib/limits'
import { useStore } from '../../store/useStore'
import { useSocialStore, userLabel } from '../../store/useSocialStore'
import { useToast } from '../ui/Toast'
import Sheet from '../ui/Sheet'
import { Avatar, Badge, Button, Confirm, EmptyState, Field, List, ListItem, Section, Tabs } from '../ui/kit'
import { JoinedInput } from '../ui/m3'
import { inputStyle } from '../ui/styles'
import LectureList from '../lecture/LectureList'
import MemberList from './MemberList'
import { usePartyInvites } from './usePartyInvites'
import { VISIBILITY_LABEL, type LectureSummary, type PartyInviteCode, type PartyMember, type Subject } from '../../types'

interface Props {
  partyId: string
  onClose: () => void
  onOpenLecture: (lectureId: string) => void
  onOpenProfile: (userId: string) => void
}

type Tab = 'lectures' | 'members' | 'settings'
type Scope = 'semester' | 'all'

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** 文字の役割（tokens.css の M3 type scale）をインラインスタイルで使う */
const type = (role: string): React.CSSProperties => ({
  fontSize: `var(--type-${role}-size)`,
  lineHeight: `var(--type-${role}-line)`,
  fontWeight: `var(--type-${role}-weight)`,
  letterSpacing: `var(--type-${role}-tracking)`,
})

function ScopeSelect({ value, onChange }: { value: Scope; onChange: (v: Scope) => void }) {
  const semester = useStore(s => s.semester)
  return (
    <select value={value} onChange={e => onChange(e.target.value as Scope)} aria-label="表示する学期"
      style={{ ...inputStyle, width: 'auto', minHeight: 40, padding: '0 var(--space-3)', ...type('label-large') }}>
      <option value="semester">{semesterLabel(semester)}</option>
      <option value="all">すべての学期</option>
    </select>
  )
}

/**
 * パーティーのホーム。このパーティーに関することはすべてここで行う。
 *   講義：共有されている講義にまとめて参加する／自分の講義をこのパーティーに見せる
 *   メンバー：フレンドや招待コードで招待する／メンバー一覧
 *   設定：名前の変更・退出
 */
export default function PartyHome({ partyId, onClose, onOpenLecture, onOpenProfile }: Props) {
  const { showToast } = useToast()
  const { parties, fetchSocial, version: socialVersion } = useSocialStore()
  const dataVersion = useStore(s => s.dataVersion)
  const party = parties.find(p => p.id === partyId)

  const [tab, setTab] = useState<Tab>('lectures')
  const [lectures, setLectures] = useState<LectureSummary[] | null>(null)
  const [members, setMembers] = useState<PartyMember[]>([])
  const [codes, setCodes] = useState<PartyInviteCode[]>([])
  const [name, setName] = useState(party?.name ?? '')
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

  // メンバー・講義の変化はリアルタイムで届くので、そのたびに読み直す
  useEffect(() => { void load() }, [load, socialVersion, dataVersion])

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

  return (
    <Sheet
      title={party.name}
      subtitle={`メンバー ${activeCount}/${LIMITS.partyMaxMembers}人・全員が対等で、誰でも招待や設定の変更ができます`}
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
          { key: 'settings', label: '設定' },
        ]}
      />

      {tab === 'lectures' && (
        <LecturesTab partyId={partyId} partyName={party.name} lectures={lectures} onChanged={load} onOpenLecture={onOpenLecture} />
      )}

      {tab === 'members' && (
        <>
          <InviteSection partyId={partyId} codes={codes} onChanged={load} />
          <MemberList
            targetType="party"
            targetId={partyId}
            members={members.map(m => ({ userId: m.user_id, status: m.status }))}
            onOpenProfile={onOpenProfile}
            onChanged={() => { void load(); void fetchSocial() }}
          />
        </>
      )}

      {tab === 'settings' && (
        <>
          <Section title="パーティー名" description="メンバーなら誰でも変更できます">
            <form
              style={{ maxWidth: 480 }}
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
              <JoinedInput
                value={name}
                onChange={e => setName(e.target.value)}
                maxLength={40}
                aria-label="パーティー名"
                actionLabel="保存する"
                actionVariant="primary"
                actionDisabled={name.trim() === party.name}
                loading={busy}
              />
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

// ---------------------------------------------------------------
// 講義タブ
// ---------------------------------------------------------------
function LecturesTab({ partyId, partyName, lectures, onChanged, onOpenLecture }: {
  partyId: string
  partyName: string
  lectures: LectureSummary[] | null
  onChanged: () => Promise<void>
  onOpenLecture: (lectureId: string) => void
}) {
  const { showToast } = useToast()
  const { subjects, semester, fetchAll, updateLectureSettings, dataVersion } = useStore()
  const [scope, setScope] = useState<Scope>('semester')
  const [busy, setBusy] = useState(false)
  /** 自分の講義のうち、このパーティーに見せているもの */
  const [shared, setShared] = useState<Set<string> | null>(null)

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    try { await fn() } catch (e: unknown) { showToast(toMessage(e), 'error') } finally { setBusy(false) }
  }

  const inScope = useCallback(
    (l: { year: number; term: Subject['term'] }) => scope === 'all' || subjectInSemester(l, semester),
    [scope, semester],
  )

  const subjectIdsKey = subjects.map(s => s.id).join(',')
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const { data } = await supabase
        .from('lecture_visible_parties')
        .select('lecture_id')
        .eq('party_id', partyId)
        .in('lecture_id', subjectIdsKey ? subjectIdsKey.split(',') : [])
      if (!cancelled) setShared(new Set(((data ?? []) as { lecture_id: string }[]).map(r => r.lecture_id)))
    })()
    return () => { cancelled = true }
  }, [partyId, subjectIdsKey, dataVersion])

  const shown = (lectures ?? []).filter(inScope)
  const notJoined = shown.filter(l => l.my_status === 'none')
  const myLectures = useMemo(() => subjects.filter(inScope), [subjects, inScope])
  const isShared = (l: Subject) => l.visibility === 'public' || (shared?.has(l.id) ?? false)
  const editable = myLectures.filter(l => l.visibility !== 'public')
  const allShared = editable.length > 0 && editable.every(isShared)

  const joinAll = () => run(async () => {
    let joined = 0
    let requested = 0
    let failed = 0
    for (const [i, l] of notJoined.entries()) {
      const { error } = l.apply_open
        ? await supabase.rpc('request_join_lecture', { p_lecture_id: l.id })
        : await supabase.rpc('join_lecture', { p_lecture_id: l.id, p_color: pickLectureColor(subjects.length + i) })
      if (error) failed++
      else if (l.apply_open) requested++
      else joined++
    }
    if (joined > 0) await fetchAll({ silent: true })
    await onChanged()
    showToast([
      joined && `${joined}件の講義に参加しました`,
      requested && `${requested}件に参加申請を送りました`,
      failed && `${failed}件はできませんでした`,
    ].filter(Boolean).join('・'), failed && !joined && !requested ? 'error' : undefined)
  })

  /** 「公開しない」の講義を見せるときは、公開範囲を「パーティー内」にする */
  const setShare = async (targets: Subject[], enabled: boolean) => {
    for (const l of targets) {
      if (enabled && l.visibility === 'private') await updateLectureSettings(l.id, { visibility: 'party', apply_open: false })
      const { error } = await supabase.rpc('set_lecture_visible_party', { p_lecture_id: l.id, p_party_id: partyId, p_enabled: enabled })
      if (error) throw error
    }
    setShared(prev => {
      const next = new Set(prev)
      for (const l of targets) {
        if (enabled) next.add(l.id)
        else next.delete(l.id)
      }
      return next
    })
  }

  return (
    <>
      <Section
        title="このパーティーで見られる講義"
        count={lectures === null ? undefined : shown.length}
        description="メンバーが参加している講義です。参加すると課題があなたのタイムラインに入ります"
        action={
          <>
            <ScopeSelect value={scope} onChange={setScope} />
            {notJoined.length > 0 && (
              <Button size="sm" variant="primary" loading={busy} onClick={() => void joinAll()}>
                まだの{notJoined.length}件にまとめて参加
              </Button>
            )}
          </>
        }
      >
        {lectures === null ? (
          <p style={{ ...type('body-medium'), color: 'var(--text-secondary)', margin: 0 }}>読み込み中...</p>
        ) : (
          <LectureList
            lectures={shown}
            onChanged={() => { void onChanged() }}
            onOpenLecture={onOpenLecture}
            emptyMessage={scope === 'semester' ? 'この学期の講義はまだありません（右上で「すべての学期」も選べます）' : 'まだ共有されている講義はありません'}
          />
        )}
      </Section>

      <Section
        title={`あなたの講義を「${partyName}」に見せる`}
        count={myLectures.length}
        description="チェックした講義は、このパーティーのメンバーが見つけて参加できます。押すとすぐ反映されます"
        action={editable.length > 1 && (
          <Button size="sm" disabled={busy || shared === null} onClick={() => run(async () => {
            await setShare(allShared ? editable : editable.filter(l => !isShared(l)), !allShared)
            showToast(allShared ? 'すべての講義を見せないようにしました' : 'すべての講義を見せるようにしました')
          })}>
            {allShared ? 'すべて外す' : 'すべて見せる'}
          </Button>
        )}
      >
        {myLectures.length === 0 ? (
          <EmptyState compact title="この学期の講義はありません" description="右上の学期を「すべての学期」にすると、ほかの学期の講義も選べます。" />
        ) : (
          <List>
            {myLectures.map(l => {
              const on = isShared(l)
              const locked = l.visibility === 'public'
              return (
                <label key={l.id} className="m3-state" style={{
                  display: 'flex', alignItems: 'center', gap: 'var(--space-3)', minHeight: 56, padding: 'var(--space-2) var(--space-4)',
                  border: `1px solid ${on ? 'transparent' : 'var(--border)'}`, borderRadius: 'var(--shape-md)',
                  background: on ? 'var(--accent-bg)' : 'var(--surface)', cursor: locked ? 'default' : 'pointer',
                }}>
                  <input
                    type="checkbox"
                    checked={on}
                    disabled={busy || shared === null || locked}
                    onChange={() => void run(async () => {
                      await setShare([l], !on)
                      showToast(on ? `「${l.name}」を見せないようにしました` : `「${l.name}」を「${partyName}」に見せるようにしました`)
                    })}
                    style={{ width: 18, height: 18, accentColor: 'var(--accent-solid)' }}
                  />
                  <span style={{ width: 12, height: 12, borderRadius: 'var(--shape-xs)', background: l.color, flexShrink: 0 }} />
                  <span style={{ flex: 1, minWidth: 0, ...type('body-large'), fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.name}</span>
                  <span style={{ ...type('body-small'), color: 'var(--text-secondary)', flexShrink: 0 }}>
                    {locked ? '全体公開（誰でも見られます）' : `${VISIBILITY_LABEL[l.visibility]}・${l.apply_open ? '参加は承認制' : 'すぐ参加できる'}`}
                  </span>
                </label>
              )
            })}
          </List>
        )}
      </Section>
    </>
  )
}

// ---------------------------------------------------------------
// メンバーを招待
// ---------------------------------------------------------------
function InviteSection({ partyId, codes, onChanged }: { partyId: string; codes: PartyInviteCode[]; onChanged: () => Promise<void> }) {
  const { showToast } = useToast()
  const { friends, users, parties } = useSocialStore()
  const party = parties.find(p => p.id === partyId)
  const { loaded, stateOf, invite, busy: inviting } = usePartyInvites()
  const [showCode, setShowCode] = useState(false)
  const [ttl, setTtl] = useState<string>(DEFAULT_INVITE_CODE_TTL)
  const [maxUses, setMaxUses] = useState<number>(DEFAULT_INVITE_CODE_MAX_USES)
  const [busy, setBusy] = useState(false)

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    try { await fn() } catch (e: unknown) { showToast(toMessage(e), 'error') } finally { setBusy(false) }
  }

  const candidates = friends.filter(f => stateOf(partyId, f.userId) !== 'member')
  const invitable = candidates.filter(f => !stateOf(partyId, f.userId))
  const full = (party?.member_count ?? 0) >= LIMITS.partyMaxMembers

  return (
    <Section
      title="メンバーを招待"
      description="フレンドは「招待」を押すだけで招待できます。相手が受信箱で承諾するとメンバーになります"
      action={invitable.length > 1 && !full && (
        <Button size="sm" variant="primary" disabled={!loaded || inviting} onClick={() => void invite(partyId, invitable.map(f => f.userId))}>
          フレンド全員を招待（{invitable.length}）
        </Button>
      )}
    >
      {friends.length === 0 ? (
        <EmptyState compact title="まだフレンドがいません" description="フレンドでない人は、下の招待コードで招待できます。" />
      ) : candidates.length === 0 ? (
        <EmptyState compact title="フレンドは全員メンバーです" description="ほかの人は、下の招待コードで招待できます。" />
      ) : (
        <List>
          {candidates.map(f => {
            const st = stateOf(partyId, f.userId)
            return (
              <ListItem
                key={f.userId}
                leading={<Avatar name={userLabel(users, f.userId)} size={32} />}
                title={userLabel(users, f.userId)}
                subtitle={users[f.userId]?.handle ? `@${users[f.userId]?.handle}` : undefined}
                trailing={st === 'invited' ? <Badge tone="info">招待中</Badge>
                  : st === 'excluded' ? <Badge tone="danger">除外中</Badge>
                    : (
                      <Button size="sm" variant="primary" disabled={!loaded || inviting || full} title={full ? '満員のため招待できません' : undefined}
                        onClick={() => void invite(partyId, [f.userId])}>
                        招待
                      </Button>
                    )}
              />
            )
          })}
        </List>
      )}

      <div>
        <Button size="sm" variant="ghost" aria-expanded={showCode} onClick={() => setShowCode(s => !s)}>
          フレンド以外の人を招待する（招待コード）{showCode ? ' ▲' : ' ▼'}
        </Button>
      </div>
      {showCode && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, alignItems: 'end' }}>
            <Field label="有効期限" required>
              <select value={ttl} onChange={e => setTtl(e.target.value)} style={inputStyle}>
                {INVITE_CODE_TTLS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </Field>
            <Field label="使える回数" required>
              <select value={maxUses} onChange={e => setMaxUses(Number(e.target.value))} style={inputStyle}>
                {INVITE_CODE_MAX_USES.map(n => <option key={n} value={n}>{n}回</option>)}
              </select>
            </Field>
            <Button
              loading={busy}
              onClick={() => run(async () => {
                const { error } = await supabase.rpc('create_party_invite_code', { p_party_id: partyId, p_ttl: ttl, p_max_uses: maxUses })
                if (error) throw error
                await onChanged()
                showToast('招待コードを発行しました。相手に伝えて「仲間 › パーティー」で入力してもらいます')
              })}
            >
              コードを発行
            </Button>
          </div>
          {codes.length > 0 && (
            <List>
              {codes.map(c => (
                <ListItem
                  key={c.id}
                  title={<code style={{ ...type('title-large'), fontWeight: 'var(--type-weight-emphasized)', letterSpacing: '0.14em' }}>{c.code}</code>}
                  subtitle={`${formatDateTime(c.expires_at)}まで・${c.use_count}/${c.max_uses}回使用`}
                  trailing={
                    <>
                      <Button size="sm" onClick={() => {
                        void navigator.clipboard?.writeText(c.code).then(
                          () => showToast('コピーしました'),
                          () => showToast('コピーできませんでした', 'error'),
                        )
                      }}>
                        コピー
                      </Button>
                      <Button size="sm" variant="ghost" style={{ color: 'var(--danger)' }} disabled={busy}
                        onClick={() => run(async () => {
                          const { error } = await supabase.rpc('revoke_party_invite_code', { p_code_id: c.id })
                          if (error) throw error
                          await onChanged()
                          showToast('招待コードを無効にしました')
                        })}>
                        無効にする
                      </Button>
                    </>
                  }
                />
              ))}
            </List>
          )}
        </div>
      )}
    </Section>
  )
}
