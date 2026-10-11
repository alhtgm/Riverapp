import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { toMessage } from '../../lib/errors'
import { LECTURE_COLORS } from '../../lib/colors'
import { useStore } from '../../store/useStore'
import { useSocialStore, userLabel } from '../../store/useSocialStore'
import { useToast } from '../ui/Toast'
import Sheet, { Avatar } from '../ui/Sheet'
import { btn, sectionTitle, inputStyle, emptyText, listRow } from '../ui/styles'
import MemberList from '../social/MemberList'
import ProgressPeople from './ProgressPeople'
import {
  TERM_LABEL, VISIBILITY_LABEL, VISIBILITY_DESC, formatDate,
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
  apply_open: '参加申請', due_date: '締切', due_time: '締切時刻', description: '説明', url: '関連URL',
}

function formatValue(field: string, v: unknown): string {
  if (v === null || v === undefined || v === '') return '（なし）'
  if (field === 'term') return TERM_LABEL[v as LectureTerm] ?? String(v)
  if (field === 'visibility') return VISIBILITY_LABEL[v as LectureVisibility] ?? String(v)
  if (field === 'apply_open') return v ? 'オン' : 'オフ'
  if (field === 'due_date') return formatDate(String(v))
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
        const diffs = diffFields(['title', 'due_date', 'due_time', 'description', 'url'])
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

export default function LectureScreen({ lectureId, onClose, onOpenProfile }: Props) {
  const { showToast } = useToast()
  const { subjects, tasks, progress, updateLectureSettings, updateSubject, deleteSubject, restoreTask, fetchProgress } = useStore()
  const { users, ensureUsers, parties: myParties } = useSocialStore()
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
  const [visibility, setVisibility] = useState<LectureVisibility>(lecture?.visibility ?? 'party')
  const [applyOpen, setApplyOpen] = useState(lecture?.apply_open ?? false)

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

  useEffect(() => {
    void loadMembers()
    void fetchProgress()
  }, [loadMembers, fetchProgress])

  useEffect(() => {
    if (tab === 'tasks') void loadDeleted()
    if (tab === 'history') void loadHistory()
    if (tab === 'settings') void loadVisibleParties()
  }, [tab, loadDeleted, loadHistory, loadVisibleParties])

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    try { await fn() } catch (e: unknown) { showToast(toMessage(e), 'error') } finally { setBusy(false) }
  }

  if (!lecture) {
    return (
      <Sheet title="講義" onClose={onClose} zIndex={330}>
        <p style={emptyText}>この講義には参加していません</p>
      </Sheet>
    )
  }

  const name = (id: string | null | undefined) => userLabel(users, id)
  const totals = lectureTasks.reduce(
    (acc, t) => {
      acc.inProgress += progress[t.id]?.in_progress.length ?? 0
      acc.done += (progress[t.id]?.done.length ?? 0) + (progress[t.id]?.submitted.length ?? 0)
      return acc
    },
    { inProgress: 0, done: 0 },
  )

  const tabs: { key: Tab; label: string }[] = [
    { key: 'tasks', label: '課題と進捗' },
    { key: 'members', label: requests.length ? `参加者・申請 (${requests.length})` : '参加者' },
    { key: 'settings', label: '設定' },
    { key: 'history', label: '操作履歴' },
  ]

  return (
    <Sheet
      title={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: lecture.color, flexShrink: 0 }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lecture.name}</span>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 500, flexShrink: 0 }}>
            {lecture.year}年度 {TERM_LABEL[lecture.term]}
          </span>
        </span>
      }
      onClose={onClose}
      zIndex={330}
      width={640}
    >
      <div role="tablist" style={{ display: 'flex', gap: 4, background: 'var(--bg-secondary)', borderRadius: 10, padding: 3, overflowX: 'auto' }}>
        {tabs.map(t => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            style={{
              flex: 1, border: 'none', borderRadius: 8, padding: '7px 10px', fontSize: 12, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
              background: tab === t.key ? 'var(--surface)' : 'transparent',
              color: tab === t.key ? 'var(--text-primary)' : 'var(--text-secondary)',
              boxShadow: tab === t.key ? 'var(--shadow-xs)' : 'none',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'tasks' && (
        <>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            講義全体：取り組み中 <b>{totals.inProgress}</b>・完了 <b>{totals.done}</b>（参加 {participants.filter(p => p.status === 'active').length}人）
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {lectureTasks.length === 0 && <p style={emptyText}>課題はまだありません</p>}
            {lectureTasks.map(t => (
              <div key={t.id} style={{ ...listRow, flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)', flexShrink: 0 }}>締切 {formatDate(t.due_date)}{t.due_time ? ` ${t.due_time}` : ''}</span>
                </div>
                <ProgressPeople progress={progress[t.id]} />
              </div>
            ))}
          </div>

          <div>
            <p style={sectionTitle}>削除済みの課題</p>
            {deleted.length === 0 ? (
              <p style={emptyText}>削除済みの課題はありません</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {deleted.map(d => (
                  <div key={d.id} style={listRow}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                        締切 {formatDate(d.due_date)}・{name(d.deleted_by)}さんが{formatDateTime(d.deleted_at)}に削除
                      </div>
                    </div>
                    <button
                      style={btn('secondary', true)}
                      disabled={busy}
                      onClick={() => run(async () => {
                        await restoreTask(d.id)
                        await loadDeleted()
                        showToast(`「${d.title}」を復元しました`)
                      })}
                    >
                      復元
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {tab === 'members' && (
        <>
          <div>
            <p style={sectionTitle}>参加申請</p>
            {requests.length === 0 ? (
              <p style={emptyText}>届いている申請はありません</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {requests.map(r => (
                  <div key={r.id} style={listRow}>
                    <Avatar name={r.display_name} />
                    <button
                      onClick={() => onOpenProfile(r.user_id)}
                      style={{ flex: 1, minWidth: 0, textAlign: 'left', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit' }}
                    >
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{r.display_name ?? 'ユーザー'}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                        {r.handle && `@${r.handle}・`}{formatDateTime(r.created_at)}に申請（{formatDateTime(r.expires_at)}に自動失効）
                      </div>
                    </button>
                    <button
                      style={btn('primary', true)}
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
                    </button>
                    <button
                      style={btn('secondary', true)}
                      disabled={busy}
                      onClick={() => run(async () => {
                        const { error } = await supabase.rpc('respond_join_request', { p_request_id: r.id, p_approve: false })
                        if (error) throw error
                        await loadMembers()
                        showToast('申請を却下しました')
                      })}
                    >
                      却下
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
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
          <form
            style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
            onSubmit={e => {
              e.preventDefault()
              void run(async () => {
                if (!title.trim()) throw new Error('講義名を入力してください')
                const becamePublic = visibility === 'public' && lecture.visibility !== 'public'
                await updateLectureSettings(lectureId, {
                  title, year, term, professor, visibility,
                  apply_open: visibility === 'public' ? true : applyOpen,
                })
                showToast(becamePublic ? '全体公開にしたため、参加申請をオンにしました' : '講義の設定を保存しました')
              })
            }}
          >
            <p style={{ ...emptyText, padding: 0 }}>設定は参加者なら誰でも変更でき、変更は操作履歴に残ります。</p>
            <div>
              <label style={sectionTitle}>講義名</label>
              <input value={title} onChange={e => setTitle(e.target.value)} required style={inputStyle} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={sectionTitle}>年度</label>
                <input type="number" min={2000} max={2100} value={year} onChange={e => setYear(Number(e.target.value))} required style={inputStyle} />
              </div>
              <div>
                <label style={sectionTitle}>学期</label>
                <select value={term} onChange={e => setTerm(e.target.value as LectureTerm)} style={inputStyle}>
                  {TERMS.map(t => <option key={t} value={t}>{TERM_LABEL[t]}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label style={sectionTitle}>担当教員（任意）</label>
              <input value={professor} onChange={e => setProfessor(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={sectionTitle}>公開範囲</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {VISIBILITIES.map(v => (
                  <label key={v} style={{ ...listRow, cursor: 'pointer', borderColor: visibility === v ? 'var(--accent)' : 'var(--border-light)' }}>
                    <input type="radio" name="visibility" checked={visibility === v} onChange={() => setVisibility(v)} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{VISIBILITY_LABEL[v]}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{VISIBILITY_DESC[v]}</span>
                  </label>
                ))}
              </div>
            </div>
            {(visibility === 'party' || visibility === 'friends') && (
              <div>
                <label style={sectionTitle}>見せるパーティー</label>
                {myParties.length === 0 ? (
                  <p style={{ ...emptyText, padding: 0 }}>所属しているパーティーがありません。「つながり」からパーティーを作るか参加してください。</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {myParties.map(pt => (
                      <label key={pt.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-primary)', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={visibleParties.includes(pt.id)}
                          disabled={busy}
                          onChange={e => {
                            const enabled = e.target.checked
                            void run(async () => {
                              const { error } = await supabase.rpc('set_lecture_visible_party', {
                                p_lecture_id: lectureId, p_party_id: pt.id, p_enabled: enabled,
                              })
                              if (error) throw error
                              await loadVisibleParties()
                              showToast(enabled ? `「${pt.name}」に見せるようにしました` : `「${pt.name}」に見せないようにしました`)
                            })
                          }}
                        />
                        {pt.name}
                        <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{pt.member_count}人</span>
                      </label>
                    ))}
                  </div>
                )}
                {(() => {
                  const others = visibleParties.filter(id => !myParties.some(pt => pt.id === id)).length
                  return others > 0 ? (
                    <p style={{ ...emptyText, padding: '4px 0 0', fontSize: 11 }}>ほかの参加者が選んだパーティー {others}件にも見せています</p>
                  ) : null
                })()}
                <p style={{ ...emptyText, padding: '4px 0 0', fontSize: 11 }}>チェックの変更はすぐに反映されます。</p>
              </div>
            )}
            {visibility !== 'private' && <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-primary)' }}>
              <input
                type="checkbox"
                checked={visibility === 'public' ? true : applyOpen}
                disabled={visibility === 'public'}
                onChange={e => setApplyOpen(e.target.checked)}
              />
              参加申請を必要にする
              {visibility === 'public' && <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>（全体公開の間はオンに固定）</span>}
            </label>}
            <div>
              <button type="submit" style={btn('primary')} disabled={busy}>設定を保存</button>
            </div>
          </form>

          <div>
            <p style={sectionTitle}>自分のタイムラインでの色</p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {LECTURE_COLORS.map(c => (
                <button
                  key={c}
                  aria-label={`色 ${c}`}
                  onClick={() => run(async () => { await updateSubject(lectureId, { color: c }) })}
                  style={{
                    width: 26, height: 26, borderRadius: 7, background: c, cursor: 'pointer',
                    border: lecture.color === c ? '3px solid var(--text-primary)' : '2px solid var(--surface)',
                    boxShadow: 'var(--shadow-xs)',
                  }}
                />
              ))}
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: 14 }}>
            {!confirmLeave ? (
              <button style={btn('danger')} onClick={() => setConfirmLeave(true)}>この講義から退出</button>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  退出すると、この講義の課題はあなたのRiverから消えます。進捗やメモは保存され、再参加したときに戻ります。
                  {participants.filter(p => p.status === 'active').length <= 1 && ' 最後の1人なので、講義はアーカイブされ誰からも見えなくなります。'}
                </span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    style={btn('danger')}
                    disabled={busy}
                    onClick={() => run(async () => {
                      await deleteSubject(lectureId)
                      showToast('講義から退出しました')
                      onClose()
                    })}
                  >
                    退出する
                  </button>
                  <button style={btn('ghost')} onClick={() => setConfirmLeave(false)}>やめる</button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {tab === 'history' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {history === null && <p style={emptyText}>読み込み中...</p>}
          {history?.length === 0 && <p style={emptyText}>履歴はまだありません</p>}
          {history?.map(e => {
            const d = describe(e, name)
            if (!d) return null
            return (
              <div key={e.id} style={{ display: 'flex', gap: 10, padding: '8px 2px', borderBottom: '1px solid var(--border-light)' }}>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)', flexShrink: 0, width: 70 }}>{formatDateTime(e.created_at)}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                    <b>{e.actor_id ? name(e.actor_id) : 'システム'}</b>{' '}{d.what}
                  </div>
                  {d.diffs.map((line, i) => (
                    <div key={i} style={{ fontSize: 11, color: 'var(--text-secondary)', wordBreak: 'break-all' }}>{line}</div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Sheet>
  )
}
