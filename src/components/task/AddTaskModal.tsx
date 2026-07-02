import { useState, useEffect } from 'react'
import type { Subject } from '../../types'
import { useStore } from '../../store/useStore'
import { toDateString, parseLocalDate, formatDate } from '../../types'
import { useToast } from '../ui/Toast'
import MiniCalendar from '../ui/MiniCalendar'

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

const COLORS = ['#E16259', '#ef946c', '#16A34A', '#7C3AED', '#D97706', '#DB2777', '#0284C7', '#4F46E5']

const DAY_JA = ['日', '月', '火', '水', '木', '金', '土']

type DuePreset = { label: string; days: number }
// 締切日クイック設定（今日からの日数）
const DUE_PRESETS: DuePreset[] = [
  { label: '今日',    days: 0 },
  { label: '1日後',   days: 1 },
  { label: '3日後',   days: 3 },
  { label: '1週間後', days: 7 },
  { label: '2週間後', days: 14 },
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
  const { addTask, addRecurringTasks, addSubject } = useStore()
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
  const [newSubjectName, setNewSubjectName] = useState('')
  const [showNewSubject, setShowNewSubject] = useState(false)
  /** 締切日を「その他」（カレンダー直接指定）で編集中か */
  const [showCustomDue, setShowCustomDue] = useState(false)

  const effectiveMode = mode

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

  const handleAddSubject = async () => {
    const name = newSubjectName.trim()
    if (!name) return
    const autoColor = COLORS[subjects.length % COLORS.length]
    await addSubject(name, autoColor)
    setNewSubjectName('')
    setShowNewSubject(false)
    showToast(`科目「${name}」を追加しました`)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    if (!subjectId) { setErrorMsg('科目を選択してください'); return }
    if (!startDate) { setErrorMsg('開始日を入力してください'); return }
    if (effectiveMode === 'single' && !dueDate) { setErrorMsg('締切日を入力してください'); return }
    if (effectiveMode === 'single' && startDate > dueDate) { setErrorMsg('締切日は開始日以降に設定してください'); return }
    
    const effectiveTitle = title.trim() || '課題'
    setSaving(true)
    try {
      if (effectiveMode === 'single') {
        await addTask({
          subject_id: subjectId,
          recurrence_id: null,
          row_id: null,
          source_template_id: null,
          title: effectiveTitle,
          start_date: startDate,
          due_date: dueDate,
          due_time: dueTime || null,
          status: 'todo',
          memo: memo || null,
        })
        showToast('課題を追加しました')
      } else {
        await addRecurringTasks(
          { subject_id: subjectId, title: effectiveTitle, start_from: startDate, interval_weeks: intervalWeeks, duration_days: durationDays, count },
          subjectId
        )
        showToast(`繰り返し課題を${count}件追加しました`)
      }
      onClose()
    } catch (e: unknown) {
      setErrorMsg((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    background: 'var(--surface-warm)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '9px 12px',
    fontSize: 14,
    color: 'var(--text-primary)',
    outline: 'none',
    width: '100%',
    fontFamily: 'inherit',
    letterSpacing: '-0.01em',
    transition: 'border-color 0.2s, box-shadow 0.2s',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 700,
    color: 'var(--text-tertiary)',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    marginBottom: 6,
    display: 'block',
  }

  const handleFocus = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    e.target.style.borderColor = 'var(--accent)'
    e.target.style.boxShadow = '0 0 0 3px rgba(239,148,108,0.12)'
    e.target.style.background = 'var(--surface)'
  }
  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    e.target.style.borderColor = 'var(--border)'
    e.target.style.boxShadow = 'none'
    e.target.style.background = 'var(--surface-warm)'
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

  // 締切日プリセット用ピル（繰り返しの発生間隔ピルと同じ見た目）
  const pillStyle = (active: boolean): React.CSSProperties => ({
    background: active ? 'var(--accent-bg)' : 'var(--bg-secondary)',
    color: active ? 'var(--accent)' : 'var(--text-secondary)',
    border: `1px solid ${active ? 'rgba(239,148,108,0.3)' : 'var(--border)'}`,
    borderRadius: 9999,
    padding: '5px 14px',
    fontSize: 13,
    fontWeight: active ? 600 : 400,
    cursor: 'pointer',
    transition: 'all 0.2s',
    fontFamily: 'inherit',
    letterSpacing: '-0.01em',
    boxShadow: active ? '0 2px 6px rgba(239,148,108,0.18)' : 'none',
  })

  return (
    <>
      <div
        style={{ position: 'fixed', inset: 0, background: 'rgba(20,16,10,0.3)', backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)', zIndex: 200 }}
        onClick={onClose}
      />
      <div style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        boxShadow: '0 24px 64px rgba(20,16,10,0.14), 0 8px 20px rgba(20,16,10,0.07)',
        zIndex: 210,
        width: 'min(520px, calc(100vw - 32px))',
        maxHeight: 'calc(100svh - 48px)',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
      }}>

        {/* Header */}
        <div style={{
          padding: '18px 22px',
          borderBottom: '1px solid var(--border-light)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          background: 'var(--surface)',
          zIndex: 1,
          borderRadius: '16px 16px 0 0',
        }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text-primary)', letterSpacing: '-0.04em' }}>
            {'課題を追加'}
          </h2>
          <button
            onClick={onClose}
            aria-label="モーダルを閉じる"
            style={{
              background: 'var(--bg-secondary)',
              border: 'none',
              borderRadius: 6,
              width: 28,
              height: 28,
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.12s',
              fontFamily: 'inherit',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--border)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-secondary)' }}
          >
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: 18 }}>

          {errorMsg && (
            <div style={{ padding: '12px 16px', background: '#FEF2F2', color: '#DC2626', border: '1px solid rgba(220,38,38,0.25)', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>
              {errorMsg}
            </div>
          )}

          {/* Mode toggle */}
          {(
            <div style={{
              display: 'inline-flex',
              background: 'var(--bg-secondary)',
              borderRadius: 10,
              padding: 3,
              gap: 2,
              alignSelf: 'flex-start',
            }}>
              {(['single', 'recurring'] as Mode[]).map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  style={{
                    background: mode === m ? 'var(--surface)' : 'transparent',
                    color: mode === m ? 'var(--text-primary)' : 'var(--text-secondary)',
                    border: 'none',
                    borderRadius: 7,
                    padding: '6px 18px',
                    fontSize: 13,
                    fontWeight: mode === m ? 600 : 400,
                    cursor: 'pointer',
                    boxShadow: mode === m ? '0 1px 4px rgba(20,16,10,0.1)' : 'none',
                    transition: 'all 0.25s',
                    letterSpacing: '-0.01em',
                    fontFamily: 'inherit',
                  }}
                >
                  {m === 'single' ? '単発' : '繰り返し'}
                </button>
              ))}
            </div>
          )}

          {/* Title */}
          <div>
            <label style={labelStyle}>タイトル</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              style={inputStyle}
              placeholder="未入力の場合「課題」"
              onFocus={handleFocus}
              onBlur={handleBlur}
            />
          </div>

          {/* Subject */}
          <div>
            <label style={labelStyle}>科目</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <select
                value={subjectId}
                onChange={e => setSubjectId(e.target.value)}
                style={{
                  ...inputStyle,
                  flex: 1,
                  cursor: 'pointer',
                  appearance: 'auto',
                }}
                onFocus={handleFocus}
                onBlur={handleBlur}
              >
                {subjects.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
                {subjects.length === 0 && <option value="">科目がありません</option>}
              </select>
              {(
                <button
                  type="button"
                  onClick={() => setShowNewSubject(!showNewSubject)}
                  style={{
                    background: showNewSubject ? 'var(--accent-bg)' : 'var(--bg-secondary)',
                    border: `1px solid ${showNewSubject ? 'rgba(239,148,108,0.3)' : 'var(--border)'}`,
                    borderRadius: 8,
                    padding: '0 12px',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    color: showNewSubject ? 'var(--accent)' : 'var(--text-secondary)',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.2s',
                    fontFamily: 'inherit',
                    letterSpacing: '-0.01em',
                    height: 38,
                    flexShrink: 0,
                  }}
                >
                  + 科目
                </button>
              )}
            </div>

            {/* Simplified inline subject add — no color picker, Enter to save */}
            {showNewSubject && (
              <div style={{
                marginTop: 8,
                display: 'flex',
                gap: 6,
              }}>
                <input
                  type="text"
                  value={newSubjectName}
                  onChange={e => setNewSubjectName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddSubject() } }}
                  style={{ ...inputStyle, flex: 1 }}
                  placeholder="科目名を入力してEnter"
                  autoFocus
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                />
                <button
                  type="button"
                  onClick={handleAddSubject}
                  style={{
                    background: '#ef946c',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    padding: '0 14px',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    flexShrink: 0,
                    height: 38,
                  }}
                >
                  追加
                </button>
              </div>
            )}
          </div>

          {effectiveMode === 'single' ? (
            <>
              <div>
                <label style={labelStyle}>開始日</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required style={inputStyle} onFocus={handleFocus} onBlur={handleBlur} />
              </div>
              <div>
                <label style={labelStyle}>締切日</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {DUE_PRESETS.map(p => (
                    <button
                      key={p.days}
                      type="button"
                      onClick={() => applyDuePreset(p.days)}
                      style={pillStyle(activePresetDays === p.days)}
                    >
                      {p.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setShowCustomDue(true)}
                    style={pillStyle(showCustomDue)}
                  >
                    その他
                  </button>
                </div>

                {showCustomDue && (
                  <MiniCalendar
                    value={dueDate}
                    min={startDate}
                    onChange={d => setDueDate(d)}
                  />
                )}

                <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-tertiary)', letterSpacing: '-0.01em' }}>
                  締切日: <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{formatDate(dueDate)}（{DAY_JA[parseLocalDate(dueDate).getDay()]}）</span>
                  {dueDate < startDate && <span style={{ color: 'var(--danger)', marginLeft: 6 }}>※開始日より前です</span>}
                </div>
              </div>
              <div>
                <label style={labelStyle}>締切時刻（任意）</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input
                    type="time"
                    value={dueTime}
                    onChange={e => setDueTime(e.target.value)}
                    style={{ ...inputStyle, width: 'auto' }}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                  />
                  {dueTime && (
                    <button
                      type="button"
                      onClick={() => setDueTime('')}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        fontSize: 11, color: 'var(--text-tertiary)', padding: 0, fontFamily: 'inherit',
                      }}
                    >
                      クリア
                    </button>
                  )}
                </div>
              </div>
              <div>
                <label style={labelStyle}>メモ（任意）</label>
                <textarea
                  value={memo}
                  onChange={e => setMemo(e.target.value)}
                  rows={3}
                  style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
                  placeholder="メモを入力..."
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <label style={labelStyle}>繰り返し開始日</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required style={inputStyle} onFocus={handleFocus} onBlur={handleBlur} />
              </div>

              <div>
                <label style={labelStyle}>発生間隔</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {INTERVALS.map(iv => (
                    <button
                      key={iv.weeks}
                      type="button"
                      onClick={() => setIntervalWeeks(iv.weeks)}
                      style={{
                        background: intervalWeeks === iv.weeks ? 'var(--accent-bg)' : 'var(--bg-secondary)',
                        color: intervalWeeks === iv.weeks ? 'var(--accent)' : 'var(--text-secondary)',
                        border: `1px solid ${intervalWeeks === iv.weeks ? 'rgba(239,148,108,0.3)' : 'var(--border)'}`,
                        borderRadius: 9999,
                        padding: '5px 14px',
                        fontSize: 13,
                        fontWeight: intervalWeeks === iv.weeks ? 600 : 400,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        fontFamily: 'inherit',
                        letterSpacing: '-0.01em',
                        boxShadow: intervalWeeks === iv.weeks ? '0 2px 6px rgba(239,148,108,0.18)' : 'none',
                      }}
                    >
                      {iv.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>締切オフセット（日数）</label>
                  <input
                    type="number"
                    min={1}
                    value={durationDays === 0 ? '' : durationDays}
                    onChange={e => {
                      const n = parseInt(e.target.value, 10)
                      setDurationDays(isNaN(n) ? 0 : n)
                    }}
                    required
                    style={inputStyle}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                  />
                </div>
                <div>
                  <label style={labelStyle}>回数</label>
                  <input
                    type="number"
                    min={1}
                    max={52}
                    value={count === 0 ? '' : count}
                    onChange={e => {
                      const n = parseInt(e.target.value, 10)
                      setCount(isNaN(n) ? 0 : n)
                    }}
                    required
                    style={inputStyle}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                  />
                </div>
              </div>

              {(() => {
                const preview = recurringPreview()
                return preview ? (
                  <div style={{
                    background: 'var(--accent-bg)',
                    border: '1px solid rgba(59,99,255,0.2)',
                    borderRadius: 10,
                    padding: '11px 14px',
                    fontSize: 13,
                    color: 'var(--accent)',
                    fontWeight: 500,
                    letterSpacing: '-0.01em',
                    lineHeight: 1.5,
                  }}>
                    {preview}
                  </div>
                ) : null
              })()}
            </>
          )}

          {/* Footer */}
          <div style={{
            display: 'flex',
            gap: 8,
            justifyContent: 'flex-end',
            paddingTop: 8,
            borderTop: '1px solid var(--border-light)',
          }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '9px 18px',
                fontSize: 14,
                fontWeight: 500,
                cursor: 'pointer',
                color: 'var(--text-secondary)',
                fontFamily: 'inherit',
                letterSpacing: '-0.02em',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--border-light)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-secondary)' }}
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{
                background: saving ? 'var(--text-tertiary)' : 'linear-gradient(135deg, #ef946c 0%, #d4794f 100%)',
                color: '#ffffff',
                border: 'none',
                borderRadius: 8,
                padding: '9px 24px',
                fontSize: 14,
                fontWeight: 600,
                cursor: saving ? 'not-allowed' : 'pointer',
                transition: 'all 0.25s',
                letterSpacing: '-0.02em',
                fontFamily: 'inherit',
                boxShadow: saving ? 'none' : '0 3px 10px rgba(239,148,108,0.3)',
              }}
              onMouseEnter={e => {
                if (!saving) {
                  e.currentTarget.style.boxShadow = '0 5px 16px rgba(239,148,108,0.42)'
                  e.currentTarget.style.transform = 'translateY(-1px)'
                }
              }}
              onMouseLeave={e => {
                if (!saving) {
                  e.currentTarget.style.boxShadow = '0 3px 10px rgba(239,148,108,0.3)'
                  e.currentTarget.style.transform = 'translateY(0)'
                }
              }}
            >
              {saving ? '保存中...' : '追加'}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
