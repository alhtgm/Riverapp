import { useState, useEffect } from 'react'
import type { Task, Subject, TaskStatus } from '../../types'
import { STATUS_CONFIG, STATUS_ORDER } from '../../types'
import { useStore } from '../../store/useStore'

interface Props {
  task: Task | null
  subjects: Subject[]
  onClose: () => void
}

// ---- Markdown renderer ----
function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = []
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|\[(.+?)\]\((.+?)\))/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  let i = 0
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index))
    if (match[0].startsWith('**')) {
      parts.push(<strong key={i++}>{match[2]}</strong>)
    } else if (match[0].startsWith('*')) {
      parts.push(<em key={i++}>{match[3]}</em>)
    } else {
      parts.push(
        <a key={i++} href={match[5]} target="_blank" rel="noopener noreferrer"
          style={{ color: '#3B63FF', textDecoration: 'underline' }}>
          {match[4]}
        </a>
      )
    }
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex))
  return <>{parts}</>
}

function MarkdownPreview({ text }: { text: string }) {
  const lines = text.split('\n')
  const elements: React.ReactNode[] = []
  let listItems: React.ReactNode[] = []
  let key = 0

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={key++} style={{ paddingLeft: 18, margin: '4px 0' }}>
          {listItems.map((item, i) => (
            <li key={i} style={{ fontSize: 14, color: '#1C1917', lineHeight: 1.6 }}>{item}</li>
          ))}
        </ul>
      )
      listItems = []
    }
  }

  for (const line of lines) {
    if (line.startsWith('### ')) {
      flushList()
      elements.push(<h3 key={key++} style={{ fontSize: 13, fontWeight: 700, margin: '8px 0 2px', color: '#1C1917' }}>{renderInline(line.slice(4))}</h3>)
    } else if (line.startsWith('## ')) {
      flushList()
      elements.push(<h2 key={key++} style={{ fontSize: 14, fontWeight: 700, margin: '8px 0 2px', color: '#1C1917' }}>{renderInline(line.slice(3))}</h2>)
    } else if (line.startsWith('# ')) {
      flushList()
      elements.push(<h1 key={key++} style={{ fontSize: 15, fontWeight: 700, margin: '8px 0 2px', color: '#1C1917' }}>{renderInline(line.slice(2))}</h1>)
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      listItems.push(renderInline(line.slice(2)))
    } else if (line.trim() === '') {
      flushList()
      if (elements.length > 0) elements.push(<div key={key++} style={{ height: 6 }} />)
    } else {
      flushList()
      elements.push(
        <p key={key++} style={{ margin: '2px 0', fontSize: 14, color: '#1C1917', lineHeight: 1.6 }}>
          {renderInline(line)}
        </p>
      )
    }
  }
  flushList()

  return (
    <div style={{
      background: '#FAFAF8',
      border: '1px solid #E3DDD5',
      borderRadius: 8,
      padding: '9px 12px',
      minHeight: 96,
    }}>
      {elements.length > 0
        ? elements
        : <span style={{ color: '#C4BDB5', fontSize: 14 }}>プレビューなし</span>}
    </div>
  )
}

