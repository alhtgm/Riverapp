import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useStore } from '../../store/useStore'
import { Avatar, Button, Field } from '../ui/kit'
import Sheet from '../ui/Sheet'
import { inputStyle } from '../ui/styles'
import {
  SEMESTER_TERMS, currentSemester, listSemesters, semesterKey, semesterLabel, subjectInSemester,
  type SemesterTerm,
} from '../../lib/semester'

/** 文字の役割（tokens.css の M3 type scale）をインラインスタイルで使う */
const type = (role: string): CSSProperties => ({
  fontSize: `var(--type-${role}-size)`,
  lineHeight: `var(--type-${role}-line)`,
  fontWeight: `var(--type-${role}-weight)`,
  letterSpacing: `var(--type-${role}-tracking)`,
})

const svg = (children: ReactNode) => (
  <svg width="20" height="20" viewBox="0 0 16 16" fill="none" aria-hidden="true">{children}</svg>
)

const icon = {
  semester: svg(<>
    <rect x="2" y="3" width="12" height="11" rx="1.8" stroke="currentColor" strokeWidth="1.3" />
    <path d="M2 6.5h12M5.5 1.8v2.4M10.5 1.8v2.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
  </>),
  settings: svg(<>
    <circle cx="8" cy="8" r="2.2" stroke="currentColor" strokeWidth="1.3" />
    <path d="M8 1.5v1.8M8 12.7v1.8M14.5 8h-1.8M3.3 8H1.5M12.6 3.4l-1.3 1.3M4.7 11.3l-1.3 1.3M12.6 12.6l-1.3-1.3M4.7 4.7L3.4 3.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
  </>),
  logout: svg(<path d="M10 3L15 8M15 8L10 13M15 8H5M6 2H2.5C1.67 2 1 2.67 1 3.5v9c0 .83.67 1.5 1.5 1.5H6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />),
  check: svg(<path d="M3 8.5l3 3 7-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />),
  plus: svg(<path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />),
  chevronRight: svg(<path d="M6 3.5L10.5 8 6 12.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />),
}

const TERM_OPTION_LABEL: Record<SemesterTerm, string> = { spring: '前期', fall: '後期', other: 'その他' }

/** 一覧の 1 行（M3 の list/menu item: 高さ 48px・左にアイコン） */
function Row({ icon: leading, label, trailing, onClick, danger = false, selected = false, indent = false, expanded }: {
  icon?: ReactNode
  label: string
  trailing?: ReactNode
  onClick: () => void
  danger?: boolean
  selected?: boolean
  /** 学期の一覧など、ひとつ下の階層の行 */
  indent?: boolean
  /** 開け閉めする行のとき、開いているか */
  expanded?: boolean
}) {
  return (
    <button
      type="button"
      aria-expanded={expanded}
      aria-current={selected || undefined}
      onClick={onClick}
      className={`m3-menu-item m3-state${selected ? ' m3-menu-item--selected' : ''}`}
      style={{ color: danger ? 'var(--danger)' : undefined, paddingLeft: indent ? 'var(--space-12)' : undefined, borderRadius: 'var(--shape-md)' }}
    >
      <span style={{ width: 20, display: 'flex', flexShrink: 0, color: danger ? 'var(--danger)' : selected ? 'var(--accent-dark)' : 'var(--text-secondary)' }}>{leading}</span>
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: selected ? 'var(--type-weight-emphasized)' : undefined }}>{label}</span>
      {trailing}
    </button>
  )
}

const chevron = (open: boolean) => (
  <svg width="18" height="18" viewBox="0 0 10 10" fill="none" aria-hidden="true"
    style={{ color: 'var(--text-secondary)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform var(--motion-duration-short4) var(--motion-easing-standard)', flexShrink: 0 }}>
    <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const trailingText = (text: string) => (
  <span style={{ ...type('label-medium'), color: 'var(--text-secondary)', flexShrink: 0 }}>{text}</span>
)

/** 学期の切り替え（Excel のシートを切り替える感覚）。開くと学期の一覧が出る */
function SemesterSection({ onPicked, onCreate }: { onPicked: () => void; onCreate: () => void }) {
  const { subjects, semester, setSemester } = useStore()
  const [expanded, setExpanded] = useState(false)
  const semesters = listSemesters(subjects, [currentSemester(), semester])
  const currentKey = semesterKey(semester)

  return (
    <>
      <Row
        icon={icon.semester}
        label="学期"
        expanded={expanded}
        onClick={() => setExpanded(e => !e)}
        trailing={<>{trailingText(semesterLabel(semester))}{chevron(expanded)}</>}
      />
      {expanded && (
        <div role="group" aria-label="学期を選ぶ">
          {semesters.map(s => {
            const key = semesterKey(s)
            const active = key === currentKey
            const count = subjects.filter(sub => subjectInSemester(sub, s)).length
            return (
              <Row
                key={key}
                icon={active ? icon.check : null}
                label={semesterLabel(s)}
                selected={active}
                indent
                onClick={() => { setSemester(s); setExpanded(false); onPicked() }}
                trailing={trailingText(count > 0 ? `${count}講義` : '講義なし')}
              />
            )
          })}
          <Row icon={icon.plus} label="新しい学期を始める" indent onClick={onCreate} />
        </div>
      )}
    </>
  )
}

/**
 * ヘッダーの学期の表示。押すと学期の一覧（メニュー）が開き、その場で切り替えられる。
 * compact: スマホ向けに「年度」を省いて短く出す
 */
export function SemesterSwitcher({ compact, onCreate }: { compact: boolean; onCreate: () => void }) {
  const { subjects, semester, setSemester } = useStore()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const semesters = listSemesters(subjects, [currentSemester(), semester])
  const currentKey = semesterKey(semester)
  const label = semesterLabel(semester)

  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        title="学期を切り替える"
        onClick={() => setOpen(o => !o)}
        className="m3-state"
        style={{
          ...type('label-medium'),
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          color: 'var(--on-brand)',
          background: 'color-mix(in srgb, var(--on-brand) 14%, transparent)',
          border: 'none',
          borderRadius: 'var(--shape-full)',
          padding: 'var(--space-1) var(--space-1) var(--space-1) var(--space-2)',
          whiteSpace: 'nowrap',
          cursor: 'pointer',
        }}
      >
        {compact ? label.replace('年度 ', '') : label}
        <svg width="16" height="16" viewBox="0 0 10 10" fill="none" aria-hidden="true"
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform var(--motion-duration-short4) var(--motion-easing-standard)' }}>
          <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="m3-menu" role="menu" aria-label="学期を選ぶ" style={{
          position: 'absolute', top: 'calc(100% + var(--space-2))', left: 0, width: 260, zIndex: 10,
        }}>
          {semesters.map(s => {
            const key = semesterKey(s)
            const active = key === currentKey
            const count = subjects.filter(sub => subjectInSemester(sub, s)).length
            return (
              <button
                key={key}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                className={`m3-menu-item m3-state${active ? ' m3-menu-item--selected' : ''}`}
                onClick={() => { setSemester(s); setOpen(false) }}
              >
                <span style={{ width: 20, display: 'flex', flexShrink: 0, color: 'var(--accent-dark)' }}>{active ? icon.check : null}</span>
                <span style={{ flex: 1, fontWeight: active ? 'var(--type-weight-emphasized)' : undefined }}>{semesterLabel(s)}</span>
                {trailingText(count > 0 ? `${count}講義` : '講義なし')}
              </button>
            )
          })}
          <div className="m3-menu__divider" />
          <button
            type="button"
            role="menuitem"
            className="m3-menu-item m3-state"
            onClick={() => { setOpen(false); onCreate() }}
          >
            <span style={{ width: 20, display: 'flex', flexShrink: 0, color: 'var(--text-secondary)' }}>{icon.plus}</span>
            新しい学期を始める
          </button>
        </div>
      )}
    </div>
  )
}

