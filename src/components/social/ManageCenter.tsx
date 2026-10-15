import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from '../../lib/supabase'
import { toMessage } from '../../lib/errors'
import { LIMITS } from '../../lib/limits'
import { pickLectureColor } from '../../lib/colors'
import { semesterLabel, subjectInSemester } from '../../lib/semester'
import { useStore } from '../../store/useStore'
import { useSocialStore, userLabel } from '../../store/useSocialStore'
import { useToast } from '../ui/Toast'
import Sheet from '../ui/Sheet'
import { Avatar, Badge, Button, EmptyState, List, ListItem, Section, Tabs } from '../ui/kit'
import { inputStyle } from '../ui/styles'
import { TERM_LABEL, VISIBILITY_LABEL, type LectureSummary, type Subject } from '../../types'

export type ManageTab = 'inbox' | 'share' | 'invite' | 'join'

interface Props {
  initialTab?: ManageTab
  onClose: () => void
  onOpenProfile: (userId: string) => void
}

const TAB_INFO: Record<ManageTab, { label: string; subtitle: string }> = {
  inbox: { label: '届いた申請', subtitle: '講義への参加申請・フレンド申請・パーティーの招待に、ここでまとめて返事ができます' },
  share: { label: '講義の公開', subtitle: '自分の講義をどのパーティーに見せるかを、表のマスを押すだけで切り替えられます' },
  invite: { label: 'パーティーに招待', subtitle: 'フレンドをパーティーに招待します。列の「まとめて招待」で全員に送れます' },
  join: { label: '講義に参加', subtitle: 'パーティーのメンバーが見せている講義に、まとめて参加・申請できます' },
}

const TAB_ORDER: ManageTab[] = ['inbox', 'share', 'invite', 'join']

type Scope = 'semester' | 'all'

