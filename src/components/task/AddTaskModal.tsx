import { useState, useEffect } from 'react'
import type { Subject } from '../../types'
import { useStore } from '../../store/useStore'
import { toDateString, parseLocalDate, formatDate, TERM_LABEL } from '../../types'
import { subjectInSemester } from '../../lib/semester'
import { useToast } from '../ui/Toast'
import MiniCalendar from '../ui/MiniCalendar'
import NewLectureForm from '../lecture/NewLectureForm'
import Sheet from '../ui/Sheet'
import { Notice } from '../ui/kit'
import { Button, Chip, SegmentedButton, SelectField, TextArea, TextField } from '../ui/m3'

interface Props {
  subjects: Subject[]
  onClose: () => void
  defaultSubjectId?: string
}

type Mode = 'single' | 'recurring'
type IntervalOption = { label: string; weeks: number }

const INTERVALS: IntervalOption[] = [
  { label: '毎週', weeks: 1 },
  { label: '隔週', weeks: 2 },
  { label: '3週ごと', weeks: 3 },
  { label: '4週ごと', weeks: 4 },
]

const DAY_JA = ['日', '月', '火', '水', '木', '金', '土']

type DuePreset = { label: string; days: number }
// 締切日クイック設定（今日からの日数）
// 「その他」と合わせて6つを1行に並べるので、短い名前にする
const DUE_PRESETS: DuePreset[] = [
  { label: '今日',  days: 0 },
  { label: '明日',  days: 1 },
  { label: '3日後', days: 3 },
  { label: '1週間', days: 7 },
  { label: '2週間', days: 14 },
]

// 今日からの日数オフセットを YYYY-MM-DD に変換
function dateStringFromTodayOffset(days: number): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + days)
  return toDateString(d)
}

// 指定日が今日から何日後かを返す（プリセット判定用）
function offsetFromToday(dateStr: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((parseLocalDate(dateStr).getTime() - today.getTime()) / 86400000)
}

