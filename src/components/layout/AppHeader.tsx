import type { ViewMode } from '../../store/useStore'
import { useStore } from '../../store/useStore'

const RiverLogo = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
    <path d="M2 13C4.5 8.5 7.5 6.5 10 9C12.5 11.5 15.5 9.5 18 5" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M2 16.5C4.5 12 7.5 10 10 12.5C12.5 15 15.5 13 18 8.5" stroke="rgba(255,255,255,0.45)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

const TABS: { key: ViewMode; label: string; mobileLabel: string }[] = [
  { key: 'timeline', label: 'タイムライン', mobileLabel: 'TL' },
  { key: 'todo',     label: 'ToDo',         mobileLabel: 'ToDo' },
  { key: 'calendar', label: 'カレンダー',   mobileLabel: 'カレ' },
]

interface Props {
  isMobile: boolean
  onAddClick: () => void
}

export default function AppHeader({ isMobile, onAddClick }: Props) {
  const { activeView, setActiveView, isDark, toggleTheme, signOut } = useStore()

  return (
    <header style={{
      height: 52,
      background: 'linear-gradient(135deg, #2f2963 0%, #454372 100%)',
      borderBottom: '1px solid rgba(255,255,255,0.07)',
      boxShadow: '0 2px 12px rgba(28,22,60,0.45)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 18px',
      gap: 10,
      flexShrink: 0,
      position: 'relative',
      zIndex: 100,
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0 }}>
        <div style={{
          width: 30,
          height: 30,
          background: 'linear-gradient(135deg, #454372 0%, #70877f 100%)',
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 3px 10px rgba(112,135,127,0.35)',
        }}>
          <RiverLogo size={18} />
        </div>
        <span style={{ fontSize: 17, fontWeight: 700, color: '#ffffff', letterSpacing: '-0.04em' }}>
          River
        </span>
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.18)', flexShrink: 0 }} />

      {/* Tab buttons */}
      {TABS.map(tab => {
        const isActive = activeView === tab.key
        return (
          <button
            key={tab.key}
            onClick={() => setActiveView(tab.key)}
            style={{
              background: isActive ? 'rgba(255,255,255,0.15)' : 'transparent',
              color: isActive ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.55)',
              border: `1px solid ${isActive ? 'rgba(255,255,255,0.25)' : 'transparent'}`,
              borderRadius: 6,
              padding: isMobile ? '3px 8px' : '4px 11px',
              fontSize: isMobile ? 11 : 12,
              fontWeight: isActive ? 600 : 400,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              fontFamily: 'inherit',
              letterSpacing: '-0.01em',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => {
              if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.08)'
            }}
            onMouseLeave={e => {
              if (!isActive) e.currentTarget.style.background = 'transparent'
            }}
          >
            {isMobile ? tab.mobileLabel : tab.label}
          </button>
        )
      })}

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Version badge */}
      <span style={{
        fontSize: 10,
        color: 'rgba(255,255,255,0.4)',
        fontWeight: 500,
        letterSpacing: '0.02em',
        background: 'rgba(255,255,255,0.08)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 4,
        padding: '1px 5px',
        flexShrink: 0,
      }}>
        v{__APP_VERSION__}
      </span>

      {/* Add task button */}
      <button
        onClick={onAddClick}
        aria-label="課題を追加 (N)"
        title="課題を追加 [N]"
        style={{
          background: 'linear-gradient(135deg, #ef946c 0%, #d4794f 100%)',
          color: '#ffffff',
          border: 'none',
          borderRadius: 8,
          padding: isMobile ? '7px 10px' : '7px 15px',
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
          letterSpacing: '-0.02em',
          boxShadow: '0 3px 10px rgba(239,148,108,0.35)',
          transition: 'all 0.25s',
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          flexShrink: 0,
          fontFamily: 'inherit',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.boxShadow = '0 5px 16px rgba(239,148,108,0.48)'
          e.currentTarget.style.transform = 'translateY(-1px)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.boxShadow = '0 3px 10px rgba(239,148,108,0.35)'
          e.currentTarget.style.transform = 'translateY(0)'
        }}
      >
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
          <path d="M6 1v10M1 6h10" stroke="white" strokeWidth="2" strokeLinecap="round"/>
        </svg>
        {!isMobile && '課題を追加'}
      </button>

      {/* Dark mode toggle */}
      <button
        onClick={toggleTheme}
        aria-label={isDark ? 'ライトモードに切り替え' : 'ダークモードに切り替え'}
        title={isDark ? 'ライトモード [D]' : 'ダークモード [D]'}
        style={{
          background: 'rgba(255,255,255,0.07)',
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: 7,
          padding: isMobile ? '6px 8px' : '6px 10px',
          fontSize: 15,
          cursor: 'pointer',
          color: 'rgba(255,255,255,0.75)',
          transition: 'all 0.2s',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          lineHeight: 1,
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.14)' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)' }}
      >
        {isDark ? '☀️' : '🌙'}
      </button>

      {/* Logout */}
      <button
        onClick={() => signOut()}
        aria-label="ログアウト"
        style={{
          background: 'rgba(255,255,255,0.07)',
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: 7,
          padding: isMobile ? '6px 8px' : '6px 11px',
          fontSize: 12,
          fontWeight: 500,
          cursor: 'pointer',
          color: 'rgba(255,255,255,0.75)',
          transition: 'all 0.2s',
          flexShrink: 0,
          fontFamily: 'inherit',
          letterSpacing: '-0.01em',
          display: 'flex',
          alignItems: 'center',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = 'rgba(255,255,255,0.14)'
          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = 'rgba(255,255,255,0.07)'
          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'
        }}
      >
        {isMobile ? (
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L15 8M15 8L10 13M15 8H5M6 2H2.5C1.67 2 1 2.67 1 3.5v9c0 .83.67 1.5 1.5 1.5H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        ) : 'ログアウト'}
      </button>
    </header>
  )
}
