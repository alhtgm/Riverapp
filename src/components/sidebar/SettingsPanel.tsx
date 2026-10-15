import { useState } from 'react'
import { useStore } from '../../store/useStore'
import { getNotifEnabled, getNotifPermission, setNotifEnabled } from '../../lib/notifications'
import SectionTitle from './SectionTitle'

const SHORTCUTS: { key: string; label: string }[] = [
  { key: 'N',   label: '課題を追加' },
  { key: 'T',   label: '今日へ移動' },
  { key: 'D',   label: 'ダークモード' },
  { key: 'Esc', label: 'メニューを閉じる' },
]

const notifSupported = typeof window !== 'undefined' && 'Notification' in window

export default function SettingsPanel() {
  const { isDark, toggleTheme, signOut } = useStore()
  const [notifOn, setNotifOn] = useState(() => getNotifEnabled() && getNotifPermission() === 'granted')
  const [notifMessage, setNotifMessage] = useState<string | null>(null)

  const handleNotifToggle = async () => {
    setNotifMessage(null)
    if (notifOn) {
      setNotifEnabled(false)
      setNotifOn(false)
      return
    }
    if (!notifSupported) {
      setNotifMessage('このブラウザは通知に対応していません')
      return
    }
    let perm = getNotifPermission()
    if (perm === 'default') perm = await Notification.requestPermission()
    if (perm !== 'granted') {
      setNotifMessage('ブラウザの設定で通知を許可してください')
      return
    }
    setNotifEnabled(true)
    setNotifOn(true)
  }

  return (
    <section style={{ padding: '14px 14px 16px', flexShrink: 0 }}>
      <SectionTitle>設定</SectionTitle>

      <ToggleRow label="ダークモード" checked={isDark} onChange={toggleTheme} />
      <ToggleRow label="ブラウザ通知" checked={notifOn} onChange={handleNotifToggle} />
      {notifMessage && (
        <div role="alert" style={{
          fontSize: 11,
          color: 'var(--danger)',
          background: 'var(--danger-bg)',
          borderRadius: 6,
          padding: '5px 8px',
          margin: '2px 0 6px',
          lineHeight: 1.45,
        }}>
          {notifMessage}
        </div>
      )}

      {/* Shortcuts */}
      <div style={{ marginTop: 10 }}>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 5 }}>ショートカット</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {SHORTCUTS.map(s => (
            <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
              <kbd style={{
                minWidth: 30,
                textAlign: 'center',
                fontSize: 10.5,
                fontFamily: 'inherit',
                fontWeight: 600,
                color: 'var(--text-primary)',
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderBottomWidth: 2,
                borderRadius: 5,
                padding: '1px 5px',
              }}>
                {s.key}
              </kbd>
              {s.label}
            </div>
          ))}
        </div>
      </div>

      {/* Logout */}
      <button
        onClick={() => signOut()}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          width: '100%',
          marginTop: 14,
          padding: '7px 0',
          background: 'transparent',
          border: '1px solid var(--border)',
          borderRadius: 7,
          fontSize: 12,
          fontWeight: 500,
          color: 'var(--text-secondary)',
          cursor: 'pointer',
          fontFamily: 'inherit',
          transition: 'all 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.color = 'var(--danger)'; e.currentTarget.style.borderColor = 'var(--danger)' }}
        onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--border)' }}
      >
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
          <path d="M10 3L15 8M15 8L10 13M15 8H5M6 2H2.5C1.67 2 1 2.67 1 3.5v9c0 .83.67 1.5 1.5 1.5H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        ログアウト
      </button>
    </section>
  )
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '6px 0',
      fontSize: 13,
      color: 'var(--text-primary)',
      cursor: 'pointer',
    }}>
      {label}
      <button
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={onChange}
        style={{
          position: 'relative',
          width: 34,
          height: 20,
          borderRadius: 9999,
          border: 'none',
          padding: 0,
          background: checked ? '#70877f' : 'var(--border-strong)',
          cursor: 'pointer',
          transition: 'background 0.2s',
          flexShrink: 0,
        }}
      >
        <span style={{
          position: 'absolute',
          top: 2,
          left: checked ? 16 : 2,
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: '#ffffff',
          boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
          transition: 'left 0.2s',
        }} />
      </button>
    </label>
  )
}
