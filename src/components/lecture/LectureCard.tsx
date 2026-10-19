import type { ReactNode } from 'react'
import { TERM_LABEL, VISIBILITY_LABEL, type LectureSummary, type LectureVisibility } from '../../types'
import '../ui/m3.css'

/** 文字の役割（tokens.css の M3 type scale）をインラインスタイルで使う */
const type = (role: string): React.CSSProperties => ({
  fontSize: `var(--type-${role}-size)`,
  lineHeight: `var(--type-${role}-line)`,
  fontWeight: `var(--type-${role}-weight)`,
  letterSpacing: `var(--type-${role}-tracking)`,
})

const VISIBILITY_STYLE: Record<LectureVisibility, { fg: string; bg: string; icon: ReactNode }> = {
  private: {
    fg: 'var(--text-secondary)',
    bg: 'var(--bg-secondary)',
    icon: (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <rect x="3" y="7" width="10" height="7" rx="1.6" stroke="currentColor" strokeWidth="1.6" />
        <path d="M5.5 7V5a2.5 2.5 0 015 0v2" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    ),
  },
  party: {
    fg: 'var(--share)',
    bg: 'var(--share-bg)',
    icon: (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M8 2.2l1.7 3.4 3.8.5-2.7 2.7.6 3.8L8 10.8l-3.4 1.8.6-3.8L2.5 6.1l3.8-.5L8 2.2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    ),
  },
  friends: {
    fg: 'var(--st-progress)',
    bg: 'var(--st-progress-bg)',
    icon: (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <circle cx="6" cy="5.5" r="2.3" stroke="currentColor" strokeWidth="1.6" />
        <path d="M1.8 13c.4-2.3 2.2-3.6 4.2-3.6s3.8 1.3 4.2 3.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="11.5" cy="6.2" r="1.8" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
  },
  public: {
    fg: 'var(--public)',
    bg: 'var(--public-bg)',
    icon: (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
        <path d="M2 8h12M8 2c1.8 1.7 2.6 3.7 2.6 6S9.8 12.3 8 14c-1.8-1.7-2.6-3.7-2.6-6S6.2 3.7 8 2z" stroke="currentColor" strokeWidth="1.3" />
      </svg>
    ),
  },
}

function Pill({ fg, bg, children }: { fg: string; bg: string; children: ReactNode }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)', padding: '2px var(--space-2)', borderRadius: 'var(--shape-xs)',
      ...type('label-medium'), color: fg, background: bg, whiteSpace: 'nowrap',
    }}>
      {children}
    </span>
  )
}

/** 数値と見出しを縦に並べた小さな統計 */
function Stat({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
      <span style={{ ...type('label-small'), color: 'var(--text-secondary)' }}>{label}</span>
      <span style={{ ...type('title-small'), color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{value}</span>
    </div>
  )
}

interface Props {
  lecture: LectureSummary
  /** 右上に置くボタン（参加ボタンなど） */
  action?: ReactNode
  /** カード下部の開閉トグル。未指定なら出さない */
  expanded?: boolean
  onToggle?: () => void
  children?: ReactNode
}

/**
 * 講義カード。
 *   上段: 講義名 ＋ 右に操作ボタン
 *   中段: 年度・学期のピル ＋ 担当教員
 *   下段: 参加人数 / 公開範囲 / 参加申請 を区切り線で分けて表示
 */
export default function LectureCard({ lecture: l, action, expanded, onToggle, children }: Props) {
  const vis = VISIBILITY_STYLE[l.visibility]
  return (
    <div style={{
      border: '1px solid var(--border)', borderRadius: 'var(--shape-md)', background: 'var(--surface)',
      overflow: 'hidden',
    }}>
      <div style={{ padding: 'var(--space-3) var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)' }}>
          <div style={{
            flex: 1, minWidth: 0, ...type('title-medium'), fontWeight: 'var(--type-weight-emphasized)',
            color: 'var(--text-primary)', wordBreak: 'break-word',
          }}>
            {l.title}
          </div>
          {action}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          <Pill fg="var(--accent-dark)" bg="var(--accent-bg)">{l.year}年度・{TERM_LABEL[l.term]}</Pill>
          {l.professor && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)', ...type('body-small'), color: 'var(--text-secondary)' }}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <circle cx="8" cy="5" r="2.6" stroke="currentColor" strokeWidth="1.5" />
                <path d="M3 14c.5-2.8 2.5-4.3 5-4.3s4.5 1.5 5 4.3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              {l.professor}
            </span>
          )}
        </div>
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
        borderTop: '1px solid var(--border)', background: 'var(--surface-warm)',
      }}>
        <div style={{ padding: 'var(--space-2) var(--space-4)' }}>
          <Stat
            label="参加"
            value={
              <>
                {l.participant_count}人
                {l.party_member_count !== null && (
                  <span style={{ ...type('body-small'), color: 'var(--text-secondary)', marginLeft: 'var(--space-1)' }}>
                    メンバー{l.party_member_count}
                  </span>
                )}
              </>
            }
          />
        </div>
        <div style={{ padding: 'var(--space-2) var(--space-4)', borderLeft: '1px solid var(--border)' }}>
          <Stat label="公開範囲" value={<Pill fg={vis.fg} bg={vis.bg}>{vis.icon}{VISIBILITY_LABEL[l.visibility]}</Pill>} />
        </div>
        <div style={{ padding: 'var(--space-2) var(--space-4)', borderLeft: '1px solid var(--border)' }}>
          <Stat
            label="参加申請"
            value={
              <span style={{ color: l.apply_open ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
                {l.apply_open ? '承認制' : '不要'}
              </span>
            }
          />
        </div>
      </div>

      {onToggle && (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          className="m3-state"
          style={{
            width: '100%', minHeight: 48, padding: '0 var(--space-4)', border: 'none', borderTop: '1px solid var(--border)',
            background: 'var(--surface)', cursor: 'pointer', ...type('label-large'),
            color: 'var(--accent-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)',
          }}
        >
          {expanded ? '課題を閉じる' : '課題と進捗を見る'}
          <svg width="14" height="14" viewBox="0 0 10 10" fill="none" aria-hidden="true" style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform var(--motion-duration-short4) var(--motion-easing-standard)' }}>
            <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
      {expanded && children && (
        <div style={{ borderTop: '1px solid var(--border)', padding: 'var(--space-3) var(--space-4) var(--space-4)', background: 'var(--surface)' }}>
          {children}
        </div>
      )}
    </div>
  )
}
