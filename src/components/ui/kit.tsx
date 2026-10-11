/**
 * River UI キット — 「分かりやすさ」を最優先にした共通部品。
 * 使い方のルールは docs/ui-template.md を参照。
 *
 *   Section    見出し＋一言の説明＋右上の操作。画面はこれを縦に並べて組み立てる
 *   SectionHeader  Section の見出しだけ（既存フォームの区切り用）
 *   Card       中身をまとめる箱
 *   ListItem   アイコン・名前・補足・右端の操作が並ぶ1行
 *   Field      ラベル・入力欄・補足・エラーのセット
 *   Button     primary は1つのまとまりに1つだけ
 *   Tabs       画面内の切り替え（バッジ付き）
 *   Badge      状態や件数の小さなラベル
 *   Notice     注意書き・お知らせの帯
 *   EmptyState 何もないときに「次にやること」を示す
 *   Confirm    取り消せない操作の前の確認（どの画面でも同じ見た目）
 *   Avatar     名前の頭文字アイコン
 */
import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react'

// ---------------------------------------------------------------
// Section
// ---------------------------------------------------------------
export function Section({ title, description, action, children, count }: {
  title: string
  /** 何をする場所かを一言で */
  description?: ReactNode
  /** 見出しの右側に置く操作（追加ボタンなど） */
  action?: ReactNode
  /** 件数（見出しの横に小さく表示） */
  count?: number
  children: ReactNode
}) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em', display: 'flex', alignItems: 'center', gap: 6 }}>
            {title}
            {count !== undefined && (
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)' }}>{count}</span>
            )}
          </h3>
          {description && (
            <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>{description}</p>
          )}
        </div>
        {action && <div style={{ flexShrink: 0, display: 'flex', gap: 6 }}>{action}</div>}
      </div>
      {children}
    </section>
  )
}

/** Section の見出し部分だけを使いたいとき（既存フォームの途中に区切りを入れるなど） */
export function SectionHeader({ title, description }: { title: string; description?: ReactNode }) {
  return (
    <div style={{ paddingBottom: 8, borderBottom: '1px solid var(--border-light)' }}>
      <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>{title}</h3>
      {description && <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>{description}</p>}
    </div>
  )
}

// ---------------------------------------------------------------
// Card
// ---------------------------------------------------------------
export function Card({ children, padding = 14, tone = 'default', style }: {
  children: ReactNode
  padding?: number
  tone?: 'default' | 'muted' | 'accent'
  style?: CSSProperties
}) {
  const bg = tone === 'muted' ? 'var(--surface-warm)' : tone === 'accent' ? 'var(--accent-bg)' : 'var(--surface)'
  const border = tone === 'accent' ? 'var(--accent-muted)' : 'var(--border-light)'
  return (
    <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: 12, padding, boxShadow: tone === 'default' ? 'var(--shadow-xs)' : 'none', ...style }}>
      {children}
    </div>
  )
}

// ---------------------------------------------------------------
// ListItem
// ---------------------------------------------------------------
export function ListItem({ leading, title, subtitle, trailing, onClick, highlight = false }: {
  leading?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  trailing?: ReactNode
  /** 行全体を押せるようにする（右端の操作とは別） */
  onClick?: () => void
  highlight?: boolean
}) {
  const body = (
    <>
      {leading && <span style={{ flexShrink: 0, display: 'flex' }}>{leading}</span>}
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
        {subtitle && <span style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.45 }}>{subtitle}</span>}
      </span>
    </>
  )
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, minHeight: 52, padding: '8px 12px',
      border: `1px solid ${highlight ? 'var(--accent-muted)' : 'var(--border-light)'}`, borderRadius: 12,
      background: highlight ? 'var(--accent-bg)' : 'var(--surface)',
    }}>
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 12, background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', color: 'inherit' }}
        >
          {body}
        </button>
      ) : body}
      {trailing && <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}>{trailing}</span>}
    </div>
  )
}