export default function TaskDetailPanel({ task, subjects, onClose }: Props) {
  const { updateTask, deleteTask, deleteTasksFromRecurrence } = useStore()
  const [title, setTitle] = useState('')
  const [subjectId, setSubjectId] = useState('')
  const [startDate, setStartDate] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [dueTime, setDueTime] = useState('')
  const [status, setStatus] = useState<TaskStatus>('todo')
  const [memo, setMemo] = useState('')
  const [memoTab, setMemoTab] = useState<'edit' | 'preview'>('edit')
  const [saving, setSaving] = useState(false)
  const [showDeleteOptions, setShowDeleteOptions] = useState(false)

  useEffect(() => {
    if (task) {
      setTitle(task.title)
      setSubjectId(task.subject_id)
      setStartDate(task.start_date)
      setDueDate(task.due_date)
      setDueTime(task.due_time ?? '')
      setStatus(task.status)
      setMemo(task.memo ?? '')
      setMemoTab('edit')
      setShowDeleteOptions(false)
    }
  }, [task])

  if (!task) return null

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateTask(task.id, {
        title,
        subject_id: subjectId,
        start_date: startDate,
        due_date: dueDate,
        due_time: dueTime || null,
        status,
        memo,
      })
      onClose()
    } catch (e: unknown) {
      alert((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteThis = async () => {
    try { await deleteTask(task.id); onClose() }
    catch (e: unknown) { alert((e as Error).message) }
  }

  const handleDeleteFromHere = async () => {
    if (!task.recurrence_id) return
    try { await deleteTasksFromRecurrence(task.recurrence_id, task.start_date); onClose() }
    catch (e: unknown) { alert((e as Error).message) }
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
    transition: 'border-color 0.15s, box-shadow 0.15s',
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

  const onFocus = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    e.target.style.borderColor = '#3B63FF'
    e.target.style.boxShadow = '0 0 0 3px rgba(59,99,255,0.12)'
    e.target.style.background = '#FFFFFF'
  }
  const onBlur = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    e.target.style.borderColor = '#E3DDD5'
    e.target.style.boxShadow = 'none'
    e.target.style.background = '#FAFAF8'
  }

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(20,16,10,0.25)',
          backdropFilter: 'blur(2px)',
          WebkitBackdropFilter: 'blur(2px)',
          zIndex: 40,
        }}
        onClick={onClose}
      />

      {/* Panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 'min(420px, 100vw)',
        background: '#FFFFFF',
        borderLeft: '1px solid #E3DDD5',
        boxShadow: '-8px 0 40px rgba(20,16,10,0.1)',
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
      }}>

        {/* Header */}
        <div style={{
          padding: '18px 22px',
          borderBottom: '1px solid #EDE8DF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#FAFAF8',
          flexShrink: 0,
        }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#1C1917', margin: 0, letterSpacing: '-0.03em' }}>
            課題の詳細
          </h2>
          <button
            onClick={onClose}
            style={{
              background: '#EDE8DF', border: 'none', borderRadius: 6,
              width: 28, height: 28, cursor: 'pointer', color: '#78716C',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.12s', fontFamily: 'inherit',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#E3DDD5' }}
            onMouseLeave={e => { e.currentTarget.style.background = '#EDE8DF' }}
          >
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
              <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: 18, flex: 1 }}>

          {/* Title */}
          <div>
            <label style={labelStyle}>タイトル</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              style={inputStyle}
              onFocus={onFocus}
              onBlur={onBlur}
            />
          </div>

          {/* Subject */}
          <div>
            <label style={labelStyle}>科目</label>
            <select
              value={subjectId}
              onChange={e => setSubjectId(e.target.value)}
              style={{ ...inputStyle, cursor: 'pointer', appearance: 'auto' }}
              onFocus={onFocus}
              onBlur={onBlur}
            >
              {subjects.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Dates + Times */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>開始日</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
            </div>
            <div>
              <label style={labelStyle}>締切日</label>
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
            </div>
          </div>

          {/* Due time */}
          <div>
            <label style={labelStyle}>締切時刻（任意）</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input
                type="time"
                value={dueTime}
                onChange={e => setDueTime(e.target.value)}
                style={{ ...inputStyle, width: 'auto', flexShrink: 0 }}
                onFocus={onFocus}
                onBlur={onBlur}
              />
              {dueTime && (
                <button
                  type="button"
                  onClick={() => setDueTime('')}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 11, color: '#A8A29E', padding: 0, fontFamily: 'inherit',
                    letterSpacing: '-0.01em',
                  }}
                >
                  クリア
                </button>
              )}
            </div>
          </div>

          {/* Status */}
          <div>
            <label style={labelStyle}>ステータス</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {STATUS_ORDER.map(s => {
                const cfg = STATUS_CONFIG[s]
                const active = status === s
                return (
                  <button
                    key={s}
                    onClick={() => setStatus(s)}
                    style={{
                      background: active ? cfg.bg : '#FAFAF8',
                      color: active ? cfg.color : '#78716C',
                      border: `1.5px solid ${active ? cfg.color + '55' : '#E3DDD5'}`,
                      borderRadius: 9999,
                      padding: '5px 14px',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      letterSpacing: '-0.01em',
                      transition: 'all 0.12s',
                      fontFamily: 'inherit',
                      boxShadow: active ? `0 2px 8px ${cfg.color}22` : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                    }}
                    onMouseEnter={e => {
                      if (!active) {
                        e.currentTarget.style.background = cfg.bg
                        e.currentTarget.style.borderColor = cfg.color + '44'
                        e.currentTarget.style.color = cfg.color
                      }
                    }}
                    onMouseLeave={e => {
                      if (!active) {
                        e.currentTarget.style.background = '#FAFAF8'
                        e.currentTarget.style.borderColor = '#E3DDD5'
                        e.currentTarget.style.color = '#78716C'
                      }
                    }}
                  >
                    <div style={{
                      width: 6, height: 6, borderRadius: '50%',
                      background: cfg.color,
                      opacity: active ? 1 : 0.4,
                      flexShrink: 0,
                    }} />
                    {cfg.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Memo with Markdown preview */}
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>メモ</label>
              {/* Edit / Preview tabs */}
              <div style={{ display: 'inline-flex', background: '#F2EFE9', borderRadius: 8, padding: 2, gap: 2 }}>
                {(['edit', 'preview'] as const).map(tab => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setMemoTab(tab)}
                    style={{
                      background: memoTab === tab ? '#FFFFFF' : 'transparent',
                      border: 'none',
                      borderRadius: 6,
                      padding: '3px 10px',
                      fontSize: 11,
                      fontWeight: memoTab === tab ? 600 : 400,
                      cursor: 'pointer',
                      color: memoTab === tab ? '#1C1917' : '#78716C',
                      fontFamily: 'inherit',
                      boxShadow: memoTab === tab ? '0 1px 3px rgba(20,16,10,0.08)' : 'none',
                      transition: 'all 0.12s',
                    }}
                  >
                    {tab === 'edit' ? '編集' : 'プレビュー'}
                  </button>
                ))}
              </div>
              <span style={{ fontSize: 10, color: '#C4BDB5', letterSpacing: '-0.01em' }}>Markdown</span>
            </div>

            {memoTab === 'edit' ? (
              <textarea
                value={memo}
                onChange={e => setMemo(e.target.value)}
                rows={5}
                style={{
                  ...inputStyle,
                  resize: 'vertical',
                  lineHeight: 1.6,
                  minHeight: 96,
                  fontFamily: 'inherit',
                }}
                placeholder="メモを入力... (**太字** *斜体* - リスト [リンク](url) 使用可)"
                onFocus={onFocus}
                onBlur={onBlur}
              />
            ) : (
              <MarkdownPreview text={memo} />
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 22px',
          borderTop: '1px solid #EDE8DF',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          background: '#FAFAF8',
          flexShrink: 0,
        }}>
          {!showDeleteOptions ? (
            <button
              onClick={() => task.recurrence_id ? setShowDeleteOptions(true) : handleDeleteThis()}
              style={{
                background: 'transparent',
                color: '#DC2626',
                border: '1px solid rgba(220,38,38,0.25)',
                borderRadius: 8,
                padding: '9px 16px',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
                letterSpacing: '-0.01em',
                transition: 'all 0.12s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#FEF2F2' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            >
              削除
            </button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <p style={{ fontSize: 11, color: '#78716C', margin: 0, letterSpacing: '-0.01em', fontWeight: 600 }}>
                繰り返し課題の削除範囲:
              </p>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={handleDeleteThis}
                  style={{
                    flex: 1, background: '#FEF2F2', color: '#DC2626',
                    border: '1px solid rgba(220,38,38,0.25)', borderRadius: 8,
                    padding: '8px', fontSize: 12, fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  この課題のみ
                </button>
                <button
                  onClick={handleDeleteFromHere}
                  style={{
                    flex: 1, background: '#FEF2F2', color: '#DC2626',
                    border: '1px solid rgba(220,38,38,0.25)', borderRadius: 8,
                    padding: '8px', fontSize: 12, fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  以降すべて
                </button>
              </div>
              <button
                onClick={() => setShowDeleteOptions(false)}
                style={{
                  background: 'none', border: 'none', color: '#A8A29E',
                  fontSize: 12, cursor: 'pointer', padding: '2px 0',
                  fontFamily: 'inherit', letterSpacing: '-0.01em',
                }}
              >
                キャンセル
              </button>
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              background: saving ? '#A8A29E' : 'linear-gradient(135deg, #3B63FF 0%, #2D52E8 100%)',
              color: '#ffffff', border: 'none', borderRadius: 8,
              padding: '11px 16px', fontSize: 14, fontWeight: 600,
              cursor: saving ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s', letterSpacing: '-0.02em',
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
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </>
  )
}
