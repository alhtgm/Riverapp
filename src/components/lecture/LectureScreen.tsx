import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { toMessage } from '../../lib/errors'
import { LECTURE_COLORS } from '../../lib/colors'
import { useStore } from '../../store/useStore'
import { useSocialStore, userLabel } from '../../store/useSocialStore'
import { useToast } from '../ui/Toast'
import Sheet from '../ui/Sheet'
import { Avatar, Badge, Button, Card, Confirm, EmptyState, Field, List, ListItem, Notice, Section, Tabs } from '../ui/kit'
import { inputStyle } from '../ui/styles'
import { LIMITS } from '../../lib/limits'
import MemberList from '../social/MemberList'
import ProgressPeople from './ProgressPeople'
import PartyPicker from './PartyPicker'
import {
  TERM_LABEL, VISIBILITY_LABEL, formatDate,
  type ActivityLogEntry, type ApplyRequest, type LectureParticipant, type LectureTerm, type LectureVisibility,
} from '../../types'

interface Props {
  lectureId: string
  onClose: () => void
  onOpenProfile: (userId: string) => void
}

interface DeletedTask {
  id: string
  title: string
  due_date: string
  deleted_at: string
  deleted_by: string | null
}

type Tab = 'tasks' | 'members' | 'settings' | 'history'

const TERMS: LectureTerm[] = ['spring', 'fall', 'full_year', 'other']
const VISIBILITIES: LectureVisibility[] = ['private', 'party', 'friends', 'public']

const FIELD_LABEL: Record<string, string> = {
  title: '名前', year: '年度', term: '学期', professor: '担当教員', visibility: '公開範囲',
  apply_open: '参加申請', start_date: '発生日', due_date: '締切', due_time: '締切時刻', description: '説明', url: '関連URL',
}

