import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useStore } from '../../store/useStore'
import { useSocialStore } from '../../store/useSocialStore'
import { Avatar, Button, Field } from '../ui/kit'
import Sheet from '../ui/Sheet'
import { inputStyle } from '../ui/styles'
import {
  SEMESTER_TERMS, currentSemester, listSemesters, semesterKey, semesterLabel, subjectInSemester,
  type SemesterTerm,
} from '../../lib/semester'
import type { SocialTab } from '../social/SocialPanel'
import type { ManageTab } from '../social/ManageCenter'

interface Props {
  onOpenSocial: (tab: SocialTab) => void
  onOpenMyProfile: () => void
  onOpenManage: (tab?: ManageTab) => void
}

const headerButton: CSSProperties = {
  background: 'rgba(255,255,255,0.07)',
  color: 'rgba(255,255,255,0.85)',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: 8,
  width: 36,
  height: 34,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  position: 'relative',
  fontFamily: 'inherit',
  transition: 'background 0.2s',
}

function Badge({ count }: { count: number }) {
  if (count <= 0) return null
  return (
    <span style={{
      position: 'absolute', top: -5, right: -5, minWidth: 17, height: 17, borderRadius: 9999,
      background: 'var(--accent)', color: '#fff', fontSize: 10, fontWeight: 700,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px',
      boxShadow: '0 0 0 2px #2f2963',
    }}>
      {count > 99 ? '99+' : count}
    </span>
  )
}

function MenuItem({ icon, label, badge = 0, onClick, danger = false }: {
  icon: ReactNode; label: string; badge?: number; onClick: () => void; danger?: boolean
}) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 12px',
        background: 'transparent', border: 'none', borderRadius: 8, cursor: 'pointer',
        fontFamily: 'inherit', fontSize: 13, fontWeight: 500, textAlign: 'left',
        color: danger ? 'var(--danger)' : 'var(--text-primary)',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-secondary)' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
    >
      <span style={{ width: 18, display: 'flex', justifyContent: 'center', color: danger ? 'var(--danger)' : 'var(--text-secondary)' }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      {badge > 0 && (
        <span style={{ background: 'var(--accent)', color: '#fff', borderRadius: 9999, fontSize: 10, fontWeight: 700, padding: '1px 7px' }}>{badge}</span>
      )}
    </button>
  )
}

