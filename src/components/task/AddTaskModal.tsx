import { useState, useEffect } from 'react'
import type { Subject } from '../../types'
import { useStore } from '../../store/useStore'
import { toDateString, parseLocalDate, formatDate } from '../../types'
import { useToast } from '../ui/Toast'

interface Props {
  subjects: Subject[]
  onClose: () => void
  defaultSubjectId?: string
  /** rowKey of an existing row — if set, the new task is added to that row */
  targetRowId?: string
}

type Mode = 'single' | 'recurring'
type IntervalOption = { label: string; weeks: number }

const INTERVALS: IntervalOption[] = [
  { label: '毎週', weeks: 1 },
  { label: '隔週', weeks: 2 },
  { label: '3週ごと', weeks: 3 },
  { label: '4週ごと', weeks: 4 },
]

const COLORS = ['#E16259', '#3B63FF', '#16A34A', '#7C3AED', '#D97706', '#DB2777', '#0891B2', '#4F46E5']

export default function AddTaskModal({ subjects, onClose, defaultSubjectId, targetRowId }: Props) {
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

  // When adding to an existing row, always use single mode
  const isRowAdd = !!targetRowId
  const effectiveMode = isRowAdd ? 'single' : mode

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
          row_id: targetRowId ?? null,
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
    background: '#FAFAF8',
    border: '1px solid #E3DDD5',
    borderRadius: 8,
    padding: '9px 12px',
    fontSize: 14,
    color: '#1C1917',
    outline: 'none',
    width: '100%',
    fontFamily: 'inherit',
    letterSpacing: '-0.01em',
    transition: 'border-color 0.2s, box-shadow 0.2s',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 700,
    color: '#A8A29E',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    marginBottom: 6,
    display: 'block',
  }

  const handleFocus = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    e.target.style.borderColor = '#3B63FF'
    e.target.style.boxShadow = '0 0 0 3px rgba(59,99,255,0.12)'
    e.target.style.background = '#FFFFFF'
  }
  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    e.target.style.borderColor = '#E3DDD5'
    e.target.style.boxShadow = 'none'
    e.target.style.background = '#FAFAF8'
  }

  return (
    <>
      <div
        style={{ position: 'fixed', inset: 0, background: 'rgba(20,16,10,0.3)', backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)', zIndex: 60 }}
        onClick={onClose}
      />
      <div style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        background: '#FFFFFF',
        border: '1px solid #E3DDD5',
        borderRadius: 16,
        boxShadow: '0 24px 64px rgba(20,16,10,0.14), 0 8px 20px rgba(20,16,10,0.07)',
        zIndex: 70,
        width: 'min(520px, calc(100vw - 32px))',
        maxHeight: 'calc(100svh - 48px)',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
      }}>

        {/* Header */}
        <div style={{
          padding: '18px 22px',
          borderBottom: '1px solid #EDE8DF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          background: '#FFFFFF',
          zIndex: 1,
          borderRadius: '16px 16px 0 0',
        }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#1C1917', letterSpacing: '-0.04em' }}>
            {isRowAdd ? '行に課題を追加' : '課題を追加'}
          </h2>
          <button
            onClick={onClose}
            aria-label="モーダルを閉じる"
            style={{
              background: '#EDE8DF',
              border: 'none',
              borderRadius: 6,
              width: 28,
              height: 28,
              cursor: 'pointer',
              color: '#78716C',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.12s',
              fontFamily: 'inherit',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#E3DDD5' }}
            onMouseLeave={e => { e.currentTarget.style.background = '#EDE8DF' }}
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

          {/* Mode toggle — hidden when adding to existing row */}
          {!isRowAdd && (
            <div style={{
              display: 'inline-flex',
              background: '#F2EFE9',
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
                    background: mode === m ? '#FFFFFF' : 'transparent',
                    color: mode === m ? '#1C1917' : '#78716C',
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
                disabled={isRowAdd}
                style={{
                  ...inputStyle,
                  flex: 1,
                  cursor: isRowAdd ? 'default' : 'pointer',
                  appearance: 'auto',
                  opacity: isRowAdd ? 0.7 : 1,
                }}
                onFocus={handleFocus}
                onBlur={handleBlur}
              >
                {subjects.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
                {subjects.length === 0 && <option value="">科目がありません</option>}
              </select>
              {!isRowAdd && (
                <button
                  type="button"
                  onClick={() => setShowNewSubject(!showNewSubject)}
                  style={{
                    background: showNewSubject ? '#EEF2FF' : '#F2EFE9',
                    border: `1px solid ${showNewSubject ? '#3B63FF44' : '#E3DDD5'}`,
                    borderRadius: 8,
                    padding: '0 12px',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    color: showNewSubject ? '#3B63FF' : '#78716C',
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
            {showNewSubject && !isRowAdd && (
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
                    background: '#3B63FF',
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>開始日</label>
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required style={inputStyle} onFocus={handleFocus} onBlur={handleBlur} />
                </div>
                <div>
                  <label style={labelStyle}>締切日</label>
                  <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} required style={inputStyle} onFocus={handleFocus} onBlur={handleBlur} />
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
                        fontSize: 11, color: '#A8A29E', padding: 0, fontFamily: 'inherit',
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
                        background: intervalWeeks === iv.weeks ? '#EEF2FF' : '#F2EFE9',
                        color: intervalWeeks === iv.weeks ? '#3B63FF' : '#78716C',
                        border: `1px solid ${intervalWeeks === iv.weeks ? '#3B63FF44' : '#E3DDD5'}`,
                        borderRadius: 9999,
                        padding: '5px 14px',
                        fontSize: 13,
                        fontWeight: intervalWeeks === iv.weeks ? 600 : 400,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        fontFamily: 'inherit',
                        letterSpacing: '-0.01em',
                        boxShadow: intervalWeeks === iv.weeks ? '0 2px 6px rgba(59,99,255,0.18)' : 'none',
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
                    background: '#EEF2FF',
                    border: '1px solid rgba(59,99,255,0.2)',
                    borderRadius: 10,
                    padding: '11px 14px',
                    fontSize: 13,
                    color: '#3B63FF',
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
            borderTop: '1px solid #EDE8DF',
          }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: '#F2EFE9',
                border: '1px solid #E3DDD5',
                borderRadius: 8,
                padding: '9px 18px',
                fontSize: 14,
                fontWeight: 500,
                cursor: 'pointer',
                color: '#78716C',
                fontFamily: 'inherit',
                letterSpacing: '-0.02em',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#EDE8DF' }}
              onMouseLeave={e => { e.currentTarget.style.background = '#F2EFE9' }}
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{
                background: saving ? '#A8A29E' : 'linear-gradient(135deg, #3B63FF 0%, #2D52E8 100%)',
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
                boxShadow: saving ? 'none' : '0 3px 10px rgba(59,99,255,0.3)',
              }}
              onMouseEnter={e => {
                if (!saving) {
                  e.currentTarget.style.boxShadow = '0 5px 16px rgba(59,99,255,0.42)'
                  e.currentTarget.style.transform = 'translateY(-1px)'
                }
              }}
              onMouseLeave={e => {
                if (!saving) {
                  e.currentTarget.style.boxShadow = '0 3px 10px rgba(59,99,255,0.3)'
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
