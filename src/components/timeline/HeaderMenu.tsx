import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useStore } from '../../store/useStore'
import { useSocialStore } from '../../store/useSocialStore'
import { Avatar, Button, Field } from '../ui/kit'
import { IconButton } from '../ui/m3'
import Sheet from '../ui/Sheet'
import SettingsSheet from '../settings/SettingsSheet'
import { inputStyle } from '../ui/styles'
import {
  SEMESTER_TERMS, currentSemester, listSemesters, semesterKey, semesterLabel, subjectInSemester,
  type SemesterTerm,
} from '../../lib/semester'
import type { PeopleTab } from '../social/PeoplePanel'

interface Props {
  onOpenPeople: (tab?: PeopleTab) => void
  onOpenInbox: () => void
  onOpenMyProfile: () => void
  isMobile: boolean
}

/** 受信箱の「返事が必要」と同じ件を指す通知の種類（未読の数で二重に数えない） */
const PENDING_TYPES = new Set(['friend_request', 'party_invite', 'lecture_apply_request'])

/** 文字の役割（tokens.css の M3 type scale）をインラインスタイルで使う */
const type = (role: string, weight?: string): CSSProperties => ({
  fontSize: `var(--type-${role}-size)`,
  lineHeight: `var(--type-${role}-line)`,
  fontWeight: weight ?? `var(--type-${role}-weight)`,
  letterSpacing: `var(--type-${role}-tracking)`,
})

/** ヘッダー（選んだ色の帯）の上のボタンの文字色 */
const onBrand: CSSProperties = { color: 'var(--on-brand)' }

/** 件数のバッジ（M3 の large badge。ボタンの右上） */
function CountBadge({ count }: { count: number }) {
  if (count <= 0) return null
  return (
    <span className="m3-badge" aria-hidden="true" style={{ top: 2, left: 'auto', right: 2 }}>
      {count > 99 ? '99+' : count}
    </span>
  )
}

const svg = (children: ReactNode) => (
  <svg width="20" height="20" viewBox="0 0 16 16" fill="none" aria-hidden="true">{children}</svg>
)