/** ListItem を縦に並べる */
export function List({ children }: { children: ReactNode }) {
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{children}</div>
}

// ---------------------------------------------------------------
// Field
// ---------------------------------------------------------------
export function Field({ label, help, error, required, children, group = false }: {
  label: string
  help?: ReactNode
  error?: string | null
  required?: boolean
  children: ReactNode
  /** 中身がボタンなどを含む複合部品のときは true（label で包むと余白クリックでボタンが押されるため） */
  group?: boolean
}) {
  const Wrapper = group ? 'div' : 'label'
  return (
    <Wrapper style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
        {label}
        {required
          ? <span style={{ fontSize: 10, color: 'var(--accent-dark)', fontWeight: 700 }}>必須</span>
          : <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 500 }}>任意</span>}
      </span>
      {children}
      {error
        ? <span style={{ fontSize: 12, color: 'var(--danger)', fontWeight: 600 }}>{error}</span>
        : help && <span style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>{help}</span>}
    </Wrapper>
  )
}

// ---------------------------------------------------------------
// Button
// ---------------------------------------------------------------
type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'

const BUTTON_COLORS: Record<ButtonVariant, CSSProperties> = {
  primary: { background: 'var(--accent)', color: '#fff', border: '1px solid var(--accent)' },
  secondary: { background: 'var(--surface)', color: 'var(--text-primary)', border: '1px solid var(--border)' },
  danger: { background: 'var(--danger-bg)', color: 'var(--danger)', border: '1px solid rgba(220,38,38,0.3)' },
  ghost: { background: 'transparent', color: 'var(--text-secondary)', border: '1px solid transparent' },
}

export function Button({ variant = 'secondary', size = 'md', loading = false, icon, children, style, disabled, ...rest }: {
  variant?: ButtonVariant
  size?: 'sm' | 'md'
  loading?: boolean
  icon?: ReactNode
  children?: ReactNode
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const sm = size === 'sm'
  return (
    <button
      type="button"
      disabled={disabled || loading}
      {...rest}
      style={{
        ...BUTTON_COLORS[variant],
        minHeight: sm ? 30 : 38, padding: sm ? '0 11px' : '0 16px', borderRadius: sm ? 8 : 10,
        fontSize: sm ? 12 : 13, fontWeight: 700, fontFamily: 'inherit', letterSpacing: '-0.01em',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        whiteSpace: 'nowrap', flexShrink: 0, cursor: disabled || loading ? 'not-allowed' : 'pointer',
        opacity: disabled || loading ? 0.55 : 1, transition: 'filter 0.15s, background 0.15s',
        ...style,
      }}
      onMouseEnter={e => { if (!disabled && !loading) e.currentTarget.style.filter = 'brightness(0.96)' }}
      onMouseLeave={e => { e.currentTarget.style.filter = 'none' }}
    >
      {icon}
      {loading ? '処理中...' : children}
    </button>
  )
}

// ---------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------
export function Tabs<K extends string>({ tabs, value, onChange }: {
  tabs: { key: K; label: string; badge?: number }[]
  value: K
  onChange: (key: K) => void
}) {
  return (
    <div role="tablist" style={{ display: 'flex', gap: 4, background: 'var(--bg-secondary)', borderRadius: 12, padding: 4, overflowX: 'auto' }}>
      {tabs.map(t => {
        const active = t.key === value
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.key)}
            style={{
              flex: 1, minHeight: 36, border: 'none', borderRadius: 9, padding: '0 12px',
              fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
              background: active ? 'var(--surface)' : 'transparent',
              color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
              boxShadow: active ? 'var(--shadow-xs)' : 'none',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            {t.label}
            {!!t.badge && <Badge tone="accent" solid>{t.badge}</Badge>}
          </button>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------
// Badge
// ---------------------------------------------------------------
type Tone = 'neutral' | 'accent' | 'success' | 'info' | 'danger' | 'purple'

const TONES: Record<Tone, { fg: string; bg: string }> = {
  neutral: { fg: 'var(--text-secondary)', bg: 'var(--bg-secondary)' },
  accent: { fg: 'var(--accent-dark)', bg: 'var(--accent-bg)' },
  success: { fg: '#14913F', bg: 'rgba(22,163,74,0.12)' },
  info: { fg: '#0779A0', bg: 'rgba(8,145,178,0.12)' },
  danger: { fg: 'var(--danger)', bg: 'var(--danger-bg)' },
  purple: { fg: '#7233DE', bg: 'rgba(124,58,237,0.12)' },
}

export function Badge({ tone = 'neutral', solid = false, children }: { tone?: Tone; solid?: boolean; children: ReactNode }) {
  const c = TONES[tone]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, padding: solid ? '0 6px' : '2px 8px', minHeight: solid ? 18 : undefined,
      borderRadius: 9999, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
      color: solid ? '#fff' : c.fg, background: solid ? (tone === 'accent' ? 'var(--accent)' : c.fg) : c.bg,
    }}>
      {children}
    </span>
  )
}

// ---------------------------------------------------------------
// Notice
// ---------------------------------------------------------------
export function Notice({ tone = 'info', children }: { tone?: 'info' | 'warning' | 'danger'; children: ReactNode }) {
  const c = tone === 'danger' ? TONES.danger : tone === 'warning' ? TONES.accent : TONES.info
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 10, background: c.bg, color: c.fg, fontSize: 12, lineHeight: 1.6, fontWeight: 500 }}>
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true">
        <circle cx="8" cy="8" r="6.3" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 7.2v4M8 4.8v.1" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  )
}

// ---------------------------------------------------------------
// EmptyState
// ---------------------------------------------------------------
export function EmptyState({ title, description, action, compact = false }: {
  title: string
  /** 次に何をすればよいか */
  description?: ReactNode
  action?: ReactNode
  compact?: boolean
}) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 6,
      padding: compact ? '14px 12px' : '24px 16px', border: '1px dashed var(--border)', borderRadius: 12,
      background: 'var(--surface-warm)',
    }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>{title}</span>
      {description && <span style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.6, maxWidth: 420 }}>{description}</span>}
      {action && <div style={{ marginTop: 6 }}>{action}</div>}
    </div>
  )
}

