import type { Task } from '../types'
import { toDateString } from '../types'

const CHECKED_KEY = 'river-notif-checked'

export async function requestAndNotify(tasks: Task[]): Promise<void> {
  if (!('Notification' in window)) return

  // 1日1回のみチェック
  const today = new Date().toDateString()
  if (localStorage.getItem(CHECKED_KEY) === today) return

  let perm = Notification.permission
  if (perm === 'default') {
    perm = await Notification.requestPermission()
  }
  if (perm !== 'granted') return

  localStorage.setItem(CHECKED_KEY, today)

  const todayStr = toDateString(new Date())
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = toDateString(tomorrow)

  const dueToday = tasks.filter(
    t => t.due_date === todayStr && t.status !== 'done' && t.status !== 'submitted'
  )
  const dueTomorrow = tasks.filter(
    t => t.due_date === tomorrowStr && t.status !== 'done' && t.status !== 'submitted'
  )

  if (dueToday.length > 0) {
    new Notification(`River — 今日の締め切り: ${dueToday.length}件`, {
      body: dueToday.slice(0, 4).map(t => `・${t.title}`).join('\n'),
      tag: 'river-today',
      icon: '/icon-192.png',
    })
  }

  if (dueTomorrow.length > 0) {
    setTimeout(() => {
      new Notification(`River — 明日の締め切り: ${dueTomorrow.length}件`, {
        body: dueTomorrow.slice(0, 4).map(t => `・${t.title}`).join('\n'),
        tag: 'river-tomorrow',
        icon: '/icon-192.png',
      })
    }, 2500)
  }
}

export function getNotifPermission(): NotificationPermission {
  if (!('Notification' in window)) return 'denied'
  return Notification.permission
}
