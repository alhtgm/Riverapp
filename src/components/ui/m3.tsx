/**
 * Material Design 3 に沿った共通部品。見た目は m3.css、数値は src/theme/tokens.css。
 * 押す・乗せる・キーボードで選ぶときの「状態レイヤー」と、48px の押せる範囲は各部品に組み込み済み。
 *
 * 既存の kit.tsx（Button など）と名前が重なるものがあるので、画面を置き換えるときは
 * import 元を見て使い分ける（ステップ 3 で順に移す）。
 */
import {
  useEffect, useId, useRef,
  type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode,
  type SelectHTMLAttributes, type TextareaHTMLAttributes,
} from 'react'
import { createPortal } from 'react-dom'
import './m3.css'
import type { SnackbarMessage } from './useSnackbar'

/** 条件付きでクラス名をつなぐ（falsy な値は無視する） */
const cx = (...names: unknown[]) => names.filter((n): n is string => typeof n === 'string' && n !== '').join(' ')

// ─── ボタン ──────────────────────────────────────────────

export type ButtonVariant = 'filled' | 'tonal' | 'outlined' | 'text'

/**
 * ボタン。filled は画面の主要な操作（1 画面に基本 1 つ）、tonal は次に大事な操作、
 * outlined は補助、text はいちばん控えめな操作（キャンセルなど）に使う。
 */
