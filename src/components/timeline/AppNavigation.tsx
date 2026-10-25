import type { ReactNode } from 'react'
import { useSocialStore } from '../../store/useSocialStore'
import { Fab, NavigationBar, NavigationRail, NavRailButton, type NavDestination } from '../ui/m3'

export type AppDestination = 'timeline' | 'people' | 'inbox' | 'me'

/** 受信箱の「返事が必要」と同じ件を指す通知の種類（未読の数で二重に数えない） */
const PENDING_TYPES = new Set(['friend_request', 'party_invite', 'lecture_apply_request'])

const svg = (children: ReactNode) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">{children}</svg>
)

const icons: Record<AppDestination, ReactNode> = {
  timeline: svg(<path d="M4 6.5h10M7 12h13M4 17.5h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />),
  people: svg(<>
    <circle cx="9" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.7" />
    <path d="M3 19c.6-3.2 3-5 6-5s5.4 1.8 6 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    <circle cx="17" cy="9" r="2.4" stroke="currentColor" strokeWidth="1.6" />
    <path d="M17 14c2 .2 3.5 1.7 4 4.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </>),
  inbox: svg(<>
    <path d="M6 16.5V11a6 6 0 1112 0v5.5l1.6 2H4.4L6 16.5z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    <path d="M10 21a2 2 0 004 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </>),
  me: svg(<>
    <circle cx="12" cy="8.5" r="3.6" stroke="currentColor" strokeWidth="1.7" />
    <path d="M5 20c.8-3.6 3.6-5.6 7-5.6s6.2 2 7 5.6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </>),
}

const plusIcon = svg(<path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />)

/** 歯車（Material Design の settings の形を線で描く） */
const settingsIcon = svg(<>
  <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 00.12-.61l-1.92-3.32a.49.49 0 00-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.48.48 0 00-.48-.41h-3.84a.47.47 0 00-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.49.49 0 00-.59.22L2.74 8.87a.48.48 0 00.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 00-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32a.49.49 0 00-.12-.61l-2.01-1.58z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
  <circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="1.6" />
</>)

/**
 * 画面の切り替え（M3 の navigation bar / rail）。
 * - スマホ（compact）: 画面下のナビゲーションバー（設定は「自分」の中から開く）
 * - タブレット・PC: 左側のナビゲーションレール（いちばん上に「課題を追加」の FAB、いちばん下に「設定」）
 */
export default function AppNavigation({ variant, active, onSelect, onAdd, onOpenSettings, settingsOpen = false }: {
  variant: 'bar' | 'rail'
  active: AppDestination
  onSelect: (key: AppDestination) => void
  /** レールの上の FAB（課題を追加） */
  onAdd: () => void
  /** レールの下の「設定」 */
  onOpenSettings?: () => void
  settingsOpen?: boolean
}) {
  const incoming = useSocialStore(s => s.incoming.length)
  const invites = useSocialStore(s => s.invites.length)
  const applyRequests = useSocialStore(s => s.applyRequests.length)
  const unreadOther = useSocialStore(s => s.notifications.filter(n => !n.read_at && !PENDING_TYPES.has(n.type)).length)
  const inboxCount = applyRequests + incoming + invites + unreadOther

  const items: NavDestination<AppDestination>[] = [
    { key: 'timeline', label: 'タイムライン', icon: icons.timeline },
    { key: 'people', label: '仲間', icon: icons.people },
    { key: 'inbox', label: '受信箱', icon: icons.inbox, badge: inboxCount > 0 ? inboxCount : undefined },
    { key: 'me', label: '自分', icon: icons.me },
  ]

  if (variant === 'bar') {
    return <NavigationBar items={items} value={active} onChange={onSelect} label="画面の切り替え" />
  }
  return (
    <NavigationRail
      items={items}
      value={active}
      onChange={onSelect}
      label="画面の切り替え"
      fab={<Fab label="課題を追加 [N]" icon={plusIcon} onClick={onAdd} />}
      footer={onOpenSettings && <NavRailButton label="設定" icon={settingsIcon} active={settingsOpen} onClick={onOpenSettings} />}
    />
  )
}