function useIsMobile() {
  const [mobile, setMobile] = useState(() => window.innerWidth < 640)
  useEffect(() => {
    const onResize = () => setMobile(window.innerWidth < 640)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return mobile
}

// ---------------------------------------------------------------
// 表（行 × パーティー）の部品
// ---------------------------------------------------------------

const checkIcon = (
  <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
    <path d="M2.5 7.5l3 3 6-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

/** 押すとオン・オフが切り替わるマス */
function ToggleCell({ on, disabled, label, onClick }: { on: boolean; disabled?: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      style={{
        width: 30, height: 30, borderRadius: 8, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        border: `1.5px solid ${on ? 'var(--accent)' : 'var(--border)'}`,
        background: on ? 'var(--accent)' : 'var(--surface)', color: '#fff',
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.45 : 1, padding: 0,
        transition: 'background 0.15s, border-color 0.15s',
      }}
    >
      {on && checkIcon}
    </button>
  )
}

/** 1列目が固定され、横にスクロールできる表 */
function Matrix({ columns, rows, emptyText }: {
  columns: { key: string; header: ReactNode }[]
  rows: { key: string; label: ReactNode; cells: ReactNode[] }[]
  emptyText?: ReactNode
}) {
  if (rows.length === 0) return <>{emptyText}</>
  const cellStyle = { padding: '8px 10px', borderBottom: '1px solid var(--border-light)', textAlign: 'center' as const, verticalAlign: 'middle' as const }
  return (
    <div style={{ overflowX: 'auto', border: '1px solid var(--border-light)', borderRadius: 12, background: 'var(--surface)' }}>
      <table style={{ borderCollapse: 'separate', borderSpacing: 0, width: '100%', fontSize: 13 }}>
        <thead>
          <tr>
            <th style={{ ...cellStyle, textAlign: 'left', position: 'sticky', left: 0, background: 'var(--surface-warm)', zIndex: 1, minWidth: 150 }} />
            {columns.map(c => (
              <th key={c.key} style={{ ...cellStyle, background: 'var(--surface-warm)', fontWeight: 700, color: 'var(--text-secondary)', minWidth: 96 }}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.key}>
              <td style={{ ...cellStyle, textAlign: 'left', position: 'sticky', left: 0, background: 'var(--surface)', zIndex: 1 }}>{r.label}</td>
              {r.cells.map((cell, i) => <td key={columns[i]?.key ?? i} style={cellStyle}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** 列見出し（名前＋まとめて操作するボタン） */
function ColumnHeader({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <span style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)' }} title={title}>{title}</span>
      {sub && <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-tertiary)' }}>{sub}</span>}
      {action}
    </div>
  )
}

function ScopeSelect({ value, onChange }: { value: Scope; onChange: (v: Scope) => void }) {
  const semester = useStore(s => s.semester)
  return (
    <select value={value} onChange={e => onChange(e.target.value as Scope)} aria-label="表示する学期" style={{ ...inputStyle, width: 'auto', minHeight: 30, padding: '4px 10px', fontSize: 12 }}>
      <option value="semester">{semesterLabel(semester)}</option>
      <option value="all">すべての学期</option>
    </select>
  )
}

function lectureMeta(l: { year: number; term: keyof typeof TERM_LABEL }) {
  return `${l.year}年度 ${TERM_LABEL[l.term]}`
}

// ---------------------------------------------------------------
// 本体
// ---------------------------------------------------------------

/**
 * まとめて管理（Discord のサーバー設定のように、講義・パーティーをまたいで一括で操作する画面）。
 * どの操作も「この画面を開く → 1回押す」で終わるようにする。
 */
export default function ManageCenter({ initialTab = 'inbox', onClose, onOpenProfile }: Props) {
  const [tab, setTab] = useState<ManageTab>(initialTab)
  const isMobile = useIsMobile()
  const social = useSocialStore()
  const inboxCount = social.applyRequests.length + social.incoming.length + social.invites.length

  useEffect(() => { void social.fetchSocial() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const nav = isMobile ? (
    <Tabs
      value={tab}
      onChange={setTab}
      tabs={TAB_ORDER.map(k => ({ key: k, label: TAB_INFO[k].label, badge: k === 'inbox' ? inboxCount : undefined }))}
    />
  ) : (
    <nav aria-label="管理メニュー" style={{ display: 'flex', flexDirection: 'column', gap: 2, width: 168, flexShrink: 0 }}>
      {TAB_ORDER.map(k => {
        const active = tab === k
        return (
          <button
            key={k}
            type="button"
            aria-current={active ? 'page' : undefined}
            onClick={() => setTab(k)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '9px 12px', borderRadius: 8,
              border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, textAlign: 'left',
              fontWeight: active ? 700 : 500,
              background: active ? 'var(--bg-secondary)' : 'transparent',
              color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
            }}
            onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--bg-secondary)' }}
            onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
          >
            <span style={{ flex: 1 }}>{TAB_INFO[k].label}</span>
            {k === 'inbox' && inboxCount > 0 && <Badge tone="accent" solid>{inboxCount}</Badge>}
          </button>
        )
      })}
    </nav>
  )

  const content = (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 24 }}>
      {tab === 'inbox' && <InboxTab onOpenProfile={onOpenProfile} />}
      {tab === 'share' && <ShareTab />}
      {tab === 'invite' && <InviteTab onOpenProfile={onOpenProfile} />}
      {tab === 'join' && <JoinTab />}
    </div>
  )

  return (
    <Sheet title="まとめて管理" subtitle={TAB_INFO[tab].subtitle} onClose={onClose} width={980} height={760} zIndex={305}>
      {isMobile ? (
        <>
          {nav}
          {content}
        </>
      ) : (
        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
          <div style={{ position: 'sticky', top: 0, borderRight: '1px solid var(--border-light)', paddingRight: 12 }}>{nav}</div>
          {content}
        </div>
      )}
    </Sheet>
  )
}

function useRun() {
  const { showToast } = useToast()
  const [busy, setBusy] = useState(false)
  const run = useCallback(async (fn: () => Promise<void>) => {
    setBusy(true)
    try { await fn() } catch (e: unknown) { showToast(toMessage(e), 'error') } finally { setBusy(false) }
  }, [showToast])
  return { busy, run, showToast }
}

// ---------------------------------------------------------------
// 届いた申請
// ---------------------------------------------------------------
function InboxTab({ onOpenProfile }: { onOpenProfile: (userId: string) => void }) {
  const social = useSocialStore()
  const fetchAll = useStore(s => s.fetchAll)
  const { busy, run, showToast } = useRun()
  const { applyRequests, incoming, invites, users } = social

  const approveApply = (ids: string[], approve: boolean) => run(async () => {
    const failed = await social.respondApplyRequests(ids, approve)
    const done = ids.length - failed
    showToast(
      `${done}件の参加申請を${approve ? '承認' : '却下'}しました${failed ? `（${failed}件はほかの人が対応済みか期限切れでした）` : ''}`,
      failed && !done ? 'error' : undefined,
    )
  })

  const acceptFriends = (ids: string[]) => run(async () => {
    for (const id of ids) await social.acceptFriendRequest(id)
    showToast(ids.length > 1 ? `${ids.length}人とフレンドになりました` : 'フレンドになりました')
  })

  if (applyRequests.length + incoming.length + invites.length === 0) {
    return <EmptyState title="対応が必要な申請はありません" description="講義への参加申請やフレンド申請、パーティーの招待が届くとここに並びます。" />
  }

  return (
    <>
      {applyRequests.length > 0 && (
        <Section
          title="講義への参加申請"
          count={applyRequests.length}
          description="あなたが参加している講義に届いた申請です。承認すると相手が講義に参加します"
          action={applyRequests.length > 1 && (
            <Button size="sm" variant="primary" loading={busy} onClick={() => approveApply(applyRequests.map(r => r.id), true)}>
              すべて承認（{applyRequests.length}）
            </Button>
          )}
        >
          <List>
            {applyRequests.map(r => (
              <ListItem
                key={r.id}
                leading={<Avatar name={r.display_name} size={34} />}
                title={<>{r.display_name ?? 'ユーザー'}<span style={{ color: 'var(--text-tertiary)', fontWeight: 500 }}> → </span>{r.lecture_title}</>}
                subtitle={r.handle ? `@${r.handle}` : undefined}
                onClick={() => onOpenProfile(r.user_id)}
                trailing={
                  <>
                    <Button size="sm" disabled={busy} onClick={() => approveApply([r.id], false)}>却下</Button>
                    <Button size="sm" variant="primary" disabled={busy} onClick={() => approveApply([r.id], true)}>承認</Button>
                  </>
                }
              />
            ))}
          </List>
        </Section>
      )}

      {incoming.length > 0 && (
        <Section
          title="フレンド申請"
          count={incoming.length}
          description="承認するとフレンドになります"
          action={incoming.length > 1 && (
            <Button size="sm" loading={busy} onClick={() => acceptFriends(incoming.map(r => r.id))}>すべて承認（{incoming.length}）</Button>
          )}
        >
          <List>
            {incoming.map(r => (
              <ListItem
                key={r.id}
                leading={<Avatar name={userLabel(users, r.requester_id)} size={34} />}
                title={userLabel(users, r.requester_id)}
                subtitle={users[r.requester_id]?.handle ? `@${users[r.requester_id]?.handle}` : undefined}
                onClick={() => onOpenProfile(r.requester_id)}
                trailing={
                  <>
                    <Button size="sm" disabled={busy} onClick={() => run(async () => { await social.removeFriendRequest(r.id); showToast('申請を拒否しました') })}>拒否</Button>
                    <Button size="sm" variant="primary" disabled={busy} onClick={() => acceptFriends([r.id])}>承認</Button>
                  </>
                }
              />
            ))}
          </List>
        </Section>
      )}

      {invites.length > 0 && (
        <Section title="パーティーへの招待" count={invites.length} description="参加するとメンバー同士で講義を共有できます">
          <List>
            {invites.map(inv => (
              <ListItem
                key={inv.id}
                title={inv.party_name}
                subtitle={`${userLabel(users, inv.inviter_id)}さんから・メンバー${inv.member_count}人`}
                trailing={
                  <>
                    <Button size="sm" disabled={busy} onClick={() => run(async () => { await social.respondPartyInvite(inv.id, false); showToast('招待を断りました') })}>断る</Button>
                    <Button size="sm" variant="primary" disabled={busy} onClick={() => run(async () => {
                      await social.respondPartyInvite(inv.id, true)
                      await fetchAll()
                      showToast(`「${inv.party_name}」に参加しました`)
                    })}>参加する</Button>
                  </>
                }
              />
            ))}
          </List>
        </Section>
      )}
    </>
  )
}

// ---------------------------------------------------------------
// 講義の公開（自分の講義 × パーティー）
// ---------------------------------------------------------------
function ShareTab() {
  const { subjects, semester, updateLectureSettings, dataVersion } = useStore()
  const parties = useSocialStore(s => s.parties)
  const { busy, run, showToast } = useRun()
  const [scope, setScope] = useState<Scope>('semester')
  /** `${lectureId}:${partyId}` */
  const [visible, setVisible] = useState<Set<string> | null>(null)

  const lectures = useMemo(
    () => (scope === 'semester' ? subjects.filter(s => subjectInSemester(s, semester)) : subjects),
    [scope, subjects, semester],
  )

  const subjectIdsKey = subjects.map(s => s.id).join(',')
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const { data, error } = await supabase
        .from('lecture_visible_parties')
        .select('lecture_id, party_id')
        .in('lecture_id', subjectIdsKey ? subjectIdsKey.split(',') : [])
      if (cancelled) return
      if (error) { showToast(toMessage(error), 'error'); return }
      setVisible(new Set(((data ?? []) as { lecture_id: string; party_id: string }[]).map(r => `${r.lecture_id}:${r.party_id}`)))
    })()
    return () => { cancelled = true }
  }, [subjectIdsKey, showToast, dataVersion])

  const isOn = (l: Subject, partyId: string) => l.visibility === 'public' || (visible?.has(`${l.id}:${partyId}`) ?? false)

  /** 公開しない講義をパーティーに見せるときは、公開範囲を「パーティー内」にする */
  const setShared = async (targets: Subject[], partyId: string, enabled: boolean) => {
    for (const l of targets) {
      if (enabled && l.visibility === 'private') await updateLectureSettings(l.id, { visibility: 'party', apply_open: false })
      const { error } = await supabase.rpc('set_lecture_visible_party', { p_lecture_id: l.id, p_party_id: partyId, p_enabled: enabled })
      if (error) throw error
    }
    setVisible(prev => {
      const next = new Set(prev)
      for (const l of targets) {
        if (enabled) next.add(`${l.id}:${partyId}`)
        else next.delete(`${l.id}:${partyId}`)
      }
      return next
    })
  }

  const setApply = async (targets: Subject[], open: boolean) => {
    for (const l of targets) await updateLectureSettings(l.id, { apply_open: open })
  }

  if (parties.length === 0 && lectures.length > 0) {
    return <EmptyState title="所属しているパーティーがありません" description="メニューの「パーティー」から作るか、招待コードで参加すると、ここで講義を見せる相手を選べます。" />
  }

  const editable = lectures.filter(l => l.visibility !== 'public')
  const partyName = (id: string) => parties.find(p => p.id === id)?.name ?? 'パーティー'

  return (
    <Section
      title="講義を見せるパーティー"
      count={lectures.length}
      description="マスを押すとすぐ反映されます。「公開しない」の講義を見せると、公開範囲は「パーティー内」に変わります。全体公開の講義は誰からも見えます"
      action={<ScopeSelect value={scope} onChange={setScope} />}
    >
      <Matrix
        emptyText={<EmptyState compact title="この学期の講義はありません" description="右上で「すべての学期」に切り替えると、ほかの学期の講義も表示されます。" />}
        columns={[
          ...parties.map(p => {
            const allOn = editable.length > 0 && editable.every(l => isOn(l, p.id))
            return {
              key: p.id,
              header: (
                <ColumnHeader
                  title={p.name}
                  sub={`${p.member_count}人`}
                  action={editable.length > 0 && (
                    <Button size="sm" variant="ghost" disabled={busy || visible === null} style={{ minHeight: 24, fontSize: 11 }}
                      onClick={() => run(async () => {
                        await setShared(allOn ? editable : editable.filter(l => !isOn(l, p.id)), p.id, !allOn)
                        showToast(allOn ? `「${p.name}」に講義を見せないようにしました` : `「${p.name}」にすべての講義を見せるようにしました`)
                      })}
                    >
                      {allOn ? 'すべて外す' : 'すべて見せる'}
                    </Button>
                  )}
                />
              ),
            }
          }),
          {
            key: '__apply',
            header: (() => {
              const allOpen = editable.length > 0 && editable.every(l => l.apply_open)
              return (
                <ColumnHeader
                  title="参加申請"
                  sub="オンで承認制"
                  action={editable.length > 0 && (
                    <Button size="sm" variant="ghost" disabled={busy} style={{ minHeight: 24, fontSize: 11 }}
                      onClick={() => run(async () => {
                        await setApply(editable.filter(l => l.apply_open === allOpen), !allOpen)
                        showToast(allOpen ? 'すべての講義を申請なしで参加できるようにしました' : 'すべての講義を承認制にしました')
                      })}
                    >
                      {allOpen ? 'すべてオフ' : 'すべてオン'}
                    </Button>
                  )}
                />
              )
            })(),
          },
        ]}
        rows={lectures.map(l => ({
          key: l.id,
          label: (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <span style={{ width: 8, height: 8, borderRadius: 3, background: l.color, flexShrink: 0 }} />
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200 }}>{l.name}</span>
                <span style={{ display: 'block', fontSize: 11, color: 'var(--text-tertiary)' }}>
                  {scope === 'all' ? `${lectureMeta(l)}・` : ''}{VISIBILITY_LABEL[l.visibility]}
                </span>
              </span>
            </div>
          ),
          cells: [
            ...parties.map(p => {
              const on = isOn(l, p.id)
              return (
                <ToggleCell
                  key={p.id}
                  on={on}
                  disabled={busy || visible === null || l.visibility === 'public'}
                  label={l.visibility === 'public'
                    ? '全体公開のため、誰からも見えます'
                    : `「${l.name}」を「${partyName(p.id)}」に${on ? '見せない' : '見せる'}`}
                  onClick={() => run(async () => {
                    await setShared([l], p.id, !on)
                    showToast(on ? `「${l.name}」を「${p.name}」に見せないようにしました` : `「${l.name}」を「${p.name}」に見せるようにしました`)
                  })}
                />
              )
            }),
            <ToggleCell
              key="__apply"
              on={l.apply_open}
              disabled={busy || l.visibility === 'public'}
              label={l.visibility === 'public' ? '全体公開の講義は承認制に固定です' : `「${l.name}」の参加申請を${l.apply_open ? 'オフ' : 'オン'}にする`}
              onClick={() => run(async () => {
                await setApply([l], !l.apply_open)
                showToast(l.apply_open ? `「${l.name}」は申請なしで参加できるようになりました` : `「${l.name}」を承認制にしました`)
              })}
            />,
          ],
        }))}
      />
    </Section>
  )
}

