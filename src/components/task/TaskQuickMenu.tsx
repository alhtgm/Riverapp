import { useEffect, useRef } from 'react'
import type { Task, TaskStatus } from '../../types'
import { STATUS_CONFIG, STATUS_ORDER, isOverdue, formatDate } from '../../types'
import { useStore } from '../../store/useStore'

interface Props {
  task: Task
  position: { x: number; y: number }
  onClose: () => void
  onOpenDetail: () => void
}

export default function TaskQuickMenu({ task, position, onClose, onOpenDetail }: Props) {
  const { updateTask, isDark } = useStore()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
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
  }, [onClose])

  const menuWidth = 228
  const menuHeight = 210
  const x = Math.min(position.x, window.innerWidth - menuWidth - 8)
  const y = position.y + 12 + menuHeight > window.innerHeight
    ? position.y - menuHeight - 8
    : position.y + 12

  const handleStatusClick = async (status: TaskStatus) => {
    await updateTask(task.id, { status })
    onClose()
  }

  const effectiveStatus = isOverdue(task) ? 'overdue' : task.status

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        top: y,
        left: x,
        width: menuWidth,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        boxShadow: '0 8px 32px rgba(20,16,10,0.12), 0 2px 8px rgba(20,16,10,0.06)',
        zIndex: 200,
        overflow: 'hidden',
        animation: 'quickMenuIn 0.22s cubic-bezier(0.16,1,0.3,1)',
      }}
    >
      <style>{`
        @keyframes quickMenuIn {
          from { opacity: 0; transform: scale(0.94) translateY(-8px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>

      {/* Task info */}
      <div style={{
        padding: '11px 13px 9px',
        borderBottom: '1px solid var(--border-light)',
        background: 'var(--surface-warm)',
      }}>
        <div style={{
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--text-primary)',
          letterSpacing: '-0.02em',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          marginBottom: 2,
        }}>
          {task.title}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', letterSpacing: '-0.01em' }}>
          {formatDate(task.start_date)} → {formatDate(task.due_date)}
        </div>
      </div>

      {/* Status buttons */}
      <div style={{ padding: '8px 10px' }}>
        <div style={{
          fontSize: 9,
          fontWeight: 700,
          color: 'var(--text-disabled)',
          letterSpacing: '0.1em',
          marginBottom: 5,
          textTransform: 'uppercase',
        }}>
          ステータス
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {STATUS_ORDER.map(s => {
            const cfg = STATUS_CONFIG[s]
            const isActive = task.status === s
            const btnColor = isDark ? cfg.darkColor : cfg.color
            const btnBg    = isDark ? cfg.darkBg    : cfg.bg
            return (
              <button
                key={s}
                onClick={() => handleStatusClick(s)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background: isActive ? btnBg : 'transparent',
                  border: isActive ? `1px solid ${btnColor}22` : '1px solid transparent',
                  borderRadius: 7,
                  padding: '6px 8px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  width: '100%',
                  transition: 'background 0.1s',
                  fontFamily: 'inherit',
                }}
                onMouseEnter={e => {
                  if (!isActive) {
                    (e.currentTarget as HTMLButtonElement).style.background = btnBg
                    ;(e.currentTarget as HTMLButtonElement).style.borderColor = btnColor + '22'
                  }
                }}
                onMouseLeave={e => {
                  if (!isActive) {
                    (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
                    ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'transparent'
                  }
                }}
              >
                <div style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: btnColor,
                  flexShrink: 0,
                  boxShadow: isActive ? `0 1px 4px ${btnColor}44` : 'none',
                }} />
                <span style={{
                  fontSize: 13,
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? btnColor : 'var(--text-secondary)',
                  letterSpacing: '-0.01em',
                  flex: 1,
                }}>
                  {cfg.label}
                </span>
                {isActive && (
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none" style={{ marginLeft: 'auto', flexShrink: 0 }}>
                    <path d="M2 6l3 3 5-5" stroke={btnColor} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </button>
            )
          })}

          {effectiveStatus === 'overdue' && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '5px 8px',
              borderRadius: 7,
              background: isDark ? STATUS_CONFIG.overdue.darkBg : STATUS_CONFIG.overdue.bg,
              border: `1px solid ${(isDark ? STATUS_CONFIG.overdue.darkColor : STATUS_CONFIG.overdue.color)}22`,
              marginTop: 2,
            }}>
              <div style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: isDark ? STATUS_CONFIG.overdue.darkColor : STATUS_CONFIG.overdue.color,
              }} />
              <span style={{ fontSize: 12, color: isDark ? STATUS_CONFIG.overdue.darkColor : STATUS_CONFIG.overdue.color, fontWeight: 500, letterSpacing: '-0.01em' }}>
                期限切れ（自動）
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Detail link */}
      <div style={{ borderTop: '1px solid var(--border-light)', padding: '6px 10px' }}>
        <button
          onClick={() => { onOpenDetail(); onClose() }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'transparent',
            border: '1px solid transparent',
            borderRadius: 7,
            padding: '6px 8px',
            cursor: 'pointer',
            width: '100%',
            fontSize: 13,
            color: 'var(--accent)',
            fontWeight: 600,
            letterSpacing: '-0.01em',
            fontFamily: 'inherit',
            transition: 'background 0.1s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'var(--accent-bg)'
            e.currentTarget.style.borderColor = 'var(--accent-muted)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.borderColor = 'transparent'
          }}
        >
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
            <path d="M2 7h10M7 2l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          詳細を編集
        </button>
      </div>
    </div>
  )
}
