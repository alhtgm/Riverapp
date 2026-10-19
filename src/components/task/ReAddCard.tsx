import type { Subject } from '../../types'
import { formatDate, parseLocalDate } from '../../types'
import { IconButton } from '../ui/m3'

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

const type = (role: string): React.CSSProperties => ({
  fontSize: `var(--type-${role}-size)`,
  lineHeight: `var(--type-${role}-line)`,
  fontWeight: `var(--type-${role}-weight)`,
  letterSpacing: `var(--type-${role}-tracking)`,
})

/**
 * 課題の完了/期限切れ時に画面右下へ出す「次の課題を追加しますか？」カード。
 * 右下の FAB の場所に出る（M3: 角 16px・影 Level 3）。
 */
export default function ReAddCard({ subject, templates, onAdd, onClose }: Props) {
  return (
    <div
      role="dialog"
      aria-label={`${subject.name}の課題を追加`}
      style={{
        position: 'fixed',
        bottom: 'calc(var(--space-4) + env(safe-area-inset-bottom))',
        right: 'var(--space-4)',
        width: 360,
        maxWidth: 'calc(100vw - 32px)',
        background: 'var(--surface)',
        borderRadius: 'var(--shape-lg)',
        boxShadow: 'var(--elevation-3)',
        zIndex: 140,
        overflow: 'hidden',
        animation: 'm3-snackbar-in var(--motion-duration-medium4) var(--motion-easing-emphasized-decelerate)',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-3)',
        padding: 'var(--space-2) var(--space-2) var(--space-2) var(--space-4)',
        borderBottom: '1px solid var(--border)',
      }}>
        <span aria-hidden="true" style={{ width: 12, height: 12, borderRadius: 'var(--shape-full)', background: subject.color, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0, ...type('title-small'), color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {subject.name}
        </div>
        <IconButton label="閉じる" onClick={onClose}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
        </IconButton>
      </div>

      {/* Prompt */}
      <div style={{ padding: 'var(--space-3) var(--space-4) var(--space-2)' }}>
        <div style={{ ...type('title-medium'), color: 'var(--text-primary)' }}>
          次の課題を追加しますか？
        </div>
        <div style={{ ...type('body-small'), color: 'var(--text-secondary)', marginTop: 'var(--space-1)' }}>
          項目を押すと、翌週の同じ曜日で追加します
        </div>
      </div>

      {/* Template list */}
      <div style={{ padding: 'var(--space-2) var(--space-3) var(--space-3)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', maxHeight: 280, overflowY: 'auto' }}>
        {templates.map(t => (
          <button
            key={t.key}
            type="button"
            className="m3-state"
            onClick={() => onAdd(t)}
            style={{
              display: 'flex', alignItems: 'center', gap: 'var(--space-3)', width: '100%', textAlign: 'left', minHeight: 56,
              background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--shape-md)',
              padding: 'var(--space-2) var(--space-2) var(--space-2) var(--space-4)', cursor: 'pointer', color: 'var(--text-primary)',
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ ...type('body-large'), fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {t.title}
              </div>
              <div style={{ ...type('body-small'), color: 'var(--text-secondary)' }}>
                次回 {formatDate(t.nextDue)}（{WEEK_JA[parseLocalDate(t.nextDue).getDay()]}）{t.dueTime ? ` ${t.dueTime}` : ''}
              </div>
            </div>
            <span aria-hidden="true" style={{
              width: 40, height: 40, borderRadius: 'var(--shape-full)', background: 'var(--accent-solid)', color: 'var(--on-accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