export function Button({ variant = 'filled', size = 'sm', icon, danger = false, block = false, loading = false, className, children, disabled, type = 'button', ...rest }: {
  variant?: ButtonVariant
  /** sm = 高さ 40px（標準）、xs = 32px（一覧の行の中など） */
  size?: 'xs' | 'sm'
  /** 文字の左に置くアイコン（18px 程度） */
  icon?: ReactNode
  /** 削除など取り消せない操作 */
  danger?: boolean
  /** 横幅いっぱいに広げる */
  block?: boolean
  loading?: boolean
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={cx('m3-btn', 'm3-state', 'm3-target', `m3-btn--${variant}`, (icon || loading) && 'm3-btn--icon', size === 'xs' && 'm3-btn--xs', danger && 'm3-btn--danger', block && 'm3-btn--block', className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <span className="m3-spinner" aria-hidden="true" /> : icon}
      {children}
    </button>
  )
}

export type IconButtonVariant = 'standard' | 'filled' | 'tonal' | 'outlined'

/** アイコンだけのボタン。見た目は 40px、押せる範囲は 48px。文字がないので label（読み上げ用の名前）は必須 */
export function IconButton({ label, variant = 'standard', selected, className, children, type = 'button', ...rest }: {
  label: string
  variant?: IconButtonVariant
  /** 切り替えボタンとして使うとき、選ばれているか */
  selected?: boolean
  children: ReactNode
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      aria-pressed={selected}
      className={cx('m3-icon-btn', 'm3-state', 'm3-target', variant !== 'standard' && `m3-icon-btn--${variant}`, selected && 'm3-icon-btn--selected', className)}
      {...rest}
    >
      {children}
    </button>
  )
}

/** FAB。その画面でいちばん大事な操作 1 つだけに使う（River では「課題を追加」） */
export function Fab({ label, icon, size = 'medium', variant = 'primary', extended = false, className, type = 'button', ...rest }: {
  /** 読み上げ用の名前。extended のときはボタンの文字にもなる */
  label: string
  icon: ReactNode
  size?: 'small' | 'medium' | 'large'
  variant?: 'primary' | 'tonal'
  /** アイコンの横に文字も出す */
  extended?: boolean
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>) {
  return (
    <button
      type={type}
      aria-label={extended ? undefined : label}
      title={extended ? undefined : label}
      className={cx('m3-fab', 'm3-state', size !== 'medium' && !extended && `m3-fab--${size}`, variant === 'tonal' && 'm3-fab--tonal', extended && 'm3-fab--extended', className)}
      {...rest}
    >
      {icon}
      {extended && label}
    </button>
  )
}

// ─── カード ──────────────────────────────────────────────

/**
 * カード（角 12px）。elevated は影で少し浮かせる、filled は背景色で区切る、outlined は枠線で区切る。
 * onClick を渡すと全体が押せるカードになる。
 */
export function Card({ variant = 'outlined', padding = 'var(--space-4)', onClick, className, style, children, ...aria }: {
  variant?: 'elevated' | 'filled' | 'outlined'
  padding?: string | number
  onClick?: () => void
  className?: string
  style?: React.CSSProperties
  children: ReactNode
  'aria-label'?: string
}) {
  const classes = cx('m3-card', `m3-card--${variant}`, onClick && 'm3-state', className)
  if (onClick) {
    return <button type="button" className={classes} style={{ padding, ...style }} onClick={onClick} {...aria}>{children}</button>
  }
  return <div className={classes} style={{ padding, ...style }} {...aria}>{children}</div>
}

// ─── 入力欄 ──────────────────────────────────────────────

type FieldProps = {
  label: string
  /** 入力の補足（例: 「8文字のコード」） */
  supportingText?: ReactNode
  /** エラーがあるときの文言。補足の代わりに赤で出る */
  error?: ReactNode
  required?: boolean
  /** 枠の上のラベルの背景。カードの中など、背景が surface 以外のときに合わせる */
  background?: string
}

function FieldShell({ label, supportingText, error, required, background, id, children }: FieldProps & { id: string; children: ReactNode }) {
  const support = error || supportingText
  return (
    <div className={cx('m3-field', error && 'm3-field--error')} style={background ? { ['--m3-field-bg' as string]: background } : undefined}>
      <div className="m3-field__box">
        {children}
        <label className="m3-field__label" htmlFor={id}>{label}{required && ' *'}</label>
      </div>
      {support && <div id={`${id}-support`} className="m3-field__support" role={error ? 'alert' : undefined}>{support}</div>}
    </div>
  )
}

/** 1 行の入力欄（outlined）。type="date" なども使える */
export function TextField({ label, supportingText, error, required, background, id, className, prefix, style, ...rest }: FieldProps & {
  /** 入力欄の左に固定で出す文字（例: ユーザーIDの「@」） */
  prefix?: string
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'prefix'>) {
  const autoId = useId()
  const fieldId = id ?? autoId
  return (
    <FieldShell {...{ label, supportingText, error, required, background }} id={fieldId}>
      {prefix && <span className="m3-field__prefix" aria-hidden="true">{prefix}</span>}
      <input
        id={fieldId}
        style={prefix ? { paddingLeft: `calc(var(--space-4) + ${prefix.length + 0.6}em)`, ...style } : style}
        className={cx('m3-field__control', className)}
        required={required}
        aria-invalid={!!error || undefined}
        aria-describedby={error || supportingText ? `${fieldId}-support` : undefined}
        {...rest}
      />
    </FieldShell>
  )
}

/** 複数行の入力欄 */
export function TextArea({ label, supportingText, error, required, background, id, className, ...rest }: FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const autoId = useId()
  const fieldId = id ?? autoId
  return (
    <FieldShell {...{ label, supportingText, error, required, background }} id={fieldId}>
      <textarea
        id={fieldId}
        className={cx('m3-field__control', className)}
        required={required}
        aria-invalid={!!error || undefined}
        aria-describedby={error || supportingText ? `${fieldId}-support` : undefined}
        {...rest}
      />
    </FieldShell>
  )
}

/** 選択肢から選ぶ入力欄（<option> を children に渡す） */
export function SelectField({ label, supportingText, error, required, background, id, className, children, ...rest }: FieldProps & SelectHTMLAttributes<HTMLSelectElement>) {
  const autoId = useId()
  const fieldId = id ?? autoId
  return (
    <FieldShell {...{ label, supportingText, error, required, background }} id={fieldId}>
      <select
        id={fieldId}
        className={cx('m3-field__control', className)}
        required={required}
        aria-invalid={!!error || undefined}
        aria-describedby={error || supportingText ? `${fieldId}-support` : undefined}
        {...rest}
      >
        {children}
      </select>
    </FieldShell>
  )
}

// ─── 入力欄とボタンをつなげた形 ─────────────────────────────────

/**
 * 入力欄とその操作のボタンを1つの枠にまとめたもの（検索・作る・参加・コピーなど）。
 * 左の入力欄を大きく取り、右に区切り線でつなげたボタンを置く。form の中なら action は送信ボタンになる
 */
export function JoinedInput({ prefix, actionLabel, actionVariant = 'tonal', actionType = 'submit', onAction, actionDisabled, loading = false, ...input }: {
  /** 入力欄の左に添える文字（「@」など） */
  prefix?: ReactNode
  actionLabel: string
  /** primary = 塗りつぶし（その画面の主な操作）、tonal = 淡い色 */
  actionVariant?: 'primary' | 'tonal'
  actionType?: 'submit' | 'button'
  onAction?: () => void
  actionDisabled?: boolean
  loading?: boolean
} & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="m3-joined">
      {prefix && <span className="m3-joined__prefix" aria-hidden="true">{prefix}</span>}
      <input {...input} className={cx('m3-joined__input', input.className)} />
      <button
        type={actionType}
        className={cx('m3-joined__action', 'm3-state', actionVariant === 'primary' && 'm3-joined__action--primary')}
        disabled={actionDisabled || loading}
        aria-busy={loading || undefined}
        onClick={onAction}
      >
        {loading && <span className="m3-spinner" aria-hidden="true" />}
        {actionLabel}
      </button>
    </div>
  )
}

// ─── チップ ──────────────────────────────────────────────

const checkIcon = (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
    <path d="M4 9.5l3 3 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)
const removeIcon = (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
    <path d="M3.5 3.5l7 7M10.5 3.5l-7 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
)

/**
 * チップ（高さ 32px・角 8px）。
 * - 絞り込み（filter）: selected を渡すと選択状態の見た目とチェックが付く
 * - 入力済みの項目（input）: onRemove を渡すと右に × が付く
 * - それ以外（assist）: 関連する操作への近道
 */
export function Chip({ selected, icon, onRemove, removeLabel, className, children, type = 'button', ...rest }: {
  selected?: boolean
  icon?: ReactNode
  onRemove?: () => void
  /** × ボタンの読み上げ名（例: 「ゼミを外す」） */
  removeLabel?: string
  children: ReactNode
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const leading = selected ? checkIcon : icon
  if (onRemove) {
    // 入力チップは「本体」と「×」を別のボタンにする（ボタンの入れ子は不可のため）
    return (
      <span className={cx('m3-chip', leading && 'm3-chip--leading', 'm3-chip--trailing', className)} style={{ cursor: 'default', ...rest.style }}>
        {leading}
        <span>{children}</span>
        <button type="button" className="m3-chip__remove m3-icon-btn m3-state m3-target" style={{ width: 24, height: 24 }} aria-label={removeLabel ?? '外す'} onClick={onRemove}>
          {removeIcon}
        </button>
      </span>
    )
  }
  return (
    <button
      type={type}
      aria-pressed={selected}
      className={cx('m3-chip', 'm3-state', 'm3-target', leading && 'm3-chip--leading', selected && 'm3-chip--selected', className)}
      {...rest}
    >
      {leading}
      {children}
    </button>
  )
}

/**
 * セグメントボタン（2〜5 個から 1 つを選ぶ切り替え）。選ばれているものにはチェックが付く。
 * 画面全体を切り替えるタブとは違い、フォームの中の選択肢に使う（例: 単発 / 繰り返し）
 */
export function SegmentedButton<K extends string>({ options, value, onChange, label, block = false }: {
  /** icon は選ばれていないときに文字の左に出る（選ばれるとチェックに変わる） */
  options: { key: K; label: string; icon?: ReactNode }[]
  value: K
  onChange: (key: K) => void
  /** 読み上げ用のまとまりの名前 */
  label: string
  /** 横幅いっぱいに広げる */
  block?: boolean
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cx('m3-segmented', block && 'm3-segmented--block')}>
      {options.map(o => {
        const selected = o.key === value
        return (
          <button
            key={o.key}
            type="button"
            role="radio"
            aria-checked={selected}
            className={cx('m3-segment', 'm3-state', 'm3-target', selected && 'm3-segment--selected')}
            onClick={() => onChange(o.key)}
          >
            {selected ? checkIcon : o.icon}
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/**
 * スイッチ（すぐに反映されるオン/オフ）。文字の部分を押しても切り替わる。
 * 保存ボタンを押すまで反映されない選択肢には、チェックボックスやセグメントボタンを使う
 */
export function Switch({ checked, onChange, label, disabled }: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  disabled?: boolean
}) {
  return (
    <label className="m3-switch-row">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        className="m3-switch m3-state m3-target"
        onClick={() => onChange(!checked)}
      >
        <span className="m3-switch__handle" />
      </button>
      <span className="m3-switch-row__label">{label}</span>
    </label>
  )
}

// ─── 重ねて開く画面（ダイアログ・ボトムシート）─────────────────

/** 開いている間: Esc で閉じる・背景のスクロールを止める・閉じたら元の場所にフォーカスを戻す */
function useModal(open: boolean, onClose: () => void, panelRef: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    // 入力欄があれば最初の入力欄へ、なければ画面そのものへフォーカスを移す
    // （ボタンに移すと、タップで開いたときにも選択中の枠が出てうるさいため）
    requestAnimationFrame(() => {
      const target = panelRef.current?.querySelector<HTMLElement>('input, select, textarea')
      ;(target ?? panelRef.current)?.focus()
    })
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      previous?.focus?.()
    }
  }, [open, onClose, panelRef])
}

/**
 * ダイアログ（角 28px）。見出し・本文・右下のボタンの構成。
 * 「確認」や「短い入力」に使う。長い内容や選択肢はボトムシートを使う。
 */
export function Dialog({ open, onClose, title, icon, actions, children, zIndex = 400 }: {
  open: boolean
  onClose: () => void
  title: string
  /** 見出しの上に置くアイコン（置くと見出しが中央寄せになる） */
  icon?: ReactNode
  /** 右下のボタン。右端が主要な操作 */
  actions?: ReactNode
  children?: ReactNode
  zIndex?: number
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  useModal(open, onClose, panelRef)
  if (!open) return null
  return createPortal(
    <div className="m3-scrim" style={{ zIndex }} onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className={cx('m3-dialog', icon && 'm3-dialog--centered')}>
        {icon && <div className="m3-dialog__icon">{icon}</div>}
        <h2 id={titleId} className="m3-dialog__title">{title}</h2>
        {children && <div className="m3-dialog__body">{children}</div>}
        {actions && <div className="m3-dialog__actions">{actions}</div>}
      </div>
    </div>,
    document.body,
  )
}

/** ボトムシート（下から出る・上の角 28px・つまみ付き）。スマホでの選択肢や詳細表示に使う */
export function BottomSheet({ open, onClose, title, children, zIndex = 400 }: {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  zIndex?: number
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  useModal(open, onClose, panelRef)
  if (!open) return null
  return createPortal(
    <div className="m3-scrim m3-scrim--sheet" style={{ zIndex }} onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={title ? titleId : undefined} aria-label={title ? undefined : 'シート'} tabIndex={-1} className="m3-sheet">
        <div className="m3-sheet__handle-area" aria-hidden="true"><div className="m3-sheet__handle" /></div>
        {title && <h2 id={titleId} className="m3-sheet__title">{title}</h2>}
        <div className="m3-sheet__body">{children}</div>
      </div>
    </div>,
    document.body,
  )
}

// ─── ナビゲーション ─────────────────────────────────────────

export interface NavDestination<K extends string> {
  key: K
  label: string
  icon: ReactNode
  /** 選ばれているときのアイコン（塗りつぶし版など）。なければ icon のまま */
  activeIcon?: ReactNode
  /** 右上の数字。true なら点だけ */
  badge?: number | true
}

function NavItem<K extends string>({ item, active, onSelect }: { item: NavDestination<K>; active: boolean; onSelect: (key: K) => void }) {
  const badge = item.badge === true
    ? <span className="m3-badge m3-badge--dot" aria-hidden="true" />
    : item.badge ? <span className="m3-badge" aria-hidden="true">{item.badge > 99 ? '99+' : item.badge}</span> : null
  const badgeText = item.badge === true ? '（新着あり）' : item.badge ? `（${item.badge}件）` : ''
  return (
    <button
      type="button"
      className={cx('m3-nav-item', active && 'm3-nav-item--active')}
      aria-current={active ? 'page' : undefined}
      aria-label={item.label + badgeText}
      onClick={() => onSelect(item.key)}
    >
      <span className="m3-nav-item__indicator">
        {active && item.activeIcon ? item.activeIcon : item.icon}
        {badge}
      </span>
      <span className="m3-nav-item__label">{item.label}</span>
    </button>
  )
}

/** 画面下のナビゲーションバー（compact = スマホ幅）。行き先は 3〜5 個 */
export function NavigationBar<K extends string>({ items, value, onChange, label = 'メイン' }: {
  items: NavDestination<K>[]
  value: K
  onChange: (key: K) => void
  label?: string
}) {
  return (
    <nav className="m3-navbar" aria-label={label}>
      {items.map(item => <NavItem key={item.key} item={item} active={item.key === value} onSelect={onChange} />)}
    </nav>
  )
}

/** 左側のナビゲーションレール（medium 以上 = タブレット・PC）。上に FAB、いちばん下に footer を置ける */
export function NavigationRail<K extends string>({ items, value, onChange, fab, footer, label = 'メイン' }: {
  items: NavDestination<K>[]
  value: K
  onChange: (key: K) => void
  fab?: ReactNode
  /** レールのいちばん下（設定など、画面の切り替えではない操作） */
  footer?: ReactNode
  label?: string
}) {
  return (
    <nav className="m3-rail" aria-label={label}>
      {fab && <div className="m3-rail__top">{fab}</div>}
      {items.map(item => <NavItem key={item.key} item={item} active={item.key === value} onSelect={onChange} />)}
      {footer && <div className="m3-rail__bottom">{footer}</div>}
    </nav>
  )
}

/** レールの行き先と同じ見た目のボタン（画面は切り替えず、シートを開くなどの操作に使う） */
export function NavRailButton({ label, icon, active = false, onClick }: {
  label: string
  icon: ReactNode
  /** 開いているシートなど、今その操作の中にいるとき */
  active?: boolean
  onClick: () => void
}) {
  return (
    <button type="button" className={cx('m3-nav-item', active && 'm3-nav-item--active')} aria-label={label} aria-expanded={active} onClick={onClick}>
      <span className="m3-nav-item__indicator">{icon}</span>
      <span className="m3-nav-item__label">{label}</span>
    </button>
  )
}

// ─── スナックバー ───────────────────────────────────────────

export function Snackbar({ message, onClose }: { message: SnackbarMessage | null; onClose: () => void }) {
  if (!message) return null
  return createPortal(
    <div className="m3-snackbar-host">
      <div className="m3-snackbar" role="status" aria-live="polite">
        <span className="m3-snackbar__text">{message.text}</span>
        {message.action && (
          <Button variant="text" onClick={() => { message.action?.onClick(); onClose() }}>{message.action.label}</Button>
        )}
        <IconButton label="閉じる" onClick={onClose}>{removeIcon}</IconButton>
      </div>
    </div>,
    document.body,
  )
}