export default function AddTaskModal({ subjects, onClose, defaultSubjectId }: Props) {
  const { addTask, addRecurringTasks, subjects: allSubjects, semester } = useStore()
  const { showToast } = useToast()
  const [mode, setMode] = useState<Mode>('single')
  const [title, setTitle] = useState('')
  const [subjectId, setSubjectId] = useState(defaultSubjectId ?? subjects[0]?.id ?? '')
  const [startDate, setStartDate] = useState(toDateString(new Date()))
  const [dueDate, setDueDate] = useState(toDateString(new Date()))
  const [dueTime, setDueTime] = useState('')
  const [memo, setMemo] = useState('')
  const [intervalWeeks, setIntervalWeeks] = useState(1)
  const [durationDays, setDurationDays] = useState(7)
  const [count, setCount] = useState(5)
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [showNewSubject, setShowNewSubject] = useState(false)
  /** 締切日を「その他」（カレンダー直接指定）で編集中か */
  const [showCustomDue, setShowCustomDue] = useState(false)

  const effectiveMode = mode

  // ほかの学期の講義をこの画面で作った場合も選べるようにする（追加先の学期はトーストで知らせる）
  const chosen = allSubjects.find(s => s.id === subjectId)
  const options = chosen && !subjects.some(s => s.id === chosen.id) ? [...subjects, chosen] : subjects
  const otherSemesterNote = chosen && !subjectInSemester(chosen, semester)
    ? `（${chosen.year}年度 ${TERM_LABEL[chosen.term]}の講義です）`
    : ''

  useEffect(() => {
    if (subjects.length > 0 && !subjectId) setSubjectId(subjects[0].id)
  }, [subjects, subjectId])

  const recurringPreview = () => {
    if (!startDate || count <= 0) return null
    const start = parseLocalDate(startDate)
    const lastStart = new Date(start)
    lastStart.setDate(lastStart.getDate() + (count - 1) * intervalWeeks * 7)
    const lastDue = new Date(lastStart)
    lastDue.setDate(lastDue.getDate() + durationDays)
    return `${formatDate(startDate)} 〜 ${toDateString(lastDue).split('-').map((v, i) => i === 0 ? '' : i === 1 ? `${Number(v)}月` : `${Number(v)}日`).join('')}、全${count}回`
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    if (!subjectId) { setErrorMsg('講義を選択してください'); return }
    if (!startDate) { setErrorMsg('開始日を入力してください'); return }
    if (effectiveMode === 'single' && !dueDate) { setErrorMsg('締切日を入力してください'); return }
    if (effectiveMode === 'single' && startDate > dueDate) { setErrorMsg('締切日は開始日以降に設定してください'); return }
    
    const effectiveTitle = title.trim() || '課題'
    setSaving(true)
    try {
      if (effectiveMode === 'single') {
        await addTask({
          subject_id: subjectId,
          title: effectiveTitle,
          start_date: startDate,
          due_date: dueDate,
          due_time: dueTime || null,
          status: 'todo',
          memo: memo || null,
        })
        showToast(`課題を追加しました${otherSemesterNote}`)
      } else {
        await addRecurringTasks(
          { title: effectiveTitle, start_from: startDate, interval_weeks: intervalWeeks, duration_days: durationDays, count },
          subjectId
        )
        showToast(`繰り返し課題を${count}件追加しました${otherSemesterNote}`)
      }
      onClose()
    } catch (e: unknown) {
      setErrorMsg((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  // 締切日クイックボタン: 今日から N 日後を締切に設定
  const applyDuePreset = (days: number) => {
    setDueDate(dateStringFromTodayOffset(days))
    setShowCustomDue(false)
  }

  // 現在の締切日に一致するプリセット（「その他」編集中は無し）
  const activePresetDays = !showCustomDue
    ? DUE_PRESETS.find(p => p.days === offsetFromToday(dueDate))?.days
    : undefined

  const preview = mode === 'recurring' ? recurringPreview() : null

  return (
    <Sheet
      title="課題を追加"
      onClose={onClose}
      zIndex={210}
      footer={
        <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
          <Button variant="text" onClick={onClose}>キャンセル</Button>
          <Button type="submit" form={FORM_ID} loading={saving}>{saving ? '保存中' : '追加'}</Button>
        </div>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        {errorMsg && <Notice tone="danger">{errorMsg}</Notice>}

        <SegmentedButton
          label="追加のしかた"
          options={[{ key: 'single', label: '単発' }, { key: 'recurring', label: '繰り返し' }]}
          value={mode}
          onChange={setMode}
        />

        <TextField label="タイトル" value={title} onChange={e => setTitle(e.target.value)} placeholder="未入力の場合「課題」" />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <div>
            <div>
              <SelectField
                label="講義"
                value={subjectId}
                onChange={e => setSubjectId(e.target.value)}
              >
                {options.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
                {options.length === 0 && <option value="">講義がありません（下の「新しい講義を作る」から作成）</option>}
              </SelectField>
            </div>
          </div>
          <p style={{ ...typeBodySmall, color: 'var(--text-secondary)', margin: 'calc(-1 * var(--space-2)) 0 0', padding: '0 var(--space-4)' }}>
            課題名・開始日・締切は講義の参加者全員に共有されます。ステータス・メモはあなただけのものです。
          </p>
          {/* 講義の欄の横に丸いボタンを並べると形がそろわないので、欄の下に控えめに置く */}
          {!showNewSubject && (
            <div>
              <Button variant="text" icon={plusIcon} onClick={() => setShowNewSubject(true)} aria-expanded={false}>
                新しい講義を作る
              </Button>
            </div>
          )}
          {showNewSubject && (
            <NewLectureForm
              onReady={id => { setSubjectId(id); setShowNewSubject(false) }}
              onCancel={() => setShowNewSubject(false)}
            />
          )}
        </div>

        {mode === 'single' ? (
          <>
            <TextField label="開始日" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required />

            <div role="group" aria-labelledby="add-task-due-label" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <span id="add-task-due-label" style={groupLabel}>締切日</span>
              <div>
                {/* 1本につながった切り替え（6つを同じ幅で1行に。狭い画面でも収まるようチェックの印は付けない） */}
                <div role="radiogroup" aria-labelledby="add-task-due-label" className="m3-segmented m3-segmented--block">
                  {DUE_PRESETS.map(p => {
                    const selected = activePresetDays === p.days
                    return (
                      <button
                        key={p.days}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        className={`m3-segment m3-state${selected ? ' m3-segment--selected' : ''}`}
                        style={{ padding: '0 var(--space-1)', minWidth: 0, whiteSpace: 'nowrap' }}
                        onClick={() => applyDuePreset(p.days)}
                      >
                        {p.label}
                      </button>
                    )
                  })}
                  <button
                    type="button"
                    role="radio"
                    aria-checked={showCustomDue}
                    className={`m3-segment m3-state${showCustomDue ? ' m3-segment--selected' : ''}`}
                    style={{ padding: '0 var(--space-1)', minWidth: 0, whiteSpace: 'nowrap' }}
                    onClick={() => setShowCustomDue(true)}
                  >
                    その他
                  </button>
                </div>
              </div>
              {showCustomDue && (
                <MiniCalendar value={dueDate} min={startDate} onChange={d => setDueDate(d)} />
              )}
              <div style={{ ...typeBodySmall, color: 'var(--text-secondary)' }}>
                締切日: <strong style={{ color: 'var(--text-primary)' }}>{formatDate(dueDate)}（{DAY_JA[parseLocalDate(dueDate).getDay()]}）</strong>
                {dueDate < startDate && <span style={{ color: 'var(--danger)', marginLeft: 'var(--space-2)' }}>※開始日より前です</span>}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-2)' }}>
              <div style={{ width: 180 }}>
                <TextField label="締切時刻（任意）" type="time" value={dueTime} onChange={e => setDueTime(e.target.value)} />
              </div>
              {dueTime && <Button variant="text" onClick={() => setDueTime('')} style={{ marginTop: 'var(--space-2)' }}>クリア</Button>}
            </div>

            <TextArea label="メモ（任意）" value={memo} onChange={e => setMemo(e.target.value)} rows={3} placeholder="自分だけが見られるメモ" />
          </>
        ) : (
          <>
            <TextField label="繰り返し開始日" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required />

            <div role="group" aria-labelledby="add-task-interval-label" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <span id="add-task-interval-label" style={groupLabel}>発生間隔</span>
              <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                {INTERVALS.map(iv => (
                  <Chip key={iv.weeks} selected={intervalWeeks === iv.weeks} onClick={() => setIntervalWeeks(iv.weeks)}>
                    {iv.label}
                  </Chip>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
              <TextField
                label="締切（発生から何日後）"
                type="number"
                min={1}
                value={durationDays === 0 ? '' : durationDays}
                onChange={e => {
                  const n = parseInt(e.target.value, 10)
                  setDurationDays(isNaN(n) ? 0 : n)
                }}
                required
              />
              <TextField
                label="回数"
                type="number"
                min={1}
                max={52}
                value={count === 0 ? '' : count}
                onChange={e => {
                  const n = parseInt(e.target.value, 10)
                  setCount(isNaN(n) ? 0 : n)
                }}
                required
              />
            </div>

            {preview && (
              <div style={{ background: 'var(--accent-bg)', color: 'var(--accent-dark)', borderRadius: 'var(--shape-md)', padding: 'var(--space-3) var(--space-4)', ...typeBodyMedium }}>
                {preview}
              </div>
            )}
          </>
        )}
      </form>
    </Sheet>
  )
}

const FORM_ID = 'add-task-form'

/** チップのまとまりなどに付ける見出し（入力欄のラベルと同じ役割） */
const groupLabel: React.CSSProperties = {
  fontSize: 'var(--type-label-large-size)', lineHeight: 'var(--type-label-large-line)',
  fontWeight: 'var(--type-label-large-weight)', letterSpacing: 'var(--type-label-large-tracking)',
  color: 'var(--text-secondary)',
}
const typeBodySmall: React.CSSProperties = {
  fontSize: 'var(--type-body-small-size)', lineHeight: 'var(--type-body-small-line)', letterSpacing: 'var(--type-body-small-tracking)',
}
const typeBodyMedium: React.CSSProperties = {
  fontSize: 'var(--type-body-medium-size)', lineHeight: 'var(--type-body-medium-line)', letterSpacing: 'var(--type-body-medium-tracking)',
}

const plusIcon = (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
    <path d="M9 4v10M4 9h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
)
