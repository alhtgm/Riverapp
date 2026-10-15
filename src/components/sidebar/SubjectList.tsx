import { useState } from 'react'
import { useStore } from '../../store/useStore'
import { useToast } from '../ui/Toast'
import { SEMESTER_OPTIONS, getSemesterHint, isInSemester } from '../../lib/semester'
import SectionTitle from './SectionTitle'

// AddTaskModal の科目追加と同じ自動カラー
const COLORS = ['#E16259', '#ef946c', '#16A34A', '#7C3AED', '#D97706', '#DB2777', '#0284C7', '#4F46E5']

export default function SubjectList() {
  const { subjects, tasks, semester, setSemester, selectedSubjectId, toggleSelectedSubject, addSubject } = useStore()
  const { showToast } = useToast()
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)

  const remainingCount = (subjectId: string) =>
    tasks.filter(t =>
      t.subject_id === subjectId &&
      t.status !== 'done' && t.status !== 'submitted' &&
      isInSemester(t, semester)
    ).length

  const handleAdd = async () => {
    const name = newName.trim()
    if (!name || saving) return
    setSaving(true)
    try {
      await addSubject(name, COLORS[subjects.length % COLORS.length])
      showToast(`科目「${name}」を追加しました`)
      setNewName('')
      setAdding(false)
    } catch (e: unknown) {
      showToast((e as Error).message, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section style={{ padding: '14px 14px 12px', flexShrink: 0 }}>
      {/* Semester selector */}
      <div
        role="radiogroup"
        aria-label="学期"
        style={{
          display: 'flex',
          background: 'var(--bg-secondary)',
          borderRadius: 8,
          padding: 2,
          marginBottom: 14,
        }}
      >
        {SEMESTER_OPTIONS.map(opt => {
          const active = semester === opt.key
          return (
            <button
              key={opt.key}
              role="radio"
              aria-checked={active}
              onClick={() => setSemester(opt.key)}
              title={getSemesterHint(opt.key) || undefined}
              style={{
                flex: 1,
                background: active ? 'var(--surface)' : 'transparent',
                color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                border: 'none',
                borderRadius: 6,
                padding: '5px 0',
                fontSize: 11,
                fontWeight: active ? 700 : 500,
                cursor: 'pointer',
                boxShadow: active ? 'var(--shadow-xs)' : 'none',
                fontFamily: 'inherit',
                transition: 'all 0.15s',
                lineHeight: 1.25,
              }}
            >
              {opt.label}
              {opt.key !== 'all' && (
                <span style={{ display: 'block', fontSize: 9, fontWeight: 400, color: 'var(--text-tertiary)' }}>
                  {getSemesterHint(opt.key)}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <SectionTitle>科目</SectionTitle>

      {subjects.length === 0 && (
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', padding: '4px 2px 8px' }}>
          科目がありません
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {subjects.map(subject => {
          const active = selectedSubjectId === subject.id
          const count = remainingCount(subject.id)
          return (
            <button
              key={subject.id}
              onClick={() => toggleSelectedSubject(subject.id)}
              aria-pressed={active}
              title={active ? '絞り込みを解除' : `「${subject.name}」で絞り込む`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                background: active ? 'var(--accent-bg)' : 'transparent',
                border: `1px solid ${active ? 'var(--accent)' : 'transparent'}`,
                borderRadius: 7,
                padding: '6px 8px',
                cursor: 'pointer',
                textAlign: 'left',
                fontFamily: 'inherit',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--bg-secondary)' }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
            >
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: subject.color, flexShrink: 0 }} />
              <span style={{
                flex: 1,
                minWidth: 0,
                fontSize: 13,
                fontWeight: active ? 700 : 500,
                color: 'var(--text-primary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {subject.name}
              </span>
              <span
                aria-label={`残り${count}件`}
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  minWidth: 20,
                  textAlign: 'center',
                  padding: '1px 6px',
                  borderRadius: 9999,
                  background: count > 0 ? 'var(--bg-secondary)' : 'transparent',
                  color: count > 0 ? 'var(--text-secondary)' : 'var(--text-disabled)',
                  flexShrink: 0,
                }}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Add subject */}
      {adding ? (
        <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
          <input
            autoFocus
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); handleAdd() }
              if (e.key === 'Escape') { e.stopPropagation(); setAdding(false); setNewName('') }
            }}
            placeholder="科目名"
            aria-label="新しい科目名"
            style={{
              flex: 1,
              minWidth: 0,
              fontSize: 12,
              padding: '6px 8px',
              border: '1px solid var(--border)',
              borderRadius: 6,
              background: 'var(--bg)',
              color: 'var(--text-primary)',
              fontFamily: 'inherit',
            }}
          />
          <button
            onClick={handleAdd}
            disabled={!newName.trim() || saving}
            style={{
              fontSize: 12,
              fontWeight: 600,
              padding: '0 10px',
              border: 'none',
              borderRadius: 6,
              background: 'var(--accent)',
              color: '#ffffff',
              cursor: newName.trim() && !saving ? 'pointer' : 'default',
              opacity: newName.trim() && !saving ? 1 : 0.5,
              fontFamily: 'inherit',
              flexShrink: 0,
            }}
          >
            追加
          </button>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            width: '100%',
            marginTop: 6,
            padding: '6px 8px',
            background: 'transparent',
            border: '1px dashed var(--border)',
            borderRadius: 7,
            fontSize: 12,
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            fontFamily: 'inherit',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
        >
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
            <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          科目を追加
        </button>
      )}
    </section>
  )
}