// ---------------------------------------------------------------
// Confirm
// ---------------------------------------------------------------
export function Confirm({ message, detail, confirmLabel, onConfirm, onCancel, busy = false, tone = 'danger' }: {
  message: string
  /** 押すとどうなるかの補足 */
  detail?: ReactNode
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
  busy?: boolean
  tone?: 'danger' | 'primary'
}) {
  return (
    <div role="alertdialog" style={{
      display: 'flex', flexDirection: 'column', gap: 8, padding: 12, borderRadius: 12,
      border: `1px solid ${tone === 'danger' ? 'rgba(220,38,38,0.3)' : 'var(--accent-muted)'}`,
      background: tone === 'danger' ? 'var(--danger-bg)' : 'var(--accent-bg)',
    }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{message}</span>
      {detail && <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{detail}</span>}
      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <Button variant="ghost" size="sm" onClick={onCancel}>やめる</Button>
        <Button variant={tone === 'danger' ? 'danger' : 'primary'} size="sm" loading={busy} onClick={onConfirm}>{confirmLabel}</Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------
// Avatar
// ---------------------------------------------------------------
export function Avatar({ name, size = 28 }: { name: string | null; size?: number }) {
  const ch = (name ?? '?').trim().charAt(0) || '?'
  let hash = 0
  for (const c of name ?? '?') hash = (hash * 31 + c.charCodeAt(0)) % 360
  return (
    <span
      title={name ?? undefined}
      style={{
        width: size, height: size, borderRadius: '50%', flexShrink: 0,
        background: `hsl(${hash} 55% 88%)`, color: `hsl(${hash} 45% 32%)`,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontSize: Math.round(size * 0.46), fontWeight: 700, border: '2px solid var(--surface)',
      }}
    >
      {ch}
    </span>
  )
}