const icon = {
  friends: (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="6" cy="5.5" r="2.3" stroke="currentColor" strokeWidth="1.4" />
      <path d="M1.8 13c.4-2.3 2.2-3.6 4.2-3.6s3.8 1.3 4.2 3.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="11.5" cy="6.2" r="1.8" stroke="currentColor" strokeWidth="1.3" />
      <path d="M11.2 9.6c1.6 0 2.8 1 3.1 2.7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  ),
  party: (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 2.2l1.7 3.4 3.8.5-2.7 2.7.6 3.8L8 10.8l-3.4 1.8.6-3.8L2.5 6.1l3.8-.5L8 2.2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  ),
  account: (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="2.2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 1.8v1.6M8 12.6v1.6M14.2 8h-1.6M3.4 8H1.8M12.4 3.6l-1.1 1.1M4.7 11.3l-1.1 1.1M12.4 12.4l-1.1-1.1M4.7 4.7L3.6 3.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ),
  semester: (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="2" y="3" width="12" height="11" rx="1.8" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2 6.5h12M5.5 1.8v2.4M10.5 1.8v2.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ),
  manage: (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2 4h7M12 4h2M2 8h2M7 8h7M2 12h9M14 12h0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="10.5" cy="4" r="1.5" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="5.5" cy="8" r="1.5" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="12.5" cy="12" r="1.5" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  ),
  logout: (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M10 3L15 8M15 8L10 13M15 8H5M6 2H2.5C1.67 2 1 2.67 1 3.5v9c0 .83.67 1.5 1.5 1.5H6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
}

const TERM_OPTION_LABEL: Record<SemesterTerm, string> = { spring: '前期', fall: '後期', other: 'その他' }

/** メニュー内の行（MenuItem と同じ寸法）。選択中の学期などに使う */
function MenuRow({ icon, label, trailing, onClick, active = false, expanded, nested = false }: {
  icon: ReactNode; label: string; trailing?: ReactNode; onClick: () => void; active?: boolean; expanded?: boolean
  /** 灰色のまとまりの中に置くとき（ホバー色を背景と変える） */
  nested?: boolean
}) {
  return (
    <button
      role={expanded === undefined ? 'menuitem' : undefined}
      aria-expanded={expanded}
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 12px',
        background: 'transparent', border: 'none', borderRadius: 8, cursor: 'pointer',
        fontFamily: 'inherit', fontSize: 13, fontWeight: active ? 700 : 500, textAlign: 'left',
        color: 'var(--text-primary)',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = nested ? 'var(--surface)' : 'var(--bg-secondary)' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
    >
      <span style={{ width: 18, display: 'flex', justifyContent: 'center', color: active ? 'var(--accent)' : 'var(--text-secondary)' }}>{icon}</span>
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      {trailing}
    </button>
  )
}

const chevron = (open: boolean) => (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true"
    style={{ color: 'var(--text-tertiary)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}>
    <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const check = (
  <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
    <path d="M2.5 7.5l3 3 6-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const plus = (
  <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
    <path d="M7 2.5v9M2.5 7h9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
)

const trailingText = (text: string) => (
  <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 500, flexShrink: 0 }}>{text}</span>
)

/** 学期の切り替え（Excel のシートを切り替える感覚）。開くと学期の一覧が出る */
function SemesterSection({ onPicked, onCreate }: { onPicked: () => void; onCreate: () => void }) {
  const { subjects, semester, setSemester } = useStore()
  const [expanded, setExpanded] = useState(false)
  const semesters = listSemesters(subjects, [currentSemester(), semester])
  const currentKey = semesterKey(semester)

  return (
    <>
      <MenuRow
        icon={icon.semester}
        label="学期"
        expanded={expanded}
        onClick={() => setExpanded(e => !e)}
        trailing={<>{trailingText(semesterLabel(semester))}{chevron(expanded)}</>}
      />
      {expanded && (
        <div role="group" aria-label="学期を選ぶ" style={{ background: 'var(--bg-secondary)', borderRadius: 8, margin: '2px 0 4px', padding: 2 }}>
          <div style={{ maxHeight: 216, overflowY: 'auto' }}>
            {semesters.map(s => {
              const key = semesterKey(s)
              const active = key === currentKey
              const count = subjects.filter(sub => subjectInSemester(sub, s)).length
              return (
                <MenuRow
                  key={key}
                  icon={active ? check : null}
                  label={semesterLabel(s)}
                  active={active}
                  nested
                  onClick={() => { setSemester(s); setExpanded(false); onPicked() }}
                  trailing={trailingText(count > 0 ? `${count}講義` : '講義なし')}
                />
              )
            })}
          </div>
          <MenuRow icon={plus} label="新しい学期を始める" nested onClick={onCreate} />
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
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button onClick={onClose}>やめる</Button>
          <Button variant="primary" disabled={!validYear} onClick={open}>この学期を開く</Button>
        </div>
      }
    >
      <div style={{ display: 'flex', gap: 12 }}>
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

/** ヘッダー右端の「通知」ボタンとハンバーガーメニュー */
export default function HeaderMenu({ onOpenSocial, onOpenMyProfile, onOpenManage }: Props) {
  const { profile, isDark, toggleTheme, signOut } = useStore()
  const unread = useSocialStore(s => s.notifications.filter(n => !n.read_at).length)
  const incoming = useSocialStore(s => s.incoming.length)
  const invites = useSocialStore(s => s.invites.length)
  const applyRequests = useSocialStore(s => s.applyRequests.length)
  /** まとめて管理で返事が必要な件数 */
  const pending = applyRequests + incoming + invites
  const [open, setOpen] = useState(false)
  const [newSemesterOpen, setNewSemesterOpen] = useState(false)
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

  return (
    <>
      <button
        onClick={() => onOpenManage(pending > 0 ? 'inbox' : undefined)}
        aria-label={pending > 0 ? `まとめて管理（対応が必要な申請${pending}件）` : 'まとめて管理'}
        title="まとめて管理（申請・招待・講義の公開）"
        style={headerButton}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.14)' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)' }}
      >
        {icon.manage}
        <Badge count={pending} />
      </button>

      <button
        onClick={() => onOpenSocial('notifications')}
        aria-label={unread > 0 ? `通知（未読${unread}件）` : '通知'}
        title="通知"
        style={headerButton}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.14)' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)' }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M4 11V7a4 4 0 118 0v4l1.2 1.5H2.8L4 11z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
          <path d="M6.5 14a1.6 1.6 0 003 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        <Badge count={unread} />
      </button>

      <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
        <button
          onClick={() => setOpen(o => !o)}
          aria-label="メニュー"
          aria-haspopup="menu"
          aria-expanded={open}
          title="メニュー"
          style={{ ...headerButton, background: open ? 'rgba(255,255,255,0.16)' : headerButton.background }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.14)' }}
          onMouseLeave={e => { e.currentTarget.style.background = open ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.07)' }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M2.5 4h11M2.5 8h11M2.5 12h11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <Badge count={incoming + invites} />
        </button>

        {open && (
          <div
            role="menu"
            style={{
              position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 260,
              background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
              boxShadow: 'var(--shadow-lg)', padding: 6, zIndex: 250,
            }}
          >
            <button
              role="menuitem"
              onClick={pick(onOpenMyProfile)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 12px',
                background: 'var(--surface-warm)', border: '1px solid var(--border-light)', borderRadius: 10,
                cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', marginBottom: 4,
              }}
            >
              <Avatar name={profile?.display_name ?? null} size={34} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {profile?.display_name}
                </span>
                <span style={{ display: 'block', fontSize: 11, color: 'var(--text-tertiary)' }}>
                  {profile?.handle ? `@${profile.handle}・` : ''}自分のプロフィール
                </span>
              </span>
            </button>
            <SemesterSection onPicked={() => setOpen(false)} onCreate={pick(() => setNewSemesterOpen(true))} />
            <div style={{ height: 1, background: 'var(--border-light)', margin: '4px 6px' }} />
            <MenuItem icon={icon.manage} label="まとめて管理" badge={pending} onClick={pick(() => onOpenManage(pending > 0 ? 'inbox' : undefined))} />
            <MenuItem icon={icon.friends} label="フレンド" badge={incoming} onClick={pick(() => onOpenSocial('friends'))} />
            <MenuItem icon={icon.party} label="パーティー" badge={invites} onClick={pick(() => onOpenSocial('parties'))} />
            <MenuItem icon={icon.account} label="アカウント設定" onClick={pick(() => onOpenSocial('account'))} />
            <div style={{ height: 1, background: 'var(--border-light)', margin: '4px 6px' }} />
            <MenuItem
              icon={<img src={isDark ? '/sun.png' : '/moon.png'} width={14} height={14} alt="" style={{ display: 'block', filter: isDark ? 'brightness(0) invert(1)' : 'none', opacity: 0.7 }} />}
              label={isDark ? 'ライトモードにする' : 'ダークモードにする'}
              onClick={() => toggleTheme()}
            />
            <MenuItem icon={icon.logout} label="ログアウト" danger onClick={pick(() => { void signOut() })} />
          </div>
        )}
      </div>
      {newSemesterOpen && <NewSemesterSheet onClose={() => setNewSemesterOpen(false)} />}
    </>
  )
}
