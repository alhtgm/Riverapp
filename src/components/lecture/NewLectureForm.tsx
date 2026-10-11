import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { toMessage } from '../../lib/errors'
import { pickLectureColor } from '../../lib/colors'
import { useStore } from '../../store/useStore'
import { useToast } from '../ui/Toast'
import { btn, inputStyle } from '../ui/styles'
import JoinButton from './JoinButton'
import LectureCard from './LectureCard'
import { TERM_LABEL, type LectureSummary, type LectureTerm } from '../../types'

interface Props {
  /** 講義を作成した、または既存の講義に参加済みになったときに呼ぶ */
  onReady: (lectureId: string) => void
  onCancel: () => void
}

const TERMS: LectureTerm[] = ['spring', 'fall', 'full_year', 'other']

/** 4月始まりの年度と、4〜9月なら前期・それ以外は後期を既定値にする */
function defaultYearAndTerm(): { year: number; term: LectureTerm } {
  const now = new Date()
  const m = now.getMonth() + 1
  return { year: m >= 4 ? now.getFullYear() : now.getFullYear() - 1, term: m >= 4 && m <= 9 ? 'spring' : 'fall' }
}

/**
 * 講義の作成（5章）。作成前に、自分から見える講義のうち年度・学期が同じで
 * 名前が似ているもの（全角半角・空白・大文字小文字を正規化して一致）を候補として提示する。
 */
export default function NewLectureForm({ onReady, onCancel }: Props) {
  const { showToast } = useToast()
  const { addSubject, subjects } = useStore()
  const defaults = defaultYearAndTerm()
  const [title, setTitle] = useState('')
  const [year, setYear] = useState(defaults.year)
  const [term, setTerm] = useState<LectureTerm>(defaults.term)
  const [professor, setProfessor] = useState('')
  const [candidates, setCandidates] = useState<LectureSummary[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const create = async () => {
    const subject = await addSubject({ title, year, term, professor }, pickLectureColor(subjects.length))
    showToast(`講義「${subject.name}」を作成しました`)
    onReady(subject.id)
  }

  const submit = async () => {
    setError(null)
    if (!title.trim()) { setError('講義名を入力してください'); return }
    setBusy(true)
    try {
      if (candidates === null) {
        const { data, error: e1 } = await supabase.rpc('find_similar_lectures', { p_title: title, p_year: year, p_term: term })
        if (e1) throw e1
        const ids = ((data ?? []) as { id: string }[]).map(l => l.id)
        if (ids.length > 0) {
          const { data: sums, error: e2 } = await supabase.rpc('lecture_summaries', { p_ids: ids })
          if (e2) throw e2
          const list = (sums ?? []) as LectureSummary[]
          if (list.length > 0) {
            setCandidates(list)
            return
          }
        }
      }
      await create()
    } catch (e: unknown) {
      setError(toMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const refreshCandidates = async () => {
    if (!candidates) return
    const { data } = await supabase.rpc('lecture_summaries', { p_ids: candidates.map(c => c.id) })
    const list = (data ?? []) as LectureSummary[]
    setCandidates(list)
    // 申請なしで参加できた場合はそのまま選択状態にする
    const joined = list.find(l => l.my_status === 'participant' && useStore.getState().subjects.some(s => s.id === l.id))
    if (joined) onReady(joined.id)
  }

  return (
    <div style={{ marginTop: 8, padding: 12, border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface-warm)', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <input
        value={title}
        onChange={e => { setTitle(e.target.value); setCandidates(null) }}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void submit() } }}
        placeholder="講義名（必須）"
        autoFocus
        style={inputStyle}
      />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <input
          type="number" min={2000} max={2100} value={year}
          onChange={e => { setYear(Number(e.target.value)); setCandidates(null) }}
          aria-label="年度" style={inputStyle}
        />
        <select value={term} onChange={e => { setTerm(e.target.value as LectureTerm); setCandidates(null) }} aria-label="学期" style={inputStyle}>
          {TERMS.map(t => <option key={t} value={t}>{TERM_LABEL[t]}</option>)}
        </select>
      </div>
      <input value={professor} onChange={e => setProfessor(e.target.value)} placeholder="担当教員（任意）" style={inputStyle} />

      {candidates && candidates.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
            似た講義があります。既存の講義に参加しますか？
          </p>
          {candidates.map(c => (
            <LectureCard
              key={c.id}
              lecture={c}
              action={<JoinButton lecture={c} onChanged={refreshCandidates} onOpenLecture={onReady} />}
            />
          ))}
        </div>
      )}

      <p style={{ margin: 0, fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
        作成時の公開範囲は「パーティー内」（所属しているすべてのパーティーに表示）です。講義の画面からあとで変更できます。
      </p>
      {error && <div style={{ fontSize: 12, color: 'var(--danger)', fontWeight: 600 }}>{error}</div>}

      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
        <button type="button" style={btn('ghost', true)} onClick={onCancel}>キャンセル</button>
        <button type="button" style={btn('primary', true)} disabled={busy} onClick={() => {
          if (!candidates) { void submit(); return }
          setBusy(true)
          create().catch((e: unknown) => setError(toMessage(e))).finally(() => setBusy(false))
        }}>
          {candidates ? '新しく作成する' : '作成'}
        </button>
      </div>
    </div>
  )
}