// ---------------------------------------------------------------
// パーティーに招待（フレンド × パーティー）
// ---------------------------------------------------------------
function InviteTab({ onOpenProfile }: { onOpenProfile: (userId: string) => void }) {
  const { friends, parties, users, version: socialVersion } = useSocialStore()
  const { busy, run, showToast } = useRun()
  /** `${partyId}:${userId}` → 状態 */
  const [state, setState] = useState<Map<string, 'member' | 'excluded' | 'invited'> | null>(null)

  const partyIdsKey = parties.map(p => p.id).join(',')
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const ids = partyIdsKey ? partyIdsKey.split(',') : []
      const [memRes, invRes] = await Promise.all([
        supabase.from('party_members').select('party_id, user_id, status').in('party_id', ids).in('status', ['active', 'excluded']),
        supabase.rpc('get_my_parties_pending_invites'),
      ])
      if (cancelled) return
      if (memRes.error) { showToast(toMessage(memRes.error), 'error'); return }
      const next = new Map<string, 'member' | 'excluded' | 'invited'>()
      for (const i of (invRes.data ?? []) as { party_id: string; invitee_id: string }[]) next.set(`${i.party_id}:${i.invitee_id}`, 'invited')
      for (const m of (memRes.data ?? []) as { party_id: string; user_id: string; status: string }[]) {
        next.set(`${m.party_id}:${m.user_id}`, m.status === 'active' ? 'member' : 'excluded')
      }
      setState(next)
    })()
    return () => { cancelled = true }
  }, [partyIdsKey, showToast, socialVersion])

  const invite = async (partyId: string, userIds: string[]) => {
    let failed = 0
    let lastError: unknown = null
    for (const uid of userIds) {
      const { error } = await supabase.rpc('invite_to_party', { p_party_id: partyId, p_invitee_id: uid })
      if (error) { failed++; lastError = error } else setState(prev => new Map(prev).set(`${partyId}:${uid}`, 'invited'))
    }
    if (failed === userIds.length && lastError) throw lastError
    return failed
  }

  if (parties.length === 0) {
    return <EmptyState title="所属しているパーティーがありません" description="メニューの「パーティー」からパーティーを作ると、ここでフレンドをまとめて招待できます。" />
  }
  if (friends.length === 0) {
    return <EmptyState title="まだフレンドがいません" description="メニューの「フレンド」からユーザーIDで申請しましょう。フレンドでない人は、パーティー画面の招待コードで招待できます。" />
  }

  const stateOf = (partyId: string, userId: string) => state?.get(`${partyId}:${userId}`)

  return (
    <Section title="フレンドをパーティーに招待" count={friends.length} description="マスを押すと招待が届き、相手が承諾するとメンバーになります">
      <Matrix
        columns={parties.map(p => {
          const targets = friends.filter(f => !stateOf(p.id, f.userId)).map(f => f.userId)
          const full = p.member_count >= LIMITS.partyMaxMembers
          return {
            key: p.id,
            header: (
              <ColumnHeader
                title={p.name}
                sub={`${p.member_count}/${LIMITS.partyMaxMembers}人`}
                action={targets.length > 0 && !full && (
                  <Button size="sm" variant="ghost" disabled={busy || state === null} style={{ minHeight: 24, fontSize: 11 }}
                    onClick={() => run(async () => {
                      const failed = await invite(p.id, targets)
                      showToast(`「${p.name}」に${targets.length - failed}人を招待しました${failed ? `（${failed}人は招待できませんでした）` : ''}`)
                    })}
                  >
                    まとめて招待（{targets.length}）
                  </Button>
                )}
              />
            ),
          }
        })}
        rows={friends.map(f => ({
          key: f.userId,
          label: (
            <button type="button" onClick={() => onOpenProfile(f.userId)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', color: 'inherit' }}>
              <Avatar name={userLabel(users, f.userId)} size={26} />
              <span>
                <span style={{ display: 'block', fontWeight: 700, color: 'var(--text-primary)' }}>{userLabel(users, f.userId)}</span>
                {users[f.userId]?.handle && <span style={{ display: 'block', fontSize: 11, color: 'var(--text-tertiary)' }}>@{users[f.userId]?.handle}</span>}
              </span>
            </button>
          ),
          cells: parties.map(p => {
            const st = stateOf(p.id, f.userId)
            if (st === 'member') return <Badge key={p.id} tone="success">メンバー</Badge>
            if (st === 'invited') return <Badge key={p.id} tone="info">招待中</Badge>
            if (st === 'excluded') return <Badge key={p.id} tone="danger">除外</Badge>
            const full = p.member_count >= LIMITS.partyMaxMembers
            return (
              <Button key={p.id} size="sm" disabled={busy || state === null || full} title={full ? '満員のため招待できません' : undefined}
                onClick={() => run(async () => {
                  await invite(p.id, [f.userId])
                  showToast(`${userLabel(users, f.userId)}さんを「${p.name}」に招待しました`)
                })}
              >
                招待
              </Button>
            )
          }),
        }))}
      />
    </Section>
  )
}

