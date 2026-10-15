import { useEffect } from 'react'
import { useStore } from '../../store/useStore'
import SubjectList from './SubjectList'
import ProgressSummary from './ProgressSummary'
import SettingsPanel from './SettingsPanel'

const SIDEBAR_WIDTH = 220
/** ブランドヘッダーの高さ。サイドバーはヘッダーの下に重ねて表示する */
const HEADER_OFFSET = 52

export default function Sidebar() {
  const { isSidebarOpen, setSidebarOpen } = useStore()

  // Esc で閉じる
  useEffect(() => {
    if (!isSidebarOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSidebarOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isSidebarOpen, setSidebarOpen])

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
        style={{
          position: 'fixed',
          top: HEADER_OFFSET,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(20,16,10,0.32)',
          opacity: isSidebarOpen ? 1 : 0,
          pointerEvents: isSidebarOpen ? 'auto' : 'none',
          transition: 'opacity 0.2s ease',
          zIndex: 140,
        }}
      />

      {/* Panel */}
      <aside
        id="river-sidebar"
        aria-label="サイドメニュー"
        aria-hidden={!isSidebarOpen}
        inert={!isSidebarOpen}
        style={{
          position: 'fixed',
          top: HEADER_OFFSET,
          left: 0,
          bottom: 0,
          width: SIDEBAR_WIDTH,
          maxWidth: '85vw',
          background: 'var(--surface)',
          borderRight: '1px solid var(--border)',
          boxShadow: isSidebarOpen ? 'var(--shadow-xl)' : 'none',
          transform: isSidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.22s ease, box-shadow 0.22s ease',
          zIndex: 145,
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
          overscrollBehavior: 'contain',
        }}
      >
        <SubjectList />
        <Divider />
        <ProgressSummary />
        <div style={{ flex: 1, minHeight: 12 }} />
        <Divider />
        <SettingsPanel />
      </aside>
    </>
  )
}

function Divider() {
  return <div style={{ height: 1, background: 'var(--border-light)', margin: '0 14px', flexShrink: 0 }} />
}
