/**
 * River UI キット — 「分かりやすさ」を最優先にした共通部品。
 * 使い方のルールは docs/ui-template.md を参照。
 * 見た目は Material Design 3 に合わせてある（数値は src/theme/tokens.css、ボタンは m3.tsx）。
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
import { Button as M3Button, type ButtonVariant as M3Variant } from './m3'

/** 文字の役割（tokens.css の M3 type scale）をインラインスタイルで使う */
const type = (role: string, weight?: string): CSSProperties => ({
  fontSize: `var(--type-${role}-size)`,
  lineHeight: `var(--type-${role}-line)`,
  fontWeight: weight ?? `var(--type-${role}-weight)`,
  letterSpacing: `var(--type-${role}-tracking)`,
})

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
    <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--space-3)' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ margin: 0, ...type('title-medium', 'var(--type-weight-emphasized)'), color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            {title}
            {count !== undefined && (
              <span style={{ ...type('label-large'), color: 'var(--text-tertiary)' }}>{count}</span>
            )}
          </h3>
          {description && (
            <p style={{ margin: 'var(--space-1) 0 0', ...type('body-medium'), color: 'var(--text-secondary)' }}>{description}</p>
          )}
        </div>
        {action && <div style={{ flexShrink: 0, display: 'flex', gap: 'var(--space-2)' }}>{action}</div>}
      </div>
      {children}
    </section>
  )
}

/** Section の見出し部分だけを使いたいとき（既存フォームの途中に区切りを入れるなど） */
export function SectionHeader({ title, description }: { title: string; description?: ReactNode }) {
  return (
    <div style={{ paddingBottom: 'var(--space-2)', borderBottom: '1px solid var(--border)' }}>
      <h3 style={{ margin: 0, ...type('title-medium', 'var(--type-weight-emphasized)'), color: 'var(--text-primary)' }}>{title}</h3>
      {description && <p style={{ margin: 'var(--space-1) 0 0', ...type('body-medium'), color: 'var(--text-secondary)' }}>{description}</p>}
    </div>
  )
}

// ---------------------------------------------------------------
// Card（M3: default = outlined / muted = filled / accent = 強調の filled）
// ---------------------------------------------------------------
export function Card({ children, padding = 16, tone = 'default', style }: {
  children: ReactNode
  padding?: number
  tone?: 'default' | 'muted' | 'accent'
  style?: CSSProperties
}) {
  const bg = tone === 'muted' ? 'var(--bg-secondary)' : tone === 'accent' ? 'var(--accent-bg)' : 'var(--surface)'
  return (
    <div style={{
      background: bg, border: tone === 'default' ? '1px solid var(--border)' : '1px solid transparent',
      borderRadius: 'var(--shape-md)', padding, ...style,
    }}>
      {children}
    </div>
  )
}

// ---------------------------------------------------------------
// ListItem（M3 の list item: 見出し body-large・補足 body-medium・高さ 56px 以上）
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
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <span style={{ ...type('body-large', '500'), color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
        {subtitle && <span style={{ ...type('body-medium'), color: 'var(--text-secondary)' }}>{subtitle}</span>}
      </span>
    </>
  )
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 'var(--space-3)', minHeight: 56,
      padding: onClick ? '0 var(--space-3) 0 0' : 'var(--space-2) var(--space-3) var(--space-2) var(--space-4)',
      border: `1px solid ${highlight ? 'transparent' : 'var(--border)'}`, borderRadius: 'var(--shape-md)',
      background: highlight ? 'var(--accent-bg)' : 'var(--surface)', overflow: 'hidden',
    }}>
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          className="m3-state"
          style={{
            flex: 1, minWidth: 0, alignSelf: 'stretch', display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
            background: 'none', border: 'none', padding: 'var(--space-2) 0 var(--space-2) var(--space-4)',
            cursor: 'pointer', textAlign: 'left', color: 'inherit', borderRadius: 'var(--shape-md)',
          }}
        >
          {body}
        </button>
      ) : body}
      {trailing && <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>{trailing}</span>}
    </div>
  )
}

/** ListItem を縦に並べる */
export function List({ children }: { children: ReactNode }) {
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>{children}</div>
}

