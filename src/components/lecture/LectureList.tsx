import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { TERM_LABEL, VISIBILITY_LABEL, formatDate, type LectureSummary } from '../../types'
import { emptyText, listRow } from '../ui/styles'
import JoinButton from './JoinButton'

interface Props {
  lectures: LectureSummary[]
  onChanged: () => void
  onOpenLecture: (lectureId: string) => void
  emptyMessage: string
}

interface TaskPreview {
  id: string
  title: string
  due_date: string
  due_time: string | null
}

/** 講義の一覧（プロフィール・パーティーのホーム画面）。行を開くと課題と進捗を表示する */
export default function LectureList({ lectures, onChanged, onOpenLecture, emptyMessage }: Props) {
  const [openId, setOpenId] = useState<string | null>(null)
  const [tasks, setTasks] = useState<Record<string, TaskPreview[]>>({})
  const [counts, setCounts] = useState<Record<string, { inProgress: number; done: number }>>({})

  const toggle = async (id: string) => {
    if (openId === id) { setOpenId(null); return }
    setOpenId(id)
    if (tasks[id]) return
    const [taskRes, progRes] = await Promise.all([
      supabase
        .from('lecture_tasks')
        .select('id, title, due_date, due_time')
        .eq('lecture_id', id)
        .is('deleted_at', null)
        .order('due_date'),
      supabase.rpc('get_lectures_progress', { p_lecture_ids: [id] }),
    ])
    setTasks(t => ({ ...t, [id]: (taskRes.data ?? []) as TaskPreview[] }))
    const next: Record<string, { inProgress: number; done: number }> = {}
    for (const row of (progRes.data ?? []) as { task_id: string; status: string }[]) {
      const c = next[row.task_id] ?? (next[row.task_id] = { inProgress: 0, done: 0 })
      if (row.status === 'in_progress') c.inProgress++
      else if (row.status === 'done' || row.status === 'submitted') c.done++
    }
    setCounts(c => ({ ...c, ...next }))
  }

  if (lectures.length === 0) return <p style={emptyText}>{emptyMessage}</p>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {lectures.map(l => {
        const open = openId === l.id
        return (
          <div key={l.id} style={{ ...listRow, flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                onClick={() => toggle(l.id)}
                aria-expanded={open}
                style={{
                  flex: 1, minWidth: 0, textAlign: 'left', background: 'none', border: 'none', padding: 0,
                  cursor: 'pointer', fontFamily: 'inherit', color: 'inherit',
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <span style={{ display: 'inline-block', width: 12, color: 'var(--text-tertiary)', fontSize: 10 }}>{open ? '▾' : '▸'}</span>
                  {l.title}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2, paddingLeft: 12, display: 'flex', flexWrap: 'wrap', gap: '0 8px' }}>
                  <span>{l.year}年度 {TERM_LABEL[l.term]}</span>
                  {l.professor && <span>{l.professor}</span>}
                  <span>参加 {l.participant_count}人{l.party_member_count !== null && `（うちメンバー ${l.party_member_count}人）`}</span>
                  <span>{VISIBILITY_LABEL[l.visibility]}・申請{l.apply_open ? 'あり' : 'なし'}</span>
                </div>
              </button>
              <JoinButton lecture={l} onChanged={onChanged} onOpenLecture={onOpenLecture} />
            </div>
            {open && (
              <div style={{ paddingLeft: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {!tasks[l.id] ? (
                  <p style={emptyText}>読み込み中...</p>
                ) : tasks[l.id].length === 0 ? (
                  <p style={emptyText}>課題はまだありません</p>
                ) : (
                  tasks[l.id].map(t => (
                    <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
                      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)' }}>{t.title}</span>
                      <span style={{ flexShrink: 0 }}>締切 {formatDate(t.due_date)}{t.due_time ? ` ${t.due_time}` : ''}</span>
                      <span style={{ flexShrink: 0, color: 'var(--text-tertiary)' }}>
                        取り組み中 {counts[t.id]?.inProgress ?? 0}・完了 {counts[t.id]?.done ?? 0}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