/** 新しい学期を始める（空のシートを開く） */
export function NewSemesterSheet({ onClose }: { onClose: () => void }) {
  const setSemester = useStore(s => s.setSemester)
  const now = currentSemester()
  const [year, setYear] = useState(now.year)
  const [term, setTerm] = useState<SemesterTerm>(now.term)
  const validYear = Number.isInteger(year) && year >= 2000 && year <= 2100

  const open = () => {
    if (!validYear) return
    setSemester({ year, term })
    onClose()
  }

  return (
    <Sheet
      title="新しい学期を始める"
      subtitle="選んだ学期の空のシートが開きます。講義を作るときの年度・学期も、この学期が初期値になります。"
      onClose={onClose}
      width={420}
      zIndex={320}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
          <Button variant="ghost" onClick={onClose}>やめる</Button>
          <Button variant="primary" disabled={!validYear} onClick={open}>この学期を開く</Button>
        </div>
      }
    >
      <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
        <div style={{ flex: 1 }}>
          <Field label="年度" required error={validYear ? null : '2000〜2100の年度を入力してください'}>
            <input type="number" min={2000} max={2100} value={year} onChange={e => setYear(Number(e.target.value))} style={inputStyle} />
          </Field>
        </div>
        <div style={{ flex: 1 }}>
          <Field label="学期" required>
            <select value={term} onChange={e => setTerm(e.target.value as SemesterTerm)} style={inputStyle}>
              {SEMESTER_TERMS.map(t => <option key={t} value={t}>{TERM_OPTION_LABEL[t]}</option>)}
            </select>
          </Field>
        </div>
      </div>
    </Sheet>
  )
}

/**
 * ナビゲーションの「自分」。プロフィール・学期の切り替え・設定・ログアウト。
 * （以前のヘッダー右端の ≡ メニューの中身）
 */
export default function AccountSheet({ onClose, onOpenMyProfile, onOpenSettings, onNewSemester }: {
  onClose: () => void
  onOpenMyProfile: () => void
  onOpenSettings: () => void
  onNewSemester: () => void
}) {
  const { profile, signOut } = useStore()
  const then = (fn: () => void) => () => { onClose(); fn() }

  return (
    <Sheet title="自分" onClose={onClose} width={420} zIndex={300}>
      <div style={{ display: 'flex', flexDirection: 'column', margin: 'calc(-1 * var(--space-2))' }}>
        <button
          type="button"
          onClick={then(onOpenMyProfile)}
          className="m3-menu-item m3-state"
          style={{ minHeight: 72, gap: 'var(--space-3)', borderRadius: 'var(--shape-md)' }}
        >
          <Avatar name={profile?.display_name ?? null} size={40} />
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', ...type('title-medium'), color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {profile?.display_name}
            </span>
            <span style={{ display: 'block', ...type('body-small'), color: 'var(--text-secondary)' }}>
              {profile?.handle ? `@${profile.handle}・` : ''}プロフィールとアカウント
            </span>
          </span>
          <span style={{ color: 'var(--text-secondary)', display: 'flex' }}>{icon.chevronRight}</span>
        </button>
        <div className="m3-menu__divider" />
        <SemesterSection onPicked={onClose} onCreate={then(onNewSemester)} />
        <Row icon={icon.settings} label="設定（表示モード・テーマカラー）" onClick={then(onOpenSettings)} />
        <div className="m3-menu__divider" />
        <Row icon={icon.logout} label="ログアウト" danger onClick={() => { void signOut() }} />
      </div>
    </Sheet>
  )
}
