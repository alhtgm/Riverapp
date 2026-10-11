import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useStore } from '../../store/useStore'
import { useSocialStore } from '../../store/useSocialStore'
import { Avatar } from '../ui/Sheet'
import type { SocialTab } from '../social/SocialPanel'

interface Props {
  onOpenSocial: (tab: SocialTab) => void
  onOpenMyProfile: () => void
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
  logout: (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M10 3L15 8M15 8L10 13M15 8H5M6 2H2.5C1.67 2 1 2.67 1 3.5v9c0 .83.67 1.5 1.5 1.5H6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
}

/** ヘッダー右端の「通知」ボタンとハンバーガーメニュー */
export default function HeaderMenu({ onOpenSocial, onOpenMyProfile }: Props) {
  const { profile, isDark, toggleTheme, signOut } = useStore()
  const unread = useSocialStore(s => s.notifications.filter(n => !n.read_at).length)
  const incoming = useSocialStore(s => s.incoming.length)
  const invites = useSocialStore(s => s.invites.length)
  const [open, setOpen] = useState(false)
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
    </>
  )
}
