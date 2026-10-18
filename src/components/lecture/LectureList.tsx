import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { parseLocalDate, type LectureSummary } from '../../types'
import { emptyText } from '../ui/styles'
import { EmptyState } from '../ui/kit'
import JoinButton from './JoinButton'
import LectureCard from './LectureCard'

interface Props {
  lectures: LectureSummary[]
  onChanged: () => void
  onOpenLecture: (lectureId: string) => void
  emptyMessage: string
  /** カードを開いて課題と進捗を表示できるようにする（既定: する） */
  expandable?: boolean
}

interface TaskPreview {
  id: string
  title: string
  due_date: string
  due_time: string | null
}

const DOW = ['日', '月', '火', '水', '木', '金', '土']

/** 締切日を「10/16 金」のような小さな日付ラベルにする */
function DueLabel({ date, time }: { date: string; time: string | null }) {
  const d = parseLocalDate(date)
  return (
    <span style={{
      display: 'inline-flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      width: 46, flexShrink: 0, padding: '3px 0', borderRadius: 8, background: 'var(--bg-secondary)',
    }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>
        {d.getMonth() + 1}/{d.getDate()}
      </span>
      <span style={{ fontSize: 9, color: 'var(--text-tertiary)', lineHeight: 1.2 }}>
        {DOW[d.getDay()]}{time ? ` ${time}` : ''}
      </span>
    </span>
  )
}

/** 講義の一覧（プロフィール・パーティーのホーム画面）。カードを開くと課題と進捗を表示する */
export default function LectureList({ lectures, onChanged, onOpenLecture, emptyMessage, expandable = true }: Props) {
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

  if (lectures.length === 0) return <EmptyState title={emptyMessage} />

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 340px), 1fr))', gap: 10, alignItems: 'start' }}>
      {lectures.map(l => {
        const list = tasks[l.id]
        return (
          <LectureCard
            key={l.id}
            lecture={l}
            action={<JoinButton lecture={l} onChanged={onChanged} onOpenLecture={onOpenLecture} />}
            expanded={openId === l.id}
            onToggle={expandable ? () => void toggle(l.id) : undefined}
          >
            {!list ? (
              <p style={emptyText}>読み込み中...</p>
            ) : list.length === 0 ? (
              <p style={emptyText}>課題はまだありません</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {list.map(t => (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <DueLabel date={t.due_date} time={t.due_time} />
                    <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.title}
                    </span>
                    <span style={{ display: 'inline-flex', gap: 8, flexShrink: 0, fontSize: 11, fontWeight: 700 }}>
                      <span style={{ color: 'var(--st-progress)' }} title="取り組み中">● {counts[t.id]?.inProgress ?? 0}</span>
                      <span style={{ color: 'var(--st-done)' }} title="完了・提出済み">✓ {counts[t.id]?.done ?? 0}</span>
                    </span>
                  </div>
                ))}
                <p style={{ ...emptyText, fontSize: 10, padding: '2px 0 0' }}>● 取り組み中 / ✓ 完了・提出済み</p>
              </div>
            )}
          </LectureCard>
        )
      })}
    </div>
  )
}