function formatValue(field: string, v: unknown): string {
  if (v === null || v === undefined || v === '') return '（なし）'
  if (field === 'term') return TERM_LABEL[v as LectureTerm] ?? String(v)
  if (field === 'visibility') return VISIBILITY_LABEL[v as LectureVisibility] ?? String(v)
  if (field === 'apply_open') return v ? 'オン' : 'オフ'
  if (field === 'due_date' || field === 'start_date') return formatDate(String(v))
  return String(v)
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** 操作履歴の1行を「何を・変更前→変更後」の文に変換する。表示すべき変更がなければ null */
function describe(entry: ActivityLogEntry, name: (id: string | null | undefined) => string): { what: string; diffs: string[] } | null {
  const before = entry.before ?? {}
  const after = entry.after ?? {}
  const diffFields = (fields: string[]) =>
    fields
      .filter(f => JSON.stringify(before[f] ?? null) !== JSON.stringify(after[f] ?? null))
      .map(f => `${FIELD_LABEL[f]}: ${formatValue(f, before[f])} → ${formatValue(f, after[f])}`)

  const taskTitle = String(after.title ?? before.title ?? '課題')
  const kindWord = after.kind === 'unexclude' ? '除外の解除' : '除外'
  if (entry.target_type === 'lecture_task') {
    switch (entry.action) {
      case 'create': return { what: `課題「${taskTitle}」を追加`, diffs: [] }
      case 'delete': return { what: `課題「${taskTitle}」を削除`, diffs: [] }
      case 'restore': return { what: `課題「${taskTitle}」を復元`, diffs: [] }
      default: {
        const diffs = diffFields(['title', 'start_date', 'due_date', 'due_time', 'description', 'url'])
        return diffs.length ? { what: `課題「${taskTitle}」を編集`, diffs } : null
      }
    }
  }
  switch (entry.action) {
    case 'create': return { what: '講義を作成', diffs: [] }
    case 'join': return { what: '参加', diffs: [] }
    case 'leave': return { what: '退出', diffs: [] }
    case 'apply_request': return { what: '参加を申請', diffs: [] }
    case 'apply_approve': return { what: `${name(after.request_user_id as string)}さんの参加申請を承認`, diffs: [] }
    case 'apply_reject': return { what: `${name(after.request_user_id as string)}さんの参加申請を却下`, diffs: [] }
    case 'visible_party_add': return { what: `パーティー「${String(after.party_name ?? '')}」に見せるようにした`, diffs: [] }
    case 'visible_party_remove': return { what: `パーティー「${String(before.party_name ?? '')}」に見せないようにした`, diffs: [] }
    case 'exclusion_vote_start': return { what: `${kindWord}投票を開始`, diffs: [] }
    case 'exclusion_vote_pass': return { what: `${kindWord}投票が成立`, diffs: [] }
    case 'exclusion_vote_expire': return { what: `${kindWord}投票が失効`, diffs: [] }
    case 'settings_update': {
      const diffs = diffFields(['title', 'year', 'term', 'professor', 'visibility', 'apply_open'])
      return diffs.length ? { what: '講義の設定を変更', diffs } : null
    }
    default: return { what: entry.action, diffs: [] }
  }
}

/** 公開範囲の説明（誰が見つけられるかを具体的に） */
const VISIBILITY_HELP: Record<LectureVisibility, string> = {
  private: 'この講義のメンバーだけ。ほかの人からは見つかりません',
  party: '下で選んだパーティーのメンバーが見つけて参加できます',
  friends: '選んだパーティーのメンバーに加えて、この講義のメンバーのフレンドも見つけられます',
  public: 'River を使っている誰でも見つけられます（他大学の人も含む）。参加は承認制になります',
}

/** いまの設定を1文で説明する */
function summarizeSharing(visibility: LectureVisibility, applyOpen: boolean, partyNames: string[]): string {
  if (visibility === 'private') return 'いまは、この講義のメンバーだけが見られます。'
  const parties = partyNames.length > 0 ? `「${partyNames.join('」「')}」のメンバー` : null
  const who = visibility === 'public'
    ? 'River を使っている誰でも'
    : visibility === 'friends'
      ? `${parties ? `${parties}と、` : ''}メンバーのフレンド`
      : parties ?? 'まだ誰も（見せるパーティーを選んでください）'
  const how = visibility === 'public' || applyOpen ? '参加には、メンバーの誰かの承認が必要です。' : '承認なしですぐ参加できます。'
  return `いまは、${who}がこの講義を見つけられます。${how}`
}

function StatBox({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '10px 14px' }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)' }}>{label}</span>
      <span style={{ fontSize: 20, fontWeight: 700, color: color ?? 'var(--text-primary)', letterSpacing: '-0.02em' }}>{value}</span>
    </div>
  )
}

const selectStyle = { ...inputStyle, minHeight: 38 }

