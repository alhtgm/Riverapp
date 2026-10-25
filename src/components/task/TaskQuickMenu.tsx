import { useEffect, useRef } from 'react'
import type { Task, TaskStatus } from '../../types'
import { STATUS_CONFIG, STATUS_ORDER, isOverdue, formatDate } from '../../types'
import { useStore } from '../../store/useStore'
import { PeopleRow } from '../lecture/ProgressPeople'
import { BottomSheet } from '../ui/m3'
import '../ui/m3.css'

interface Props {
  task: Task
  position: { x: number; y: number }
  onClose: () => void
  onOpenDetail: () => void
  /** スマホでは、押した場所の近くではなく下から出るシートにする（親指が届き、画面からはみ出さない） */
  asSheet?: boolean
}

/** メニューの大きさの見込み（画面からはみ出さない位置を決めるため） */
const MENU_WIDTH = 300
const MENU_HEIGHT = 340
const EDGE = 8

/**
 * タイムラインのバーを押したときに出るメニュー（M3 の menu: 角 4px・各行 48px）。
 * 自分のステータスをその場で切り替え、詳細の編集へ進める。
 */
export default function TaskQuickMenu({ task, position, onClose, onOpenDetail, asSheet = false }: Props) {
  const { updateTask, progress } = useStore()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // シートのときは、Esc と外側のタップでの閉じる処理を BottomSheet に任せる
    if (asSheet) return
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    const timerId = setTimeout(() => {
      document.addEventListener('mousedown', handleClick)
      document.addEventListener('keydown', handleKey)
    }, 0)
    return () => {
      clearTimeout(timerId)
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [onClose, asSheet])

  // 押した場所の下に出す。入らなければ上に、それでも入らなければ画面の端に寄せる
  const width = Math.min(MENU_WIDTH, window.innerWidth - EDGE * 2)
  const x = Math.max(EDGE, Math.min(position.x, window.innerWidth - width - EDGE))
  const below = position.y + 12
  const above = position.y - MENU_HEIGHT - 8
  const y = below + MENU_HEIGHT <= window.innerHeight - EDGE
    ? below
    : Math.max(EDGE, above >= EDGE ? above : window.innerHeight - MENU_HEIGHT - EDGE)

  const handleStatusClick = async (status: TaskStatus) => {
    await updateTask(task.id, { status })
    onClose()
  }

  const overdue = isOverdue(task)

  const body = (
    <>
      <div className="m3-menu__group-label">
        <span>自分のステータス</span>
        <span>参加者の状況</span>
      </div>
      {STATUS_ORDER.map(s => {
        const cfg = STATUS_CONFIG[s]
        const isActive = task.status === s
        return (
          <button
            key={s}
            type="button"
            role="menuitemradio"
            aria-checked={isActive}
            className={`m3-menu-item m3-state${isActive ? ' m3-menu-item--selected' : ''}`}
            onClick={() => handleStatusClick(s)}
          >
            <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 'var(--shape-full)', background: cfg.color, flexShrink: 0 }} />
            <span style={{ width: 72, flexShrink: 0, color: isActive ? cfg.color : 'var(--text-primary)', fontWeight: isActive ? 'var(--type-weight-emphasized)' : undefined }}>
              {cfg.label}
            </span>
            {/* この講義の参加者のうち、このステータスにいる人 */}
            <span style={{ flex: 1, minWidth: 0, display: 'flex', justifyContent: 'flex-end' }}>
              <PeopleRow people={progress[task.id]?.[s] ?? []} size={20} />
            </span>
            <span aria-hidden="true" style={{ width: 18, display: 'flex', flexShrink: 0 }}>
              {isActive && (
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M4 9.5l3 3 7-7" stroke={cfg.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </span>
          </button>
        )
      })}

      {overdue && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 'var(--space-3)', margin: 'var(--space-1) var(--space-2) 0',
          padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--shape-xs)', background: STATUS_CONFIG.overdue.bg,
          color: STATUS_CONFIG.overdue.color, fontSize: 'var(--type-body-small-size)', lineHeight: 'var(--type-body-small-line)',
        }}>
          <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 'var(--shape-full)', background: STATUS_CONFIG.overdue.color, flexShrink: 0 }} />
          期限切れ（締切を過ぎると自動でこの表示になります）
        </div>
      )}

      <div className="m3-menu__divider" />
      <button type="button" role="menuitem" className="m3-menu-item m3-state" style={{ color: 'var(--accent-dark)' }} onClick={() => { onOpenDetail(); onClose() }}>
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
          <path d="M3 9h12M9.5 3.5L15 9l-5.5 5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        詳細を編集
      </button>
    </>
  )

  // 1日だけの課題は同じ日付を2回並べず、締切だけを出す
  const dates = task.start_date === task.due_date
    ? `締切 ${formatDate(task.due_date)}`
    : `${formatDate(task.start_date)} → ${formatDate(task.due_date)}`

  if (asSheet) {
    return (
      <BottomSheet open onClose={onClose} title={task.title} zIndex={200}>
        <div style={{ margin: '0 calc(-1 * var(--space-6))' }}>
          <div style={{ padding: '0 var(--space-6) var(--space-2)', fontSize: 'var(--type-body-small-size)', lineHeight: 'var(--type-body-small-line)', color: 'var(--text-secondary)' }}>{dates}</div>
          {body}
        </div>
      </BottomSheet>
    )
  }

  return (
    <div ref={ref} role="menu" aria-label={`${task.title} のステータス`} className="m3-menu" style={{ top: y, left: x, width, zIndex: 200 }}>
      <div className="m3-menu__header">
        <div style={{
          fontSize: 'var(--type-title-small-size)', lineHeight: 'var(--type-title-small-line)', fontWeight: 'var(--type-title-small-weight)',
          color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {task.title}
        </div>
        <div style={{ fontSize: 'var(--type-body-small-size)', lineHeight: 'var(--type-body-small-line)', color: 'var(--text-secondary)' }}>
          {dates}
        </div>
      </div>

      {body}
    </div>
  )
}
