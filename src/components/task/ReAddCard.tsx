import type { Subject } from '../../types'
import { formatDate, parseLocalDate } from '../../types'

const WEEK_JA = ['日', '月', '火', '水', '木', '金', '土']

export interface ReAddTemplate {
  /** 元課題のid（リストのkey兼用） */
  key: string
  title: string
  dueTime: string | null
  /** 再追加時の締切日（翌週の同じ曜日） YYYY-MM-DD */
  nextDue: string
}

interface Props {
  subject: Subject
  templates: ReAddTemplate[]
  /** 項目タップ = ワンタップ即追加 */
  onAdd: (t: ReAddTemplate) => void
  onClose: () => void
}

/** 課題の完了/期限切れ時に画面右下へ出す「次の課題を追加しますか？」カード */
export default function ReAddCard({ subject, templates, onAdd, onClose }: Props) {
  return (
    <>
      <style>{`@keyframes reAddIn { from { opacity: 0; transform: translateY(16px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }`}</style>
      <div
        role="dialog"
        aria-label={`${subject.name}の課題を追加`}
        style={{
          position: 'fixed',
          bottom: 20,
          right: 20,
          width: 340,
          maxWidth: 'calc(100vw - 32px)',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          boxShadow: 'var(--shadow-xl)',
          zIndex: 140,
          overflow: 'hidden',
          animation: 'reAddIn 0.3s cubic-bezier(0.16,1,0.3,1)',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '14px 16px',
          borderBottom: '1px solid var(--border-light)',
          background: 'var(--surface-warm)',
        }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: subject.color, flexShrink: 0, boxShadow: `0 0 0 3px ${subject.color}22` }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {subject.name}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="閉じる"
            style={{
              background: 'var(--bg-secondary)', border: 'none', borderRadius: 7,
              width: 28, height: 28, cursor: 'pointer', color: 'var(--text-secondary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              transition: 'background 0.12s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--border)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-secondary)' }}
          >
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
          </button>
        </div>

        {/* Prompt */}
        <div style={{ padding: '13px 16px 6px' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            次の課題を追加しますか？
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 3, letterSpacing: '-0.01em', lineHeight: 1.5 }}>
            項目を押すと、翌週の同じ曜日で追加します
          </div>
        </div>

        {/* Template list */}
        <div style={{ padding: '6px 10px 12px', display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 264, overflowY: 'auto' }}>
          {templates.map(t => (
            <button
              key={t.key}
              onClick={() => onAdd(t)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
                background: 'transparent', border: '1px solid var(--border-light)', borderRadius: 10,
                padding: '10px 11px', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-bg)'; e.currentTarget.style.borderColor = 'rgba(239,148,108,0.35)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--border-light)' }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: '-0.01em' }}>
                  {t.title}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2, letterSpacing: '-0.01em' }}>
                  次回 {formatDate(t.nextDue)}（{WEEK_JA[parseLocalDate(t.nextDue).getDay()]}）{t.dueTime ? ` ${t.dueTime}` : ''}
                </div>
              </div>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 2px 6px rgba(239,148,108,0.4)' }}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1v10M1 6h10" stroke="#fff" strokeWidth="2" strokeLinecap="round"/></svg>
              </div>
            </button>
          ))}
        </div>
      </div>
    </>
  )
}