export default function LectureScreen({ lectureId, onClose, onOpenProfile }: Props) {
  const { showToast } = useToast()
  const { subjects, tasks, progress, updateLectureSettings, updateSubject, deleteSubject, restoreTask, fetchProgress, dataVersion } = useStore()
  const { users, ensureUsers, parties: myParties, version: socialVersion } = useSocialStore()
  const lecture = subjects.find(s => s.id === lectureId)
  const lectureTasks = tasks.filter(t => t.subject_id === lectureId).sort((a, b) => a.due_date.localeCompare(b.due_date))

  const [tab, setTab] = useState<Tab>('tasks')
  const [participants, setParticipants] = useState<LectureParticipant[]>([])
  const [requests, setRequests] = useState<ApplyRequest[]>([])
  const [deleted, setDeleted] = useState<DeletedTask[]>([])
  const [history, setHistory] = useState<ActivityLogEntry[] | null>(null)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [visibleParties, setVisibleParties] = useState<string[]>([])
  const [busy, setBusy] = useState(false)

  // 設定フォーム
  const [title, setTitle] = useState(lecture?.name ?? '')
  const [year, setYear] = useState(lecture?.year ?? new Date().getFullYear())
  const [term, setTerm] = useState<LectureTerm>(lecture?.term ?? 'other')
  const [professor, setProfessor] = useState(lecture?.professor ?? '')

  const loadMembers = useCallback(async () => {
    const [partRes, reqRes] = await Promise.all([
      supabase.from('lecture_participants').select('lecture_id, user_id, status, joined_at').eq('lecture_id', lectureId).in('status', ['active', 'excluded']),
      supabase.rpc('get_lecture_apply_requests', { p_lecture_id: lectureId }),
    ])
    setParticipants((partRes.data ?? []) as LectureParticipant[])
    setRequests((reqRes.data ?? []) as ApplyRequest[])
  }, [lectureId])

  const loadVisibleParties = useCallback(async () => {
    const { data } = await supabase.from('lecture_visible_parties').select('party_id').eq('lecture_id', lectureId)
    setVisibleParties(((data ?? []) as { party_id: string }[]).map(r => r.party_id))
  }, [lectureId])

  const loadDeleted = useCallback(async () => {
    const { data } = await supabase
      .from('lecture_tasks')
      .select('id, title, due_date, deleted_at, deleted_by')
      .eq('lecture_id', lectureId)
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false })
    const rows = (data ?? []) as DeletedTask[]
    setDeleted(rows)
    void ensureUsers(rows.map(r => r.deleted_by))
  }, [lectureId, ensureUsers])

  const loadHistory = useCallback(async () => {
    const { data: taskRows } = await supabase.from('lecture_tasks').select('id').eq('lecture_id', lectureId)
    const taskIds = ((taskRows ?? []) as { id: string }[]).map(t => t.id)
    const [lecRes, taskRes] = await Promise.all([
      supabase.from('activity_log').select('*').eq('target_type', 'lecture').eq('target_id', lectureId)
        .order('created_at', { ascending: false }).limit(100),
      taskIds.length
        ? supabase.from('activity_log').select('*').eq('target_type', 'lecture_task').in('target_id', taskIds)
          .order('created_at', { ascending: false }).limit(200)
        : Promise.resolve({ data: [] }),
    ])
    const merged = [...((lecRes.data ?? []) as ActivityLogEntry[]), ...((taskRes.data ?? []) as ActivityLogEntry[])]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 150)
    setHistory(merged)
    void ensureUsers(merged.flatMap(e => [e.actor_id, (e.after?.request_user_id as string) ?? null]))
  }, [lectureId, ensureUsers])

  // 参加申請・参加者の変化はリアルタイムで届くので、そのたびに読み直す（socialVersion / dataVersion）
  useEffect(() => {
    void loadMembers()
    void fetchProgress()
  }, [loadMembers, fetchProgress, socialVersion, dataVersion])

  useEffect(() => {
    if (tab === 'tasks') void loadDeleted()
    if (tab === 'history') void loadHistory()
    if (tab === 'settings') void loadVisibleParties()
  }, [tab, loadDeleted, loadHistory, loadVisibleParties, dataVersion])

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    try { await fn() } catch (e: unknown) { showToast(toMessage(e), 'error') } finally { setBusy(false) }
  }

  if (!lecture) {
    return (
      <Sheet title="講義" onClose={onClose} zIndex={330}>
        <EmptyState title="この講義には参加していません" description="参加すると、課題・参加者・設定を確認できるようになります。" />
      </Sheet>
    )
  }

  const name = (id: string | null | undefined) => userLabel(users, id)
  const activeCount = participants.filter(p => p.status === 'active').length
  const totals = lectureTasks.reduce(
    (acc, t) => {
      acc.inProgress += progress[t.id]?.in_progress.length ?? 0
      acc.done += (progress[t.id]?.done.length ?? 0) + (progress[t.id]?.submitted.length ?? 0)
      return acc
    },
    { inProgress: 0, done: 0 },
  )
  const settingsDirty =
    title !== lecture.name || year !== lecture.year || term !== lecture.term || (professor || null) !== (lecture.professor || null)
  const visibility = lecture.visibility
  const applyOpen = visibility === 'public' ? true : lecture.apply_open
  const visiblePartyNames = visibleParties.map(id => myParties.find(p => p.id === id)?.name).filter((n): n is string => !!n)

  /** 公開範囲を変える（すぐ保存）。パーティー内にしたときは申請なしを既定にする */
  const changeVisibility = (v: LectureVisibility) => run(async () => {
    if (v === visibility) return
    await updateLectureSettings(lectureId, {
      visibility: v,
      apply_open: v === 'public' ? true : v === 'party' ? false : lecture.apply_open,
    })
    showToast(v === 'public' ? '全体公開にしました（参加は承認制になります）' : `公開範囲を「${VISIBILITY_LABEL[v]}」にしました`)
  })

  return (
    <Sheet
      title={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span style={{ width: 12, height: 12, borderRadius: 4, background: lecture.color, flexShrink: 0 }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lecture.name}</span>
        </span>
      }
      subtitle={`${lecture.year}年度・${TERM_LABEL[lecture.term]}${lecture.professor ? `・${lecture.professor}` : ''}・${VISIBILITY_LABEL[lecture.visibility]}`}
      onClose={onClose}
      zIndex={330}
      width={760}
      height={780}
    >
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { key: 'tasks', label: '課題と進捗' },
          { key: 'members', label: 'メンバー', badge: requests.length },
          { key: 'settings', label: '設定' },
          { key: 'history', label: '履歴' },
        ]}
      />

      {tab === 'tasks' && (
        <>
          <Card padding={0}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)' }}>
              <StatBox label="メンバー" value={activeCount} />
              <div style={{ borderLeft: '1px solid var(--border-light)' }}><StatBox label="取り組み中（のべ）" value={totals.inProgress} color="#0779A0" /></div>
              <div style={{ borderLeft: '1px solid var(--border-light)' }}><StatBox label="完了（のべ）" value={totals.done} color="#14913F" /></div>
            </div>
          </Card>

          <Section title="課題" count={lectureTasks.length} description="課題ごとに、参加者がいまどのステータスかを確認できます">
            {lectureTasks.length === 0 ? (
              <EmptyState title="課題はまだありません" description="タイムラインの「課題を追加」から追加すると、参加者全員に共有されます。" />
            ) : (
              <List>
                {lectureTasks.map(t => (
                  <Card key={t.id} padding={12}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
                      <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
                      <Badge tone="accent">締切 {formatDate(t.due_date)}{t.due_time ? ` ${t.due_time}` : ''}</Badge>
                    </div>
                    <ProgressPeople progress={progress[t.id]} />
                  </Card>
                ))}
              </List>
            )}
          </Section>

          <Section title="削除済みの課題" count={deleted.length} description="誤って消した課題は、参加者なら誰でも元に戻せます">
            {deleted.length === 0 ? (
              <EmptyState compact title="削除済みの課題はありません" />
            ) : (
              <List>
                {deleted.map(d => (
                  <ListItem
                    key={d.id}
                    title={d.title}
                    subtitle={`締切 ${formatDate(d.due_date)}・${name(d.deleted_by)}さんが${formatDateTime(d.deleted_at)}に削除`}
                    trailing={
                      <Button
                        size="sm"
                        disabled={busy}
                        onClick={() => run(async () => {
                          await restoreTask(d.id)
                          await loadDeleted()
                          showToast(`「${d.title}」を元に戻しました`)
                        })}
                      >
                        元に戻す
                      </Button>
                    }
                  />
                ))}
              </List>
            )}
          </Section>
        </>
      )}

      {tab === 'members' && (
        <>
          <Section title="参加申請" count={requests.length} description={`メンバーなら誰でも承認・却下できます（受信箱からもできます）。${LIMITS.applyRequestTtlDays}日間だれも対応しないと自動で失効します`}>
            {requests.length === 0 ? (
              <EmptyState compact title="届いている申請はありません" />
            ) : (
              <List>
                {requests.map(r => (
                  <ListItem
                    key={r.id}
                    highlight
                    leading={<Avatar name={r.display_name} size={32} />}
                    title={r.display_name ?? 'ユーザー'}
                    subtitle={`${r.handle ? `@${r.handle}・` : ''}${formatDateTime(r.created_at)}に申請`}
                    onClick={() => onOpenProfile(r.user_id)}
                    trailing={
                      <>
                        <Button
                          size="sm"
                          disabled={busy}
                          onClick={() => run(async () => {
                            const { error } = await supabase.rpc('respond_join_request', { p_request_id: r.id, p_approve: false })
                            if (error) throw error
                            await loadMembers()
                            showToast('申請を却下しました')
                          })}
                        >
                          却下
                        </Button>
                        <Button
                          size="sm"
                          variant="primary"
                          disabled={busy}
                          onClick={() => run(async () => {
                            const { error } = await supabase.rpc('respond_join_request', { p_request_id: r.id, p_approve: true })
                            if (error) throw error
                            await loadMembers()
                            void fetchProgress()
                            showToast('参加を承認しました')
                          })}
                        >
                          承認
                        </Button>
                      </>
                    }
                  />
                ))}
              </List>
            )}
          </Section>
          <MemberList
            targetType="lecture"
            targetId={lectureId}
            members={participants.map(p => ({ userId: p.user_id, status: p.status }))}
            onOpenProfile={onOpenProfile}
            onChanged={() => { void loadMembers(); void fetchProgress() }}
          />
        </>
      )}

      {tab === 'settings' && (
        <>
          <Notice>講義の設定はメンバーなら誰でも変更でき、変更は「履歴」に残ります。</Notice>

          <Section title="公開と参加" description="誰がこの講義を見つけられるか・どうやって参加するかを決めます。押すとすぐ反映されます">
            <Card tone="muted" padding={12}>
              <span style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6 }}>{summarizeSharing(visibility, applyOpen, visiblePartyNames)}</span>
            </Card>

            <Field group required label="公開範囲" help="公開範囲を変えると、メンバー全員に通知されます">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
                {VISIBILITIES.map(v => {
                  const active = visibility === v
                  return (
                    <label
                      key={v}
                      style={{
                        display: 'flex', flexDirection: 'column', gap: 4, padding: '10px 12px', borderRadius: 12, cursor: busy ? 'wait' : 'pointer',
                        border: `1.5px solid ${active ? 'var(--accent)' : 'var(--border-light)'}`,
                        background: active ? 'var(--accent-bg)' : 'var(--surface)',
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <input type="radio" name="visibility" checked={active} disabled={busy} onChange={() => void changeVisibility(v)} style={{ margin: 0 }} />
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{VISIBILITY_LABEL[v]}</span>
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>{VISIBILITY_HELP[v]}</span>
                    </label>
                  )
                })}
              </div>
            </Field>

            {(visibility === 'party' || visibility === 'friends') && (
              <Field group label="見せるパーティー" help="あなたが所属しているパーティーから選べます">
                {myParties.length === 0 && visibleParties.length === 0 ? (
                  <EmptyState compact title="所属しているパーティーがありません" description="メニューの「仲間」でパーティーを作るか参加すると、ここで選べるようになります。" />
                ) : (
                  <PartyPicker
                    myParties={myParties}
                    selectedIds={visibleParties}
                    busy={busy}
                    onChange={(partyId, enabled) => {
                      const partyName = myParties.find(pt => pt.id === partyId)?.name ?? 'パーティー'
                      void run(async () => {
                        const { error } = await supabase.rpc('set_lecture_visible_party', {
                          p_lecture_id: lectureId, p_party_id: partyId, p_enabled: enabled,
                        })
                        if (error) throw error
                        await loadVisibleParties()
                        showToast(enabled ? `「${partyName}」に見せるようにしました` : `「${partyName}」に見せないようにしました`)
                      })
                    }}
                  />
                )}
              </Field>
            )}

            {visibility !== 'private' && (
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', borderRadius: 12, border: '1px solid var(--border-light)', background: 'var(--surface)', cursor: visibility === 'public' ? 'default' : 'pointer' }}>
                <input
                  type="checkbox"
                  checked={applyOpen}
                  disabled={visibility === 'public' || busy}
                  onChange={e => {
                    const open = e.target.checked
                    void run(async () => {
                      await updateLectureSettings(lectureId, { apply_open: open })
                      showToast(open ? '参加を承認制にしました' : '承認なしで参加できるようにしました')
                    })
                  }}
                  style={{ marginTop: 3 }}
                />
                <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>参加を承認制にする</span>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
                    {visibility === 'public'
                      ? '全体公開の間は承認制に固定されます'
                      : 'オンにすると、参加したい人の申請がメンバーの受信箱に届き、誰かが承認すると参加できます'}
                  </span>
                </span>
              </label>
            )}
          </Section>

          <form
            style={{ display: 'flex', flexDirection: 'column', gap: 24 }}
            onSubmit={e => {
              e.preventDefault()
              void run(async () => {
                if (!title.trim()) throw new Error('講義名を入力してください')
                await updateLectureSettings(lectureId, { title, year, term, professor })
                showToast('基本情報を保存しました')
              })
            }}
          >
            <Section title="基本情報" description="名前・年度・学期を直したら「保存する」を押します">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <Field label="講義名" required>
                    <input value={title} onChange={e => setTitle(e.target.value)} required style={selectStyle} />
                  </Field>
                </div>
                <Field label="年度" required>
                  <input type="number" min={2000} max={2100} value={year} onChange={e => setYear(Number(e.target.value))} required style={selectStyle} />
                </Field>
                <Field label="学期" required>
                  <select value={term} onChange={e => setTerm(e.target.value as LectureTerm)} style={selectStyle}>
                    {TERMS.map(t => <option key={t} value={t}>{TERM_LABEL[t]}</option>)}
                  </select>
                </Field>
                <div style={{ gridColumn: '1 / -1' }}>
                  <Field label="担当教員">
                    <input value={professor} onChange={e => setProfessor(e.target.value)} placeholder="例：山田先生" style={selectStyle} />
                  </Field>
                </div>
              </div>
            </Section>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'sticky', bottom: -20, padding: '12px 0', background: 'var(--surface)', borderTop: '1px solid var(--border-light)' }}>
              <Button type="submit" variant="primary" disabled={!settingsDirty} loading={busy}>保存する</Button>
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{settingsDirty ? '保存していない変更があります' : '変更はありません'}</span>
            </div>
          </form>

          <Section title="自分のタイムラインでの色" description="あなたの画面にだけ反映されます">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {LECTURE_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  aria-label={`色 ${c}`}
                  aria-pressed={lecture.color === c}
                  onClick={() => run(async () => { await updateSubject(lectureId, { color: c }) })}
                  style={{
                    width: 32, height: 32, borderRadius: 9, background: c, cursor: 'pointer',
                    border: lecture.color === c ? '3px solid var(--text-primary)' : '2px solid var(--surface)',
                    boxShadow: 'var(--shadow-xs)',
                  }}
                />
              ))}
            </div>
          </Section>

          <Section title="この講義から退出" description="退出しても、あなたの進捗やメモは保存され、再参加したときに戻ります">
            {confirmLeave ? (
              <Confirm
                message={`「${lecture.name}」から退出しますか？`}
                detail={activeCount <= 1
                  ? 'あなたが最後の1人なので、講義は誰からも見えなくなります。'
                  : 'この講義の課題は、あなたのタイムラインから消えます。'}
                confirmLabel="退出する"
                busy={busy}
                onCancel={() => setConfirmLeave(false)}
                onConfirm={() => run(async () => {
                  await deleteSubject(lectureId)
                  showToast('講義から退出しました')
                  onClose()
                })}
              />
            ) : (
              <div><Button variant="danger" onClick={() => setConfirmLeave(true)}>退出する</Button></div>
            )}
          </Section>
        </>
      )}

      {tab === 'history' && (
        <Section title="操作履歴" description="誰が・いつ・何を変えたかを確認できます">
          {history === null ? (
            <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: 0 }}>読み込み中...</p>
          ) : history.length === 0 ? (
            <EmptyState compact title="履歴はまだありません" />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {history.map(e => {
                const d = describe(e, name)
                if (!d) return null
                return (
                  <div key={e.id} style={{ display: 'flex', gap: 12, padding: '10px 2px', borderBottom: '1px solid var(--border-light)' }}>
                    <Avatar name={e.actor_id ? name(e.actor_id) : 'システム'} size={28} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5 }}>
                        <b>{e.actor_id ? name(e.actor_id) : 'システム'}</b>{' '}{d.what}
                      </div>
                      {d.diffs.map((line, i) => (
                        <div key={i} style={{ fontSize: 12, color: 'var(--text-secondary)', wordBreak: 'break-all', marginTop: 2 }}>{line}</div>
                      ))}
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{formatDateTime(e.created_at)}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Section>
      )}
    </Sheet>
  )
}