// ---------------------------------------------------------------
// Field
// ---------------------------------------------------------------
export function Field({ label, help, error, required, readOnly = false, children, group = false }: {
  label: string
  help?: ReactNode
  error?: string | null
  required?: boolean
  /** 表示するだけで入力しない欄。「必須」「任意」を出さない */
  readOnly?: boolean
  children: ReactNode
  /** 中身がボタンなどを含む複合部品のときは true（label で包むと余白クリックでボタンが押されるため） */
  group?: boolean
}) {
  const Wrapper = group ? 'div' : 'label'
  return (
    <Wrapper style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
      <span style={{ ...type('label-large'), color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
        {label}
        {readOnly ? null : required
          ? <span style={{ ...type('label-small'), color: 'var(--accent-dark)' }}>必須</span>
          : <span style={{ ...type('label-small'), color: 'var(--text-tertiary)' }}>任意</span>}
      </span>
      {children}
      {error
        ? <span role="alert" style={{ ...type('body-small'), color: 'var(--danger)', padding: '0 var(--space-4)' }}>{error}</span>
        : help && <span style={{ ...type('body-small'), color: 'var(--text-secondary)', padding: '0 var(--space-4)' }}>{help}</span>}
    </Wrapper>
  )
}

// ---------------------------------------------------------------
// Button（中身は M3 のボタン。primary → filled / secondary → outlined / danger → 赤い tonal / ghost → text）
// ---------------------------------------------------------------
type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'

const M3_VARIANT: Record<ButtonVariant, M3Variant> = {
  primary: 'filled',
  secondary: 'outlined',
  danger: 'tonal',
  ghost: 'text',
}

export function Button({ variant = 'secondary', size = 'md', ...rest }: {
  variant?: ButtonVariant
  /** md = 高さ 40px、sm = 32px（押せる範囲はどちらも 48px） */
  size?: 'sm' | 'md'
  loading?: boolean
  icon?: ReactNode
  children?: ReactNode
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return <M3Button variant={M3_VARIANT[variant]} danger={variant === 'danger'} size={size === 'sm' ? 'xs' : 'sm'} {...rest} />
}

// ---------------------------------------------------------------
// Tabs（M3 の primary tabs: 高さ 48px・選択中は下に線）
// ---------------------------------------------------------------
export function Tabs<K extends string>({ tabs, value, onChange }: {
  tabs: { key: K; label: string; badge?: number }[]
  value: K
  onChange: (key: K) => void
}) {
  return (
    <div role="tablist" style={{ display: 'flex', borderBottom: '1px solid var(--border)', overflowX: 'auto', flexShrink: 0 }}>
      {tabs.map(t => {
        const active = t.key === value
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.key)}
            className="m3-state"
            style={{
              flex: 1, minHeight: 48, border: 'none', padding: '0 var(--space-4)', background: 'transparent',
              ...type('title-small'), cursor: 'pointer', whiteSpace: 'nowrap',
              color: active ? 'var(--accent-dark)' : 'var(--text-secondary)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)',
              boxShadow: active ? 'inset 0 -3px 0 var(--accent-solid)' : 'none',
              transition: 'color var(--motion-duration-short4) var(--motion-easing-standard), box-shadow var(--motion-duration-short4) var(--motion-easing-standard)',
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
// Badge（状態のラベルは角 4px の小さいタグ、solid は M3 の件数バッジ）
// ---------------------------------------------------------------
type Tone = 'neutral' | 'accent' | 'success' | 'info' | 'danger' | 'purple'

const TONES: Record<Tone, { fg: string; bg: string }> = {
  neutral: { fg: 'var(--text-secondary)', bg: 'var(--bg-secondary)' },
  accent: { fg: 'var(--accent-dark)', bg: 'var(--accent-bg)' },
  success: { fg: 'var(--st-done)', bg: 'var(--st-done-bg)' },
  info: { fg: 'var(--st-progress)', bg: 'var(--st-progress-bg)' },
  danger: { fg: 'var(--danger)', bg: 'var(--danger-bg)' },
  purple: { fg: 'var(--st-submitted)', bg: 'var(--st-submitted-bg)' },
}

export function Badge({ tone = 'neutral', solid = false, children }: { tone?: Tone; solid?: boolean; children: ReactNode }) {
  const c = TONES[tone]
  if (solid) {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 16, height: 16, padding: '0 var(--space-1)',
        borderRadius: 'var(--shape-full)', ...type('label-small'), lineHeight: '16px', whiteSpace: 'nowrap',
        color: tone === 'accent' ? 'var(--on-accent)' : 'var(--surface)', background: tone === 'accent' ? 'var(--accent-solid)' : c.fg,
      }}>
        {children}
      </span>
    )
  }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)', padding: '2px var(--space-2)',
      borderRadius: 'var(--shape-xs)', ...type('label-medium'), whiteSpace: 'nowrap', color: c.fg, background: c.bg,
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
    <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start', padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--shape-md)', background: c.bg, color: c.fg, ...type('body-medium') }}>
      <svg width="18" height="18" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: 1 }} aria-hidden="true">
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
      display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 'var(--space-1)',
      padding: compact ? 'var(--space-4)' : 'var(--space-6) var(--space-4)', border: '1px dashed var(--border)', borderRadius: 'var(--shape-md)',
      background: 'var(--surface-warm)',
    }}>
      <span style={{ ...type('title-small'), color: 'var(--text-secondary)' }}>{title}</span>
      {description && <span style={{ ...type('body-medium'), color: 'var(--text-secondary)', maxWidth: 420 }}>{description}</span>}
      {action && <div style={{ marginTop: 'var(--space-2)' }}>{action}</div>}
    </div>
  )
}

// ---------------------------------------------------------------
// Confirm（その場に出る確認。画面の流れを変えないため、ダイアログにはしない）
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
      display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', padding: 'var(--space-4)', borderRadius: 'var(--shape-md)',
      background: tone === 'danger' ? 'var(--danger-bg)' : 'var(--accent-bg)',
    }}>
      <span style={{ ...type('title-small'), color: 'var(--text-primary)' }}>{message}</span>
      {detail && <span style={{ ...type('body-medium'), color: 'var(--text-secondary)' }}>{detail}</span>}
      <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end', flexWrap: 'wrap', marginTop: 'var(--space-1)' }}>
        <Button variant="ghost" size="sm" onClick={onCancel}>やめる</Button>
        <M3Button variant="filled" danger={tone === 'danger'} size="xs" loading={busy} onClick={onConfirm}>{confirmLabel}</M3Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------
// Avatar（人ごとの色は名前から決まる意味のある色なので、そのまま）
// ---------------------------------------------------------------
export function Avatar({ name, size = 28 }: { name: string | null; size?: number }) {
  const ch = (name ?? '?').trim().charAt(0) || '?'
  let hash = 0
  for (const c of name ?? '?') hash = (hash * 31 + c.charCodeAt(0)) % 360
  return (
    <span
      title={name ?? undefined}
      style={{
        width: size, height: size, borderRadius: 'var(--shape-full)', flexShrink: 0,
        background: `hsl(${hash} 55% 88%)`, color: `hsl(${hash} 45% 32%)`,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontSize: Math.round(size * 0.46), fontWeight: 700, border: '2px solid var(--surface)',
      }}
    >
      {ch}
    </span>
  )
}