const icon = {
  friends: svg(<>
    <circle cx="6" cy="5.5" r="2.3" stroke="currentColor" strokeWidth="1.3" />
    <path d="M1.8 13c.4-2.3 2.2-3.6 4.2-3.6s3.8 1.3 4.2 3.6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    <circle cx="11.5" cy="6.2" r="1.8" stroke="currentColor" strokeWidth="1.2" />
    <path d="M11.2 9.6c1.6 0 2.8 1 3.1 2.7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
  </>),
  inbox: svg(<>
    <path d="M4 11V7a4 4 0 118 0v4l1.2 1.5H2.8L4 11z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    <path d="M6.5 14a1.6 1.6 0 003 0" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
  </>),
  menu: svg(<path d="M2.5 4h11M2.5 8h11M2.5 12h11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />),
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
}

const TERM_OPTION_LABEL: Record<SemesterTerm, string> = { spring: '前期', fall: '後期', other: 'その他' }

/** メニューの 1 行（M3 の menu item: 高さ 48px・左にアイコン） */
function MenuItem({ icon: leading, label, trailing, onClick, danger = false, selected = false, indent = false, expanded }: {
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
      role={expanded === undefined ? 'menuitem' : undefined}
      aria-expanded={expanded}
      aria-current={selected || undefined}
      onClick={onClick}
      className={`m3-menu-item m3-state${selected ? ' m3-menu-item--selected' : ''}`}
      style={{ color: danger ? 'var(--danger)' : undefined, paddingLeft: indent ? 'var(--space-12)' : undefined }}
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
      <MenuItem
        icon={icon.semester}
        label="学期"
        expanded={expanded}
        onClick={() => setExpanded(e => !e)}
        trailing={<>{trailingText(semesterLabel(semester))}{chevron(expanded)}</>}
      />
      {expanded && (
        <div role="group" aria-label="学期を選ぶ">
          <div style={{ maxHeight: 240, overflowY: 'auto' }}>
            {semesters.map(s => {
              const key = semesterKey(s)
              const active = key === currentKey
              const count = subjects.filter(sub => subjectInSemester(sub, s)).length
              return (
                <MenuItem
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
          </div>
          <MenuItem icon={icon.plus} label="新しい学期を始める" indent onClick={onCreate} />
        </div>
      )}
    </>
  )
}

/** 新しい学期を始める（空のシートを開く） */
function NewSemesterSheet({ onClose }: { onClose: () => void }) {
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
 * ヘッダー右端のボタン（仲間・受信箱・メニュー）。M3 の top app bar の後ろ側の操作。
 * PC では文字付きのボタン、スマホでは 48px のアイコンボタンにする。
 */
export default function HeaderMenu({ onOpenPeople, onOpenInbox, onOpenMyProfile, isMobile }: Props) {
  const { profile, signOut } = useStore()
  const incoming = useSocialStore(s => s.incoming.length)
  const invites = useSocialStore(s => s.invites.length)
  const applyRequests = useSocialStore(s => s.applyRequests.length)
  /** 受信箱で返事が必要な件数 */
  const pending = applyRequests + incoming + invites
  /** 返事が必要なもの以外の未読のお知らせ（返事が必要なものと二重に数えない） */
  const unreadOther = useSocialStore(s => s.notifications.filter(n => !n.read_at && !PENDING_TYPES.has(n.type)).length)
  const inboxCount = pending + unreadOther
  const [open, setOpen] = useState(false)
  const [newSemesterOpen, setNewSemesterOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const pick = (fn: () => void) => () => { setOpen(false); fn() }
  const inboxLabel = inboxCount > 0 ? `受信箱（${pending > 0 ? `返事が必要 ${pending}件` : `未読 ${inboxCount}件`}）` : '受信箱'

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 0 : 'var(--space-1)', flexShrink: 0 }}>
      {isMobile ? (
        <>
          <IconButton label="仲間（フレンド・パーティー）" onClick={() => onOpenPeople()} style={onBrand}>{icon.friends}</IconButton>
          <span style={{ position: 'relative', display: 'inline-flex' }}>
            <IconButton label={inboxLabel} onClick={onOpenInbox} style={onBrand}>{icon.inbox}</IconButton>
            <CountBadge count={inboxCount} />
          </span>
        </>
      ) : (
        <>
          <button type="button" className="m3-btn m3-btn--text m3-btn--icon m3-state m3-target" style={onBrand}
            title="仲間（フレンド・パーティー）" onClick={() => onOpenPeople()}>
            {icon.friends}仲間
          </button>
          <button type="button" className="m3-btn m3-btn--text m3-btn--icon m3-state m3-target" style={onBrand}
            aria-label={inboxLabel} title="受信箱（申請・招待・お知らせ）" onClick={onOpenInbox}>
            {icon.inbox}受信箱
            <CountBadge count={inboxCount} />
          </button>
        </>
      )}

      <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
        <IconButton
          label="メニュー"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen(o => !o)}
          style={onBrand}
        >
          {icon.menu}
        </IconButton>

        {open && (
          <div role="menu" className="m3-menu" style={{ position: 'absolute', top: 'calc(100% + 4px)', right: 0, width: 288, zIndex: 250 }}>
            <button
              type="button"
              role="menuitem"
              onClick={pick(onOpenMyProfile)}
              className="m3-menu-item m3-state"
              style={{ minHeight: 64, gap: 'var(--space-3)' }}
            >
              <Avatar name={profile?.display_name ?? null} size={40} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', ...type('title-small'), color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {profile?.display_name}
                </span>
                <span style={{ display: 'block', ...type('body-small'), color: 'var(--text-secondary)' }}>
                  {profile?.handle ? `@${profile.handle}・` : ''}プロフィールとアカウント
                </span>
              </span>
            </button>
            <div className="m3-menu__divider" />
            <SemesterSection onPicked={() => setOpen(false)} onCreate={pick(() => setNewSemesterOpen(true))} />
            <MenuItem icon={icon.friends} label="仲間（フレンド・パーティー）" onClick={pick(() => onOpenPeople())} />
            <div className="m3-menu__divider" />
            <MenuItem icon={icon.settings} label="設定" onClick={pick(() => setSettingsOpen(true))} />
            <MenuItem icon={icon.logout} label="ログアウト" danger onClick={pick(() => { void signOut() })} />
          </div>
        )}
      </div>
      {newSemesterOpen && <NewSemesterSheet onClose={() => setNewSemesterOpen(false)} />}
      {settingsOpen && <SettingsSheet onClose={() => setSettingsOpen(false)} />}
    </div>
  )
}