// ---------------------------------------------------------------
// 講義に参加（パーティーで見えている講義）
// ---------------------------------------------------------------
interface JoinCandidate extends LectureSummary {
  partyNames: string[]
}

function JoinTab() {
  const { semester, subjects, fetchAll } = useStore()
  const parties = useSocialStore(s => s.parties)
  const socialVersion = useSocialStore(s => s.version)
  const { busy, run, showToast } = useRun()
  const [scope, setScope] = useState<Scope>('semester')
  const [candidates, setCandidates] = useState<JoinCandidate[] | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const results = await Promise.all(parties.map(p => supabase.rpc('get_party_lectures', { p_party_id: p.id })))
      if (cancelled) return
      const map = new Map<string, JoinCandidate>()
      results.forEach((res, i) => {
        for (const l of (res.data ?? []) as LectureSummary[]) {
          if (l.my_status === 'participant' || l.my_status === 'excluded') continue
          const existing = map.get(l.id)
          if (existing) existing.partyNames.push(parties[i].name)
          else map.set(l.id, { ...l, partyNames: [parties[i].name] })
        }
      })
      setCandidates([...map.values()].sort((a, b) => b.year - a.year || a.title.localeCompare(b.title, 'ja')))
    })()
    return () => { cancelled = true }
  }, [parties, reloadKey, socialVersion])

  const shown = (candidates ?? []).filter(l => scope === 'all' || subjectInSemester(l, semester))
  const joinable = shown.filter(l => l.my_status !== 'pending')
  const selectedShown = joinable.filter(l => selected.has(l.id))
  const allSelected = joinable.length > 0 && selectedShown.length === joinable.length

  const join = async (targets: JoinCandidate[]) => {
    let joined = 0
    let requested = 0
    let failed = 0
    let lastError: unknown = null
    for (const [i, l] of targets.entries()) {
      const { error } = l.apply_open
        ? await supabase.rpc('request_join_lecture', { p_lecture_id: l.id })
        : await supabase.rpc('join_lecture', { p_lecture_id: l.id, p_color: pickLectureColor(subjects.length + i) })
      if (error) { failed++; lastError = error } else if (l.apply_open) requested++
      else joined++
    }
    if (joined > 0) await fetchAll()
    setSelected(new Set())
    setReloadKey(k => k + 1)
    if (failed === targets.length && lastError) throw lastError
    const parts = [
      joined && `${joined}件の講義に参加しました（課題がタイムラインに追加されます）`,
      requested && `${requested}件に参加申請を送りました`,
      failed && `${failed}件はできませんでした`,
    ].filter(Boolean)
    showToast(parts.join('・'))
  }

  if (parties.length === 0) {
    return <EmptyState title="所属しているパーティーがありません" description="パーティーに入ると、メンバーが見せている講義にここからまとめて参加できます。" />
  }

  return (
    <Section
      title="パーティーで見えている講義"
      count={shown.length}
      description="まだ参加していない講義です。承認制の講義は参加申請になります"
      action={
        <>
          <ScopeSelect value={scope} onChange={setScope} />
          <Button size="sm" variant="primary" disabled={selectedShown.length === 0} loading={busy} onClick={() => run(() => join(selectedShown))}>
            選んだ講義に参加（{selectedShown.length}）
          </Button>
        </>
      }
    >
      {candidates === null ? (
        <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: 0 }}>読み込み中...</p>
      ) : shown.length === 0 ? (
        <EmptyState compact title="参加できる講義はありません" description={scope === 'semester' ? '「すべての学期」に切り替えると、ほかの学期の講義も表示されます。' : 'パーティーのメンバーが講義を見せると、ここに並びます。'} />
      ) : (
        <List>
          {joinable.length > 1 && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 12px', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <input type="checkbox" checked={allSelected} onChange={() => setSelected(allSelected ? new Set() : new Set(joinable.map(l => l.id)))} />
              すべて選ぶ（{joinable.length}件）
            </label>
          )}
          {shown.map(l => {
            const pending = l.my_status === 'pending'
            return (
              <ListItem
                key={l.id}
                leading={
                  <input
                    type="checkbox"
                    aria-label={`「${l.title}」を選ぶ`}
                    disabled={pending}
                    checked={selected.has(l.id)}
                    onChange={() => setSelected(prev => {
                      const next = new Set(prev)
                      if (next.has(l.id)) next.delete(l.id)
                      else next.add(l.id)
                      return next
                    })}
                    style={{ width: 16, height: 16 }}
                  />
                }
                title={l.title}
                subtitle={`${lectureMeta(l)}${l.professor ? `・${l.professor}` : ''}・${l.partyNames.join('、')}・参加${l.participant_count}人`}
                trailing={pending ? <Badge>申請中</Badge> : (
                  <Button size="sm" disabled={busy} onClick={() => run(() => join([l]))}>{l.apply_open ? '参加申請' : '参加する'}</Button>
                )}
              />
            )
          })}
        </List>
      )}
    </Section>
  )
}
